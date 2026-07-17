import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerfilUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditActor, auditUserId } from '../common/audit/audit-context';
import { PaginationDto } from '../common/crud/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private safe(user: any) {
    const { senha: _senha, ...rest } = user;
    return { ...rest, protegido: this.isEnvironmentAdmin(user.email) };
  }

  async create(dto: CreateUserDto, actor?: AuditActor) {
    const email = this.normalizeEmail(dto.email);
    const exists = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado. Use outro e-mail ou edite o usuário existente.');
    const user = await this.prisma.user.create({
      data: {
        ...dto,
        email,
        senha: await bcrypt.hash(dto.senha, this.bcryptRounds()),
      },
    });
    await this.prisma.auditoria.create({
      data: { entidade: 'User', entidadeId: user.id, acao: 'CRIACAO', usuarioId: auditUserId(actor), dadosDepois: this.safe(user) },
    });
    return this.safe(user);
  }

  async findAll(query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = query.search
      ? {
          OR: [
            { nome: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { nome: 'asc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data: data.map((user) => this.safe(user)), total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.safe(user);
  }

  async update(id: string, dto: UpdateUserDto, actor?: AuditActor) {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Usuário não encontrado.');
    this.assertMutable(current.email);
    await this.assertAdminContinuity(current, dto);

    const data = { ...dto } as any;
    if (dto.email) {
      data.email = this.normalizeEmail(dto.email);
      const duplicate = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          email: { equals: data.email, mode: 'insensitive' },
        },
      });
      if (duplicate) throw new ConflictException('E-mail já cadastrado em outro usuário.');
    }
    if (dto.senha) data.senha = await bcrypt.hash(dto.senha, this.bcryptRounds());

    const before = this.safe(current);
    const user = await this.prisma.user.update({ where: { id }, data });
    await this.prisma.auditoria.create({
      data: { entidade: 'User', entidadeId: id, acao: 'ATUALIZACAO', usuarioId: auditUserId(actor), dadosAntes: before, dadosDepois: this.safe(user) },
    });
    return this.safe(user);
  }

  async remove(id: string, actor?: AuditActor) {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Usuário não encontrado.');
    this.assertMutable(current.email);
    await this.assertAdminContinuity(current, { ativo: false });

    const before = this.safe(current);
    await this.prisma.user.delete({ where: { id } });
    await this.prisma.auditoria.create({
      data: { entidade: 'User', entidadeId: id, acao: 'EXCLUSAO', usuarioId: auditUserId(actor), dadosAntes: before },
    });
    return { message: 'Usuário excluído com sucesso.' };
  }

  private async assertAdminContinuity(
    current: { perfil: PerfilUsuario; ativo: boolean },
    changes: Pick<UpdateUserDto, 'perfil' | 'ativo'>,
  ) {
    const removesActiveAdmin =
      current.perfil === PerfilUsuario.ADMIN &&
      current.ativo &&
      (changes.perfil === PerfilUsuario.USUARIO || changes.ativo === false);
    if (!removesActiveAdmin) return;

    const activeAdmins = await this.prisma.user.count({
      where: { perfil: PerfilUsuario.ADMIN, ativo: true },
    });
    if (activeAdmins <= 1) {
      throw new ConflictException('Não é possível remover ou desativar o último administrador ativo.');
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private assertMutable(email: string) {
    if (this.isEnvironmentAdmin(email)) {
      throw new ConflictException('Este usuário é protegido pelas variáveis de ambiente e não pode ser alterado ou excluído pelo sistema.');
    }
  }

  private isEnvironmentAdmin(email: string) {
    const environmentAdminEmail = String(this.config.get('ADMIN_EMAIL') || '').trim().toLowerCase();
    return Boolean(environmentAdminEmail) && this.normalizeEmail(email) === environmentAdminEmail;
  }

  private bcryptRounds() {
    return this.config.get<number>('BCRYPT_ROUNDS') || 12;
  }
}
