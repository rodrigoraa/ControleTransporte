import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService extends CrudService<CreateClienteDto, UpdateClienteDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'cliente', ['nome', 'documento', 'telefone', 'email']);
  }

  async create(dto: CreateClienteDto, actor?: AuditActor) {
    const criado = await super.create(dto, actor);
    await this.prisma.historicoCliente.create({
      data: {
        clienteId: criado.id,
        acao: 'CRIACAO',
        dadosDepois: JSON.parse(JSON.stringify(criado)),
        observacoes: 'Criacao de cliente registrada automaticamente',
      },
    });
    return criado;
  }

  async update(id: string, dto: UpdateClienteDto, actor?: AuditActor) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto, actor);
    await this.prisma.historicoCliente.create({
      data: {
        clienteId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteração de cliente registrada automaticamente',
      },
    });
    return depois;
  }

  async remove(id: string, actor?: AuditActor) {
    const totalLancamentos = await this.prisma.lancamentoFinanceiro.count({ where: { clienteId: id } });
    if (totalLancamentos > 0) {
      throw new BadRequestException('Não foi possível excluir: cliente possui faturamentos vinculados ao histórico.');
    }
    return super.remove(id, actor);
  }

  async historico(id: string) {
    await this.findOne(id);
    const [alteracoes, lancamentos] = await Promise.all([
      this.prisma.historicoCliente.findMany({
        where: { clienteId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        where: { clienteId: id },
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
