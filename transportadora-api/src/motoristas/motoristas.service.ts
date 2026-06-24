import { Injectable } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMotoristaDto } from './dto/create-motorista.dto';
import { UpdateMotoristaDto } from './dto/update-motorista.dto';

@Injectable()
export class MotoristasService extends CrudService<CreateMotoristaDto, UpdateMotoristaDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'motorista', ['nome', 'cpf', 'cnh', 'telefone']);
  }

  async update(id: string, dto: UpdateMotoristaDto, actor?: AuditActor) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto, actor);
    await this.prisma.historicoMotorista.create({
      data: {
        motoristaId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteração registrada automaticamente',
      },
    });
    return depois;
  }

  async historico(id: string) {
    await this.findOne(id);
    const [alteracoes, cavalosAtuais, lancamentos, historicosCavalos] = await Promise.all([
      this.prisma.historicoMotorista.findMany({
        where: { motoristaId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cavaloMecanico.findMany({
        where: { motoristaId: id },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        where: { motoristaId: id },
        include: { cavaloMecanico: true, conjunto: true, fornecedor: true, cliente: true, categoriaFinanceira: true },
        orderBy: { data: 'desc' },
      }),
      this.prisma.historicoCavaloMecanico.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const historicoCavalos = historicosCavalos.filter((item) => {
      const antes = item.dadosAntes as any;
      const depois = item.dadosDepois as any;
      return antes?.motoristaId === id || depois?.motoristaId === id;
    });

    return {
      alteracoes,
      cavalosAtuais,
      historicoCavalos,
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
