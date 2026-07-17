import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    const valid = user ? await bcrypt.compare(dto.senha, user.senha) : false;
    if (!user || !valid || !user.ativo) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      perfil: user.perfil,
      version: user.updatedAt.toISOString(),
    };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '8h',
    });
    const { senha: _senha, ...safeUser } = user;
    return { accessToken: token, user: safeUser };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    if (!this.insecurePasswordRecoveryAllowed()) {
      return {
        available: false,
        message: 'Recuperação automática indisponível. Solicite a redefinição da senha a um administrador.',
      };
    }

    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user || !user.ativo) {
      return {
        available: true,
        message: 'Se o e-mail existir, uma senha temporária será gerada.',
      };
    }

    if (this.isEnvironmentAdmin(user.email)) {
      return {
        available: false,
        message: 'A senha deste usuário é gerenciada pelas variáveis de ambiente.',
      };
    }

    const temporaryPassword = this.generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { senha: await bcrypt.hash(temporaryPassword, this.bcryptRounds()) },
    });
    await this.prisma.auditoria.create({
      data: {
        entidade: 'User',
        entidadeId: user.id,
        acao: 'RECUPERACAO_SENHA',
        dadosDepois: { email: user.email },
      },
    });

    return {
      available: true,
      message: 'Senha temporária gerada. Altere a senha após entrar.',
      temporaryPassword,
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateTemporaryPassword() {
    return `Tmp${randomBytes(6).toString('base64url')}!${randomBytes(1).readUInt8()}`;
  }

  private bcryptRounds() {
    return this.config.get<number>('BCRYPT_ROUNDS') || 12;
  }

  private insecurePasswordRecoveryAllowed() {
    if (this.config.get('NODE_ENV') === 'production') return false;
    return ['1', 'true', 'yes', 'on'].includes(
      String(this.config.get('ALLOW_INSECURE_PASSWORD_RECOVERY') || '').toLowerCase(),
    );
  }

  private isEnvironmentAdmin(email: string) {
    const environmentAdminEmail = String(this.config.get('ADMIN_EMAIL') || '').trim().toLowerCase();
    return Boolean(environmentAdminEmail) && this.normalizeEmail(email) === environmentAdminEmail;
  }
}
