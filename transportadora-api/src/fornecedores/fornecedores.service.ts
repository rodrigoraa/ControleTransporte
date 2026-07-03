import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

@Injectable()
export class FornecedoresService extends CrudService<CreateFornecedorDto, UpdateFornecedorDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'fornecedor', ['nome', 'documento', 'telefone', 'email']);
  }

  async create(dto: CreateFornecedorDto, actor?: AuditActor) {
    const criado = await super.create(dto, actor);
    await this.prisma.historicoFornecedor.create({
      data: {
        fornecedorId: criado.id,
        acao: 'CRIACAO',
        dadosDepois: JSON.parse(JSON.stringify(criado)),
        observacoes: 'Criação de fornecedor registrada automaticamente',
      },
    });
    return criado;
  }

  async update(id: string, dto: UpdateFornecedorDto, actor?: AuditActor) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto, actor);
    await this.prisma.historicoFornecedor.create({
      data: {
        fornecedorId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteração de fornecedor registrada automaticamente',
      },
    });
    return depois;
  }

  async remove(id: string, actor?: AuditActor) {
    const totalLancamentos = await this.prisma.lancamentoFinanceiro.count({ where: { fornecedorId: id } });
    if (totalLancamentos > 0) {
      throw new BadRequestException('Não foi possível excluir: fornecedor possui despesas vinculadas ao histórico.');
    }
    return super.remove(id, actor);
  }

  async historico(id: string) {
    await this.findOne(id);
    const [alteracoes, lancamentos] = await Promise.all([
      this.prisma.historicoFornecedor.findMany({
        where: { fornecedorId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        where: { fornecedorId: id },
        include: { motorista: true, cavaloMecanico: true, conjunto: true, categoriaFinanceira: true },
        orderBy: { data: 'desc' },
      }),
    ]);

    return {
      alteracoes,
      lancamentos,
      totais: this.totaisLancamentos(lancamentos),
    };
  }

  private totaisLancamentos(lancamentos: Array<{ tipoLancamento: string; valorTotal: unknown }>) {
    return lancamentos.reduce(
      (totais, item) => {
        const valor = Number(item.valorTotal || 0);
        if (item.tipoLancamento === 'DESPESA') totais.totalDespesas += valor;
        if (item.tipoLancamento === 'FATURAMENTO') totais.totalFaturamento += valor;
        totais.saldo = totais.totalFaturamento - totais.totalDespesas;
        return totais;
      },
      { totalDespesas: 0, totalFaturamento: 0, saldo: 0 },
    );
  }
}
