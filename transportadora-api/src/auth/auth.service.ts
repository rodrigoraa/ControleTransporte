import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

type LoginAttempt = { count: number; blockedUntil?: number; firstAttemptAt: number };

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    this.assertLoginAllowed(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = user ? await bcrypt.compare(dto.senha, user.senha) : false;
    if (!user || !valid || !user.ativo) {
      this.registerFailedAttempt(email);
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    this.attempts.delete(email);

    const payload = { sub: user.id, email: user.email, perfil: user.perfil };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '8h',
    });
    const { senha, ...safeUser } = user;
    return { accessToken: token, user: safeUser };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) {
      return { message: 'Se o e-mail existir, as instruções de recuperação serão enviadas.' };
    }

    const temporaryPassword = this.generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { senha: await bcrypt.hash(temporaryPassword, 10) },
    });
    await this.prisma.auditoria.create({
      data: {
        entidade: 'User',
        entidadeId: user.id,
        acao: 'RECUPERACAO_SENHA',
        dadosDepois: { email: user.email },
      },
    });

    const response: Record<string, string> = {
      message: 'Senha temporária gerada. Altere a senha após entrar.',
    };
    if (this.config.get('NODE_ENV') !== 'production') response.temporaryPassword = temporaryPassword;
    return response;
  }

  private assertLoginAllowed(email: string) {
    const attempt = this.attempts.get(email.toLowerCase());
    if (attempt?.blockedUntil && attempt.blockedUntil > Date.now()) {
      throw new HttpException('Muitas tentativas de login. Aguarde alguns minutos e tente novamente.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private registerFailedAttempt(email: string) {
    const key = this.normalizeEmail(email);
    const now = Date.now();
    const current = this.attempts.get(key);
    const attempt = current && now - current.firstAttemptAt < 10 * 60 * 1000
      ? { ...current, count: current.count + 1 }
      : { count: 1, firstAttemptAt: now };

    if (attempt.count >= 5) {
      attempt.blockedUntil = now + 10 * 60 * 1000;
    }

    this.attempts.set(key, attempt);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateTemporaryPassword() {
    return `Tmp${randomBytes(6).toString('base64url')}!${randomBytes(1).readUInt8()}`;
  }
}




