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
    super(prisma, 'lancamentoFinanceiro', ['placaOuPessoa', 'descricao'], {
      motorista: true,
      fornecedor: true,
      caminhao: true,
      cliente: true,
      categoriaFinanceira: true,
    });
  }

  async create(dto: CreateLancamentoFinanceiroDto) {
    const data = await this.prepareData(this.cleanData(dto));
    return this.repo.create({
      data: { ...data, valorTotal: new Prisma.Decimal(dto.quantidade).mul(dto.valorUnitario) },
      include: {
        motorista: true,
        fornecedor: true,
        caminhao: true,
        cliente: true,
        categoriaFinanceira: true,
      },
    });
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
    const caminhaoId = data.placaOuPessoa ? await this.findCaminhaoIdByPlaca(data.placaOuPessoa as string) : data.caminhaoId;

    return this.repo.update({
      where: { id },
      data: {
        ...data,
        fornecedorId: partyFields.fornecedorId,
        clienteId: partyFields.clienteId,
        caminhaoId,
        valorTotal: new Prisma.Decimal(quantidade).mul(valorUnitario),
      },
      include: {
        motorista: true,
        fornecedor: true,
        caminhao: true,
        cliente: true,
        categoriaFinanceira: true,
      },
    });
  }

  private async prepareData(dto: CreateLancamentoFinanceiroDto) {
    const data = this.applyBusinessRules(dto);
    return {
      ...data,
      caminhaoId: await this.findCaminhaoIdByPlaca(dto.placaOuPessoa),
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

  private async findCaminhaoIdByPlaca(placa: string) {
    const caminhao = await this.prisma.caminhao.findUnique({ where: { placa } });
    return caminhao?.id || null;
  }

  protected buildWhere(query: PaginationDto & Record<string, any>) {
    const where = super.buildWhere(query);
    if (query.dataInicial || query.dataFinal) {
      where.data = {};
      if (query.dataInicial) where.data.gte = new Date(query.dataInicial);
      if (query.dataFinal) where.data.lte = new Date(query.dataFinal);
    }
    for (const field of ['motoristaId', 'caminhaoId', 'fornecedorId', 'clienteId', 'categoria', 'categoriaId']) {
      if (query[field]) where[field] = query[field];
    }
    if (query.tipoLancamento) where.tipoLancamento = query.tipoLancamento as TipoLancamento;
    if (query.placa) where.placaOuPessoa = { contains: query.placa, mode: 'insensitive' };
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
