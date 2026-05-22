import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from './pagination.dto';

type CrudModel =
  | 'cliente'
  | 'motorista'
  | 'caminhao'
  | 'cavaloMecanico'
  | 'implemento'
  | 'conjunto'
  | 'fornecedor'
  | 'categoriaFinanceira'
  | 'lancamentoFinanceiro';

@Injectable()
export abstract class CrudService<CreateDto extends object, UpdateDto extends object> {
  protected constructor(
    protected readonly prisma: PrismaService,
    private readonly model: CrudModel,
    private readonly searchFields: string[],
    protected readonly include?: object,
  ) {}

  protected get repo(): any {
    return (this.prisma as any)[this.model];
  }

  protected buildWhere(query: PaginationDto & Record<string, any>) {
    const where: any = {};
    if (query.search && this.searchFields.length) {
      where.OR = this.searchFields.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
    }
    return where;
  }

  protected normalizeCreate(dto: CreateDto): any {
    return dto;
  }

  protected normalizeUpdate(dto: UpdateDto): any {
    return dto;
  }

  private emptyStringsToNull(data: any): any {
    const dateFields = new Set(['data', 'dataAdmissao', 'validadeCnh', 'dataInicio', 'dataFim', 'dataColocacaoConjunto', 'dataRemocaoConjunto']);
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        if (value === '') return [key, null];
        if (typeof value === 'string' && dateFields.has(key)) {
          return [key, new Date(`${value}T00:00:00.000Z`)];
        }
        return [key, value];
      }),
    );
  }

  private handlePrismaError(error: unknown): never {
    const prismaError = error as Prisma.PrismaClientKnownRequestError & { code?: string; meta?: { target?: unknown } };

    if (prismaError?.code) {
      if (prismaError.code === 'P2002') {
        const fields = Array.isArray(prismaError.meta?.target) ? prismaError.meta.target.join(', ') : 'campo unico';
        throw new ConflictException(`Ja existe um registro com este valor em: ${fields}`);
      }

      if (prismaError.code === 'P2003') {
        throw new BadRequestException('Registro relacionado nao encontrado ou nao pode ser removido.');
      }

      if (prismaError.code === 'P2025') {
        throw new NotFoundException('Registro nao encontrado');
      }
    }

    if ((error as Error)?.name === 'PrismaClientValidationError') {
      throw new BadRequestException('Dados invalidos. Verifique datas, numeros e campos obrigatorios.');
    }

    throw error;
  }

  async create(dto: CreateDto) {
    try {
      const created = await this.repo.create({ data: this.normalizeCreate(this.emptyStringsToNull(dto) as CreateDto), include: this.include });
      await this.audit('CRIACAO', created?.id, null, created);
      return created;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = this.buildWhere(query as any);
    const [data, total] = await Promise.all([
      this.repo.findMany({
        where,
        include: this.include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.repo.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const item = await this.repo.findUnique({ where: { id }, include: this.include });
    if (!item) throw new NotFoundException('Registro nao encontrado');
    return item;
  }

  async update(id: string, dto: UpdateDto) {
    const before = await this.findOne(id);
    try {
      const updated = await this.repo.update({ where: { id }, data: this.normalizeUpdate(this.emptyStringsToNull(dto) as UpdateDto), include: this.include });
      await this.audit('ATUALIZACAO', id, before, updated);
      return updated;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string) {
    const before = await this.findOne(id);
    try {
      await this.repo.delete({ where: { id } });
      await this.audit('EXCLUSAO', id, before, null);
      return { message: 'Registro excluido com sucesso' };
    } catch {
      throw new BadRequestException('Nao foi possivel excluir: registro possui vinculos');
    }
  }

  protected async audit(acao: string, entidadeId?: string | null, dadosAntes?: unknown, dadosDepois?: unknown) {
    try {
      await this.prisma.auditoria.create({
        data: {
          entidade: this.model,
          entidadeId: entidadeId || null,
          acao,
          dadosAntes: dadosAntes == null ? undefined : JSON.parse(JSON.stringify(dadosAntes)),
          dadosDepois: dadosDepois == null ? undefined : JSON.parse(JSON.stringify(dadosDepois)),
        },
      });
    } catch {
      // Auditoria nao deve bloquear a operacao principal.
    }
  }
}
