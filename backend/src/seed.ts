// src/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Tenant } from './tenants/tenant.entity';
import { User } from './users/user.entity';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const tenantRepo = dataSource.getRepository(Tenant);
  const userRepo = dataSource.getRepository(User);

  const clientKey = 'demo-client';
  const email = 'owner@demo.com';
  const password = 'demo123';

  let tenant = await tenantRepo.findOne({ where: { clientKey } });

  if (!tenant) {
    tenant = tenantRepo.create({
      clientKey,
      name: 'Demo Client',
      status: 'active',
      plan: 'basic',
    });
    tenant = await tenantRepo.save(tenant);
    console.log('Created tenant:', tenant.id);
  } else {
    console.log('Tenant already exists:', tenant.id);
  }

  let user = await userRepo.findOne({
    where: { tenantId: tenant.id, email },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);

    user = userRepo.create({
      tenantId: tenant.id,
      email,              // ✅ тот самый email сверху
      password: passwordHash, // ✅ тот самый пароль сверху (в хэше)
      role: 'owner',
    } as Partial<User>);

    user = await userRepo.save(user);
    console.log('Created user:', user.id);
  } else {
    console.log('User already exists:', user.id);
  }

  console.log('Seeder finished.');
  console.log('Login credentials:');
  console.log('clientKey:', clientKey);
  console.log('email    :', email);
  console.log('password :', password);

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});