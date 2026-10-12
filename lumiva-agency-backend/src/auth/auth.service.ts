import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { AdminUser } from './admin-user.entity'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser) private repo: Repository<AdminUser>,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.repo.findOne({ where: { email } })
    if (!user) throw new UnauthorizedException('Invalid credentials')
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')
    const token = this.jwt.sign({ sub: user.id, email: user.email })
    return { access_token: token, email: user.email }
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id } })
  }

  async createAdmin(email: string, password: string) {
    const existing = await this.repo.findOne({ where: { email } })
    if (existing) return existing
    const passwordHash = await bcrypt.hash(password, 10)
    return this.repo.save(this.repo.create({ email, passwordHash }))
  }
}
