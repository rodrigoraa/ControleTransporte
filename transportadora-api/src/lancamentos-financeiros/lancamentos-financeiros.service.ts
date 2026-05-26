import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoLancamento } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { CrudService } from '../common/crud/crud.service';
import { PaginationDto } from '../common/crud/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLancamentoFinanceiroDto } from './dto/create-lancamento-financeiro.dto';
import { UpdateLancamentoFinanceiroDto } from './dto/update-lancamento-financeiro.dto';

@Injectable()
export class LancamentosFinanceirosService extends CrudService<CreateLancamentoFinanceiroDto, UpdateLancamentoFinanceiroDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'lancamentoFinanceiro', ['placa', 'descricao'], {
      motorista: true,
      fornecedor: true,
      cavaloMecanico: true,
      conjunto: { include: { cavaloMecanico: true, implementos: { include: { implemento: true } } } },
      implemento: true,
      cliente: true,
      categoriaFinanceira: true,
    });
  }

  async create(dto: CreateLancamentoFinanceiroDto) {
    const data = await this.prepareData(this.cleanData(dto));
    const created = await this.repo.create({
      data: { ...data, valorTotal: new Prisma.Decimal(dto.quantidade).mul(dto.valorUnitario) },
      include: {
        motorista: true,
        fornecedor: true,
        cavaloMecanico: true,
        conjunto: true,
        implemento: true,
        cliente: true,
        categoriaFinanceira: true,
      },
    });
    await this.audit('CRIACAO', created?.id, null, created);
    return created;
  }

  protected normalizeUpdate(dto: UpdateLancamentoFinanceiroDto) {
    return dto;
  }

  async update(id: string, dto: UpdateLancamentoFinanceiroDto) {
    const current = await this.findOne(id);
    const quantidade = dto.quantidade ?? Number(current.quantidade);
    const valorUnitario = dto.valorUnitario ?? Number(current.valorUnitario);
    const data = Object.fromEntries(
      Object.entries(dto).map(([key, value]) => {
        if (value === '') return [key, null];
        if (key === 'data' && typeof value === 'string') return [key, new Date(`${value}T00:00:00.000Z`)];
        return [key, value];
      }),
    );
    const partyFields = this.applyBusinessRules({
      tipoLancamento: data.tipoLancamento ?? current.tipoLancamento,
      fornecedorId: data.fornecedorId ?? current.fornecedorId,
      clienteId: data.clienteId ?? current.clienteId,
    });
    const frota = await this.resolveFrotaFields(data, current);

    const updated = await this.repo.update({
      where: { id },
      data: {
        ...data,
        placa: frota.placa,
        fornecedorId: partyFields.fornecedorId,
        clienteId: partyFields.clienteId,
        cavaloMecanicoId: frota.cavaloMecanicoId,
        conjuntoId: frota.conjuntoId,
        valorTotal: new Prisma.Decimal(quantidade).mul(valorUnitario),
      },
      include: {
        motorista: true,
        fornecedor: true,
        cavaloMecanico: true,
        conjunto: true,
        implemento: true,
        cliente: true,
        categoriaFinanceira: true,
      },
    });
    await this.audit('ATUALIZACAO', id, current, updated);
    return updated;
  }

  private async prepareData(dto: CreateLancamentoFinanceiroDto) {
    const data = this.applyBusinessRules(dto);
    const frota = await this.resolveFrotaFields(data);
    return {
      ...data,
      placa: frota.placa,
      cavaloMecanicoId: frota.cavaloMecanicoId,
      conjuntoId: frota.conjuntoId,
    };
  }

  private cleanData<T extends Record<string, any>>(dto: T): T {
    return Object.fromEntries(
      Object.entries(dto).map(([key, value]) => {
        if (value === '') return [key, null];
        if (key === 'data' && typeof value === 'string') return [key, new Date(`${value}T00:00:00.000Z`)];
        return [key, value];
      }),
    ) as T;
  }

  private async resolveFrotaFields(data: any, current?: any) {
    if (data.conjuntoId) {
      const conjunto = await this.prisma.conjunto.findUnique({
        where: { id: data.conjuntoId },
        include: { cavaloMecanico: true },
      });
      if (!conjunto) throw new BadRequestException('Conjunto operacional nao encontrado.');
      return {
        placa: conjunto.cavaloMecanico.placa,
        cavaloMecanicoId: conjunto.cavaloMecanicoId,
        conjuntoId: conjunto.id,
      };
    }

    if (data.cavaloMecanicoId) {
      const cavalo = await this.prisma.cavaloMecanico.findUnique({
        where: { id: data.cavaloMecanicoId },
        include: {
          conjuntos: {
            where: { status: 'ATIVO' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!cavalo) throw new BadRequestException('Cavalo mecanico nao encontrado.');
      return { placa: cavalo.placa, cavaloMecanicoId: cavalo.id, conjuntoId: cavalo.conjuntos?.[0]?.id || null };
    }

    if (data.placa) {
      const cavalo = await this.prisma.cavaloMecanico.findUnique({
        where: { placa: data.placa },
        include: {
          conjuntos: {
            where: { status: 'ATIVO' },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!cavalo) throw new BadRequestException('Cavalo mecanico nao encontrado para a placa informada.');
      return { placa: cavalo.placa, cavaloMecanicoId: cavalo.id, conjuntoId: cavalo.conjuntos?.[0]?.id || null };
    }

    if (current?.cavaloMecanicoId || current?.placa) {
      return { placa: current.placa, cavaloMecanicoId: current.cavaloMecanicoId, conjuntoId: current.conjuntoId };
    }

    throw new BadRequestException('Informe um conjunto operacional ou um cavalo mecanico para o lancamento.');
  }

  protected buildWhere(query: PaginationDto & Record<string, any>) {
    const where = super.buildWhere(query);
    if (query.dataInicial || query.dataFinal) {
      where.data = {};
      if (query.dataInicial) where.data.gte = new Date(query.dataInicial);
      if (query.dataFinal) where.data.lte = new Date(query.dataFinal);
    }
    for (const field of ['motoristaId', 'caminhaoId', 'cavaloMecanicoId', 'conjuntoId', 'implementoId', 'fornecedorId', 'clienteId', 'categoriaId']) {
      if (query[field]) where[field] = query[field];
    }
    if (query.tipoLancamento) where.tipoLancamento = query.tipoLancamento as TipoLancamento;
    if (query.placa) where.placa = { contains: query.placa, mode: 'insensitive' };
    return where;
  }

  private applyBusinessRules(data: any) {
    const normalized = { ...data };

    if (normalized.tipoLancamento === TipoLancamento.DESPESA) {
      if (!normalized.fornecedorId) {
        throw new BadRequestException('Despesa deve ter fornecedor.');
      }
      normalized.clienteId = null;
    }

    if (normalized.tipoLancamento === TipoLancamento.FATURAMENTO) {
      if (!normalized.clienteId) {
        throw new BadRequestException('Faturamento deve ter cliente.');
      }
      normalized.fornecedorId = null;
    }

    return normalized;
  }
}
