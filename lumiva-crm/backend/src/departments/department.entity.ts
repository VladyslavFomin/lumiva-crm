// src/departments/department.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { StaffUser } from '../staff/staff-user.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, (t) => t.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 190 })
  name!: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  code!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // Древовидная структура: родительский отдел
  @ManyToOne(() => Department, (dept) => dept.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: Department | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  // Дочерние отделы
  @OneToMany(() => Department, (dept) => dept.parent)
  children!: Department[];

  // Руководитель отдела
  @ManyToOne(() => StaffUser, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager!: StaffUser | null;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null;

  // Сотрудники отдела (через связь в StaffUser). Раньше указывало на `staff.department` —
  // это обычная строковая колонка (легаси-имя отдела), а не relation-свойство; TypeORM не
  // мог бы построить JOIN по этой inverse-стороне. Безвредно, пока ничто не запрашивает
  // `relations: ['staff']` на этой стороне (сервис заполняет .staff вручную) — но "выстрелило"
  // бы в момент, когда кто-то добавит такой JOIN.
  @OneToMany(() => StaffUser, (staff) => staff.departmentEntity)
  staff!: StaffUser[];

  // Порядок отображения
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}










