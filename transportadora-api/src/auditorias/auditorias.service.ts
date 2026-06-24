import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../common/crud/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';

type AuditoriaRecord = Prisma.AuditoriaGetPayload<object>;

type AuditUser = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
};

type AuditChangeType = 'ADICIONADO' | 'ALTERADO' | 'REMOVIDO';

type AuditChange = {
  campo: string;
  label: string;
  tipo: AuditChangeType;
  antes: unknown;
  depois: unknown;
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'Usuário',
  cliente: 'Cliente',
  motorista: 'Motorista',
  caminhao: 'Caminhão',
  cavaloMecanico: 'Cavalo mecânico',
  implemento: 'Implemento',
  conjunto: 'Conjunto operacional',
  fornecedor: 'Fornecedor',
  categoriaFinanceira: 'Categoria financeira',
  lancamentoFinanceiro: 'Lançamento financeiro',
};

const ACTION_LABELS: Record<string, string> = {
  CRIACAO: 'Criação',
  CRIACAO_COMPLETA: 'Criação completa',
  ATUALIZACAO: 'Atualização',
  ATUALIZACAO_COMPOSICAO: 'Atualização da composição',
  HISTORICO_CAVALO_MECANICO: 'Histórico do cavalo mecânico',
  EXCLUSAO: 'Exclusão',
  RECUPERACAO_SENHA: 'Recuperação de senha',
};

const IGNORED_DIFF_FIELDS = new Set(['createdAt', 'updatedAt']);
const MAX_DIFF_DEPTH = 4;

@Injectable()
export class AuditoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto & Record<string, string>) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const where = await this.buildWhere(query);

    const [data, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    const usersById = await this.usersById(data.map((item) => item.usuarioId).filter(Boolean) as string[]);

    return {
      data: data.map((item) => this.enrich(item, item.usuarioId ? usersById.get(item.usuarioId) : undefined)),
      total,
      page,
      limit,
    };
  }

  private async buildWhere(query: PaginationDto & Record<string, string>) {
    const where: Prisma.AuditoriaWhereInput = {};

    if (query.entidade) where.entidade = query.entidade;
    if (query.acao) where.acao = query.acao;
    if (query.usuarioId) where.usuarioId = query.usuarioId;
    if (query.entidadeId) where.entidadeId = query.entidadeId;
    if (query.dataInicial || query.dataFinal) {
      where.createdAt = {};
      if (query.dataInicial) where.createdAt.gte = new Date(`${query.dataInicial}T00:00:00.000Z`);
      if (query.dataFinal) where.createdAt.lte = new Date(`${query.dataFinal}T23:59:59.999Z`);
    }

    const search = query.search?.trim();
    if (search) {
      const matchingUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { nome: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      const matchingUserIds = matchingUsers.map((user) => user.id);
      where.OR = [
        { entidade: { contains: search, mode: 'insensitive' } },
        { entidadeId: { contains: search, mode: 'insensitive' } },
        { acao: { contains: search, mode: 'insensitive' } },
        { usuarioId: { contains: search, mode: 'insensitive' } },
        ...(matchingUserIds.length ? [{ usuarioId: { in: matchingUserIds } }] : []),
      ];
    }

    return where;
  }

  private async usersById(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (!uniqueIds.length) return new Map<string, AuditUser>();

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, nome: true, email: true, perfil: true },
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private enrich(item: AuditoriaRecord, user?: AuditUser) {
    const dadosAntes = this.sanitizeJson(item.dadosAntes);
    const dadosDepois = this.sanitizeJson(item.dadosDepois);
    const alteracoes = this.diff(dadosAntes, dadosDepois);
    const registroLabel = this.recordLabel(dadosDepois ?? dadosAntes, item.entidadeId);

    return {
      ...item,
      dadosAntes,
      dadosDepois,
      usuario: user || null,
      entidadeLabel: this.entityLabel(item.entidade),
      acaoLabel: this.actionLabel(item.acao),
      registroLabel,
      resumo: this.summary(item, alteracoes, registroLabel, user),
      alteracoes,
      totalAlteracoes: alteracoes.length,
    };
  }

  private summary(item: AuditoriaRecord, changes: AuditChange[], registroLabel: string, user?: AuditUser) {
    const actor = user?.nome || 'Sistema';
    const entity = this.entityLabel(item.entidade).toLowerCase();
    const target = registroLabel && registroLabel !== item.entidadeId ? ` ${registroLabel}` : '';

    if (item.acao.startsWith('CRIACAO')) return `${actor} criou ${entity}${target}.`;
    if (item.acao === 'EXCLUSAO') return `${actor} excluiu ${entity}${target}.`;
    if (item.acao === 'RECUPERACAO_SENHA') return `${actor} registrou recuperação de senha${target}.`;
    if (changes.length) {
      const fields = changes.slice(0, 3).map((change) => change.label).join(', ');
      const suffix = changes.length > 3 ? ` e mais ${changes.length - 3}` : '';
      return `${actor} alterou ${changes.length} campo(s) em ${entity}${target}: ${fields}${suffix}.`;
    }
    return `${actor} registrou ${this.actionLabel(item.acao).toLowerCase()} em ${entity}${target}.`;
  }

  private diff(before: unknown, after: unknown, path: string[] = []): AuditChange[] {
    if (this.valuesEqual(before, after)) return [];

    if (this.shouldTraverse(before, after, path)) {
      const beforeObject = this.isPlainObject(before) ? before : {};
      const afterObject = this.isPlainObject(after) ? after : {};
      const keys = [...new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])]
        .filter((key) => !IGNORED_DIFF_FIELDS.has(key))
        .sort((left, right) => left.localeCompare(right));

      return keys.flatMap((key) => this.diff((beforeObject as Record<string, unknown>)[key], (afterObject as Record<string, unknown>)[key], [...path, key]));
    }

    const fieldPath = path.join('.') || 'registro';
    return [
      {
        campo: fieldPath,
        label: this.fieldLabel(path),
        tipo: this.changeType(before, after),
        antes: before === undefined ? null : before,
        depois: after === undefined ? null : after,
      },
    ];
  }

  private shouldTraverse(before: unknown, after: unknown, path: string[]) {
    if (path.length >= MAX_DIFF_DEPTH) return false;
    if (Array.isArray(before) || Array.isArray(after)) return false;
    return this.isPlainObject(before) || this.isPlainObject(after);
  }

  private changeType(before: unknown, after: unknown): AuditChangeType {
    if (before === undefined || before === null) return 'ADICIONADO';
    if (after === undefined || after === null) return 'REMOVIDO';
    return 'ALTERADO';
  }

  private fieldLabel(path: string[]) {
    if (!path.length) return 'Registro completo';
    return path
      .map((part) =>
        part
          .replace(/Id$/, ' ID')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/_/g, ' ')
          .toLowerCase(),
      )
      .join(' / ');
  }

  private valuesEqual(left: unknown, right: unknown) {
    return JSON.stringify(this.sortValue(left)) === JSON.stringify(this.sortValue(right));
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortValue(item));
    if (!this.isPlainObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, this.sortValue(item)]),
    );
  }

  private sanitizeJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeJson(item));
    if (!this.isPlainObject(value)) return value ?? null;

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (this.isSensitiveKey(key)) return [key, '[protegido]'];
        return [key, this.sanitizeJson(item)];
      }),
    );
  }

  private isSensitiveKey(key: string) {
    const normalized = key.toLowerCase();
    return normalized.includes('senha') || normalized.includes('password') || normalized.includes('token') || normalized.includes('secret');
  }

  private recordLabel(value: unknown, fallback?: string | null) {
    if (!this.isPlainObject(value)) return fallback || '-';
    const fields = ['nome', 'placa', 'email', 'documento', 'descricao', 'id'];
    for (const field of fields) {
      const fieldValue = value[field];
      if (typeof fieldValue === 'string' && fieldValue.trim()) return fieldValue;
    }
    const cavalo = value.cavalo;
    if (this.isPlainObject(cavalo) && typeof cavalo.placa === 'string') return cavalo.placa;
    return fallback || '-';
  }

  private entityLabel(entity: string) {
    return ENTITY_LABELS[entity] || this.fallbackLabel(entity);
  }

  private actionLabel(action: string) {
    return ACTION_LABELS[action] || this.fallbackLabel(action);
  }

  private fallbackLabel(value: string) {
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/^\w/, (letter) => letter.toUpperCase());
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
