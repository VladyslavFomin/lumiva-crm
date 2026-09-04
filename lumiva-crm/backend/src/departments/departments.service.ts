// src/departments/departments.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Department } from './department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { StaffUser } from '../staff/staff-user.entity';
import { Lead } from '../leads/lead.entity';
import { Sale } from '../sales/sale.entity';

export interface DepartmentsSummary {
  departmentsCount: number;
  staffInDepartments: number;
  totalActiveStaff: number;
  departmentsWithoutManager: number;
  unassignedStaffCount: number;
}

export interface DepartmentStats {
  staffCount: number; // прямой состав
  staffCountRecursive: number; // включая подотделы
  leadsInProgress: number;
  salesClosed30d: number;
  salesClosed30dAmount: number;
  conversionPct: number | null; // null — недостаточно данных
}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
  ) {}

  /**
   * Получить все отделы для тенанта в виде дерева
   */
  async getTreeForTenant(tenantId: string): Promise<Department[]> {
    const allDepartments = await this.repo.find({
      where: { tenantId },
      relations: ['manager', 'parent'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Строим дерево
    const departmentMap = new Map<string, Department>();
    const rootDepartments: Department[] = [];

    // Сначала создаем мапу всех отделов и инициализируем children
    allDepartments.forEach((dept) => {
      dept.children = [];
      departmentMap.set(dept.id, dept);
    });

    // Затем строим дерево
    allDepartments.forEach((dept) => {
      if (dept.parentId) {
        const parent = departmentMap.get(dept.parentId);
        if (parent) {
          parent.children!.push(dept);
        }
      } else {
        rootDepartments.push(dept);
      }
    });

    return rootDepartments;
  }

  /**
   * Получить все отделы (плоский список)
   */
  async listForTenant(tenantId: string): Promise<Department[]> {
    return this.repo.find({
      where: { tenantId },
      relations: ['manager', 'parent'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Получить один отдел
   */
  async getOneForTenant(tenantId: string, id: string): Promise<Department> {
    const department = await this.repo.findOne({
      where: { id, tenantId },
      relations: ['manager', 'parent'],
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Загружаем дочерние отделы отдельно
    const children = await this.repo.find({
      where: { parentId: id, tenantId },
      relations: ['manager'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    department.children = children;

    // Загружаем сотрудников отдельно
    const staff = await this.staffRepo.find({
      where: { departmentId: id, tenantId },
    });
    department.staff = staff;

    return department;
  }

  /**
   * Создать отдел
   */
  async createForTenant(
    tenantId: string,
    data: CreateDepartmentDto,
  ): Promise<Department> {
    // Проверяем, что родительский отдел существует и принадлежит тому же тенанту
    if (data.parentId) {
      const parent = await this.repo.findOne({
        where: { id: data.parentId, tenantId },
      });
      if (!parent) {
        throw new BadRequestException('Parent department not found');
      }

      // Проверяем на циклические зависимости
      if (await this.wouldCreateCycle(tenantId, data.parentId, null)) {
        throw new BadRequestException('Cannot create circular dependency');
      }
    }

    // Проверяем, что руководитель существует и принадлежит тенанту
    if (data.managerId) {
      const manager = await this.staffRepo.findOne({
        where: { id: data.managerId, tenantId },
      });
      if (!manager) {
        throw new BadRequestException('Manager not found');
      }
    }

    const department = this.repo.create({
      tenantId,
      name: data.name,
      code: data.code ?? null,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      managerId: data.managerId ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    });

    return this.repo.save(department);
  }

  /**
   * Обновить отдел
   */
  async updateForTenant(
    tenantId: string,
    id: string,
    data: UpdateDepartmentDto,
  ): Promise<Department> {
    // Без relations: иначе при save() TypeORM может синхронизировать устаревшие
    // manager / parent / staff / children и портить FK (500 при смене руководителя и т.д.).
    const department = await this.repo.findOne({
      where: { id, tenantId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Проверяем, что не пытаемся сделать отдел родителем самого себя
    if (data.parentId === id) {
      throw new BadRequestException('Department cannot be its own parent');
    }

    // Проверяем на циклические зависимости
    if (data.parentId) {
      const parent = await this.repo.findOne({
        where: { id: data.parentId, tenantId },
      });
      if (!parent) {
        throw new BadRequestException('Parent department not found');
      }

      if (await this.wouldCreateCycle(tenantId, data.parentId, id)) {
        throw new BadRequestException('Cannot create circular dependency');
      }
    }

    // Проверяем руководителя
    if (data.managerId !== undefined) {
      if (data.managerId) {
        const manager = await this.staffRepo.findOne({
          where: { id: data.managerId, tenantId },
        });
        if (!manager) {
          throw new BadRequestException('Manager not found');
        }
      }
      department.managerId = data.managerId ?? null;
    }

    if (data.name !== undefined) {
      department.name = data.name;
    }
    if (data.code !== undefined) {
      department.code = data.code;
    }
    if (data.description !== undefined) {
      department.description = data.description;
    }
    if (data.parentId !== undefined) {
      department.parentId = data.parentId ?? null;
    }
    if (data.sortOrder !== undefined) {
      department.sortOrder = data.sortOrder;
    }
    if (data.isActive !== undefined) {
      department.isActive = data.isActive;
    }

    return this.repo.save(department);
  }

  /**
   * Удалить отдел
   */
  async deleteForTenant(tenantId: string, id: string): Promise<void> {
    const department = await this.repo.findOne({
      where: { id, tenantId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Проверяем, есть ли дочерние отделы
    const children = await this.repo.find({
      where: { parentId: id, tenantId },
    });
    if (children.length > 0) {
      throw new BadRequestException(
        'Cannot delete department with child departments',
      );
    }

    // Проверяем, есть ли сотрудники в отделе
    const staff = await this.staffRepo.find({
      where: { departmentId: id, tenantId },
    });
    if (staff.length > 0) {
      throw new BadRequestException(
        'Cannot delete department with assigned staff',
      );
    }

    await this.repo.remove(department);
  }

  /**
   * Проверка на циклические зависимости
   */
  private async wouldCreateCycle(
    tenantId: string,
    newParentId: string,
    excludeId: string | null,
  ): Promise<boolean> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === excludeId) {
        return false; // Это не цикл, мы исключаем этот узел
      }

      if (visited.has(currentId)) {
        return true; // Найден цикл
      }

      visited.add(currentId);

      const dept = await this.repo.findOne({
        where: { id: currentId, tenantId },
      });

      if (!dept || !dept.parentId) {
        break;
      }

      currentId = dept.parentId;
    }

    return false;
  }

  /**
   * Получить всех сотрудников отдела (включая подотделы)
   */
  async getStaffRecursive(tenantId: string, departmentId: string): Promise<StaffUser[]> {
    const department = await this.getOneForTenant(tenantId, departmentId);
    const allStaff: StaffUser[] = [];

    // Получаем сотрудников текущего отдела
    const directStaff = await this.staffRepo.find({
      where: { departmentId, tenantId },
    });
    allStaff.push(...directStaff);

    // Получаем дочерние отделы
    const children = await this.repo.find({
      where: { parentId: departmentId, tenantId },
    });

    // Рекурсивно получаем сотрудников из дочерних отделов
    for (const child of children) {
      const childStaff = await this.getStaffRecursive(tenantId, child.id);
      allStaff.push(...childStaff);
    }

    return allStaff;
  }

  /**
   * KPI для шапки страницы «Отделы» — только реальные, посчитанные величины (без выдуманных
   * метрик вроде "загрузки в %", для которой в системе нет ни одной опорной цифры).
   */
  async getSummaryForTenant(tenantId: string): Promise<DepartmentsSummary> {
    const [departmentsCount, departmentsWithoutManager, totalActiveStaff, staffInDepartments] =
      await Promise.all([
        this.repo.count({ where: { tenantId } }),
        this.repo
          .createQueryBuilder('d')
          .where('d.tenantId = :tenantId', { tenantId })
          .andWhere('d.managerId IS NULL')
          .getCount(),
        this.staffRepo.count({ where: { tenantId, isActive: true } }),
        this.staffRepo
          .createQueryBuilder('s')
          .where('s.tenantId = :tenantId', { tenantId })
          .andWhere('s.isActive = true')
          .andWhere('s.departmentId IS NOT NULL')
          .getCount(),
      ]);

    return {
      departmentsCount,
      staffInDepartments,
      totalActiveStaff,
      departmentsWithoutManager,
      unassignedStaffCount: Math.max(0, totalActiveStaff - staffInDepartments),
    };
  }

  /**
   * Реальные показатели отдела (включая подотделы) — вместо выдуманных "среднее время ответа" /
   * "нагрузка на сотрудника" из макета, которым в системе не на что опереться. Лид считается
   * "в работе", если назначен на сотрудника отдела и не в терминальном статусе; сделка — если её
   * лид назначен на сотрудника отдела и сделка подтверждена за последние 30 дней. 'confirmed' —
   * ближайший эквивалент "закрыта успешно" в SaleStatus (нет отдельного 'won').
   */
  async getStatsForDepartment(tenantId: string, departmentId: string): Promise<DepartmentStats> {
    const directStaff = await this.staffRepo.find({ where: { departmentId, tenantId } });
    const recursiveStaff = await this.getStaffRecursive(tenantId, departmentId);
    const staffIds = recursiveStaff.map((s) => s.id);

    if (!staffIds.length) {
      return {
        staffCount: directStaff.length,
        staffCountRecursive: 0,
        leadsInProgress: 0,
        salesClosed30d: 0,
        salesClosed30dAmount: 0,
        conversionPct: null,
      };
    }

    const [leadsInProgress, leadsWon, leadsTotal, salesRows] = await Promise.all([
      this.leadRepo.count({
        where: { tenantId, assignedUserId: In(staffIds), status: In(['new', 'in_progress', 'waiting']) },
      }),
      this.leadRepo.count({ where: { tenantId, assignedUserId: In(staffIds), status: 'won' } }),
      this.leadRepo.count({ where: { tenantId, assignedUserId: In(staffIds) } }),
      this.saleRepo
        .createQueryBuilder('s')
        .innerJoin(Lead, 'l', 'l.id = s.leadId')
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('l."assignedUserId" IN (:...staffIds)', { staffIds })
        .andWhere("s.status = 'confirmed'")
        .andWhere('s."saleDate" >= :since', { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
        .select('COUNT(*)', 'cnt')
        .addSelect('COALESCE(SUM(s.amount), 0)', 'sum')
        .getRawOne<{ cnt: string; sum: string }>(),
    ]);

    return {
      staffCount: directStaff.length,
      staffCountRecursive: staffIds.length,
      leadsInProgress,
      salesClosed30d: Number(salesRows?.cnt ?? 0),
      salesClosed30dAmount: Number(salesRows?.sum ?? 0),
      conversionPct: leadsTotal > 0 ? Math.round((leadsWon / leadsTotal) * 1000) / 10 : null,
    };
  }
}

