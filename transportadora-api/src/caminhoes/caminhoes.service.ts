import { Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCaminhaoDto } from './dto/create-caminhao.dto';
import { UpdateCaminhaoDto } from './dto/update-caminhao.dto';

@Injectable()
export class CaminhoesService extends CrudService<CreateCaminhaoDto, UpdateCaminhaoDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'cavaloMecanico', ['placa', 'marca', 'modelo'], { motorista: true });
  }

  async update(id: string, dto: UpdateCaminhaoDto) {
    const antes = await this.findOne(id);
    const depois = await super.update(id, dto);
    await this.prisma.historicoCavaloMecanico.create({
      data: {
        cavaloMecanicoId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteracao de cavalo mecanico registrada automaticamente',
      },
    });
    if ((antes as any).motoristaId !== (depois as any).motoristaId) {
      await this.registrarHistoricoMotorista((antes as any).motoristaId, 'REMOCAO_CAVALO', antes, depois);
      await this.registrarHistoricoMotorista((depois as any).motoristaId, 'VINCULO_CAVALO', antes, depois);
    }
    await this.audit('HISTORICO_CAVALO_MECANICO', id, antes, depois);
    return depois;
  }

  async historico(id: string) {
    await this.findOne(id);
    const [alteracoes, conjuntosAtuais, lancamentos, historicosConjuntos] = await Promise.all([
      this.prisma.historicoCavaloMecanico.findMany({
        where: { cavaloMecanicoId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.conjunto.findMany({
        where: { cavaloMecanicoId: id },
        include: { implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.lancamentoFinanceiro.findMany({
        where: { cavaloMecanicoId: id },
        include: { motorista: true, fornecedor: true, cliente: true, categoriaFinanceira: true, conjunto: true },
        orderBy: { data: 'desc' },
      }),
      this.prisma.historicoConjuntoOperacional.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const historicoEngates = historicosConjuntos.filter((item) => {
      const antes = item.dadosAntes as any;
      const depois = item.dadosDepois as any;
      return antes?.cavaloMecanicoId === id || depois?.cavaloMecanicoId === id;
    });

    return {
      alteracoes,
      conjuntosAtuais,
      historicoEngates,
      lancamentos,
      totais: this.totaisLancamentos(lancamentos),
    };
  }

  private async registrarHistoricoMotorista(motoristaId: string | null | undefined, acao: string, antes: unknown, depois: unknown) {
    if (!motoristaId) return;
    await this.prisma.historicoMotorista.create({
      data: {
        motoristaId,
        acao,
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Vinculo de cavalo mecanico registrado automaticamente',
      },
    });
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
