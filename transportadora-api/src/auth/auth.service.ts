import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = user ? await bcrypt.compare(dto.senha, user.senha) : false;
    if (!user || !valid || !user.ativo) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const payload = { sub: user.id, email: user.email, perfil: user.perfil };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '8h',
    });
    const { senha, ...safeUser } = user;
    return { accessToken: token, user: safeUser };
  }
}
