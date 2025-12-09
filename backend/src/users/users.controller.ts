import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  Post,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==============================
  // 1) Временно: список всех пользователей (owner)
  // ==============================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  @Get()
  async getAll(@Req() req: any) {
    const { tenantId } = req.user;
    return this.usersService.adminListUsers(tenantId);
  }

  // ==============================
  // 2) Текущий пользователь: GET /users/me
  // ==============================
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user.userId;
    return this.usersService.findById(userId);
  }

  // ==============================
  // 3) Обновить свой профиль: PATCH /users/me
  // ==============================
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    const userId = req.user.userId;
    return this.usersService.updateMe(userId, dto);
  }

  // ==============================
  // 4) Сменить свой пароль: PATCH /users/me/password
  // ==============================
  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async updatePassword(
    @Req() req: any,
    @Body()
    body: {
      oldPassword?: string;
      newPassword?: string;
    },
  ) {
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException('oldPassword и newPassword обязательны');
    }

    const userId = req.user.userId;

    return this.usersService.updatePassword(
      userId,
      body.oldPassword,
      body.newPassword,
    );
  }

  // ==============================
  // 5) ADMIN (owner): создать/сбросить пароль сотруднику
  //     POST /users/admin/provision
  // ==============================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  @Post('admin/provision')
  async adminProvision(
    @Req() req: any,
    @Body()
    body: {
      email: string;
      name?: string;
      role?: string;
    },
  ) {
    if (!body.email) {
      throw new BadRequestException('email обязателен');
    }

    const { tenantId } = req.user;

    const { user, passwordPlain } =
      await this.usersService.adminProvisionUser({
        tenantId,
        email: body.email,
        name: body.name,
        role: body.role,
      });

    // фронту возвращаем email + пароль, чтобы ты мог показать во всплывашке
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      password: passwordPlain,
    };
  }

  // ==============================
  // 6) ADMIN (owner): сменить роль сотрудника
  //     PATCH /users/admin/:id/role
  // ==============================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  @Patch('admin/:id/role')
  async adminChangeRole(
    @Req() req: any,
    @Param('id') targetUserId: string,
    @Body() body: { role?: string },
  ) {
    if (!body.role) {
      throw new BadRequestException('role обязателен');
    }

    const { tenantId, userId: actingUserId } = req.user;

    const user = await this.usersService.adminUpdateRole({
      tenantId,
      targetUserId,
      newRole: body.role,
      actingUserId,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  // ==============================
  // 7) ADMIN (owner): активировать / деактивировать
  //     PATCH /users/admin/:id/status
  // ==============================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  @Patch('admin/:id/status')
  async adminSetStatus(
    @Req() req: any,
    @Param('id') targetUserId: string,
    @Body() body: { status?: 'active' | 'inactive' },
  ) {
    if (!body.status) {
      throw new BadRequestException('status обязателен');
    }

    const { tenantId, userId: actingUserId } = req.user;

    const user = await this.usersService.adminSetStatus({
      tenantId,
      targetUserId,
      status: body.status,
      actingUserId,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  // ==============================
  // 8) ADMIN (owner): удалить сотрудника
  //     DELETE /users/admin/:id
  // ==============================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  @Delete('admin/:id')
  async adminDelete(@Req() req: any, @Param('id') targetUserId: string) {
    const { tenantId, userId: actingUserId } = req.user;

    await this.usersService.adminDeleteUser({
      tenantId,
      targetUserId,
      actingUserId,
    });

    return { success: true };
  }
}