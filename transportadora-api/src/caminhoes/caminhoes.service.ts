import { Injectable } from '@nestjs/common';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ComposicoesCavaloService } from './composicoes-cavalo.service';
import { CreateCaminhaoDto } from './dto/create-caminhao.dto';
import { UpdateCaminhaoDto } from './dto/update-caminhao.dto';

@Injectable()
export class CaminhoesService extends CrudService<CreateCaminhaoDto, UpdateCaminhaoDto> {
  constructor(
    prisma: PrismaService,
    private readonly composicoes: ComposicoesCavaloService,
  ) {
    super(prisma, 'cavaloMecanico', ['placa', 'marca', 'modelo'], {
      motorista: true,
      conjuntos: {
        where: { status: 'ATIVO' },
        include: { implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    });
  }

  async create(dto: CreateCaminhaoDto, actor?: AuditActor) {
    const { implementos = [], conjuntoStatus, conjuntoObservacoes, ...cavaloDto } = dto;

    if (!implementos.length) return super.create(cavaloDto as CreateCaminhaoDto, actor);

    this.composicoes.validateComposition(implementos, cavaloDto.tipoCavalo);

    const created = await this.composicoes.runCompositionTransaction<any>(this.prisma, async (tx) => {
      const cavalo = await tx.cavaloMecanico.create({
        data: this.nullifyEmptyStrings(cavaloDto) as any,
        include: { motorista: true },
      });
      const createdImplementos = await Promise.all(
        implementos.map((implemento) =>
          tx.implemento.create({
            data: {
              ...this.nullifyEmptyStrings(implemento),
              quantidadeEixos: this.composicoes.normalizeImplementoEixos(implemento),
              capacidadeCarga: implemento.capacidadeCarga ?? 0,
            } as any,
          }),
        ),
      );
      const conjunto = await this.composicoes.createConjunto(tx, cavalo, createdImplementos, conjuntoStatus || 'ATIVO', conjuntoObservacoes || null, new Date());

      await tx.historicoCavaloMecanico.create({
        data: {
          cavaloMecanicoId: cavalo.id,
          acao: 'CRIACAO_COM_CONJUNTO',
          dadosDepois: JSON.parse(JSON.stringify({ cavalo, conjunto })),
          observacoes: 'Cadastro completo de cavalo mecânico com implementos',
        },
      });

      return { ...cavalo, conjuntoAtual: conjunto };
    });

    await this.audit('CRIACAO_COMPLETA', created.id, null, created, actor);
    return created;
  }

  async update(id: string, dto: UpdateCaminhaoDto, actor?: AuditActor) {
    if (dto.implementos !== undefined) return this.atualizarComposicao(id, dto, actor);

    const antes = await this.findOne(id);
    const depois = await super.update(id, dto, actor);
    await this.prisma.historicoCavaloMecanico.create({
      data: {
        cavaloMecanicoId: id,
        acao: 'ATUALIZACAO',
        dadosAntes: JSON.parse(JSON.stringify(antes)),
        dadosDepois: JSON.parse(JSON.stringify(depois)),
        observacoes: 'Alteração de cavalo mecânico registrada automaticamente',
      },
    });
    if ((antes as any).motoristaId !== (depois as any).motoristaId) {
      await this.registrarHistoricoMotorista((antes as any).motoristaId, 'REMOCAO_CAVALO', antes, depois);
      await this.registrarHistoricoMotorista((depois as any).motoristaId, 'VINCULO_CAVALO', antes, depois);
    }
    await this.audit('HISTORICO_CAVALO_MECANICO', id, antes, depois, actor);
    return depois;
  }

  async composicaoAtual(id: string) {
    const cavalo = await this.findOne(id);
    return {
      cavalo,
      conjunto: (cavalo as any).conjuntos?.[0] || null,
      implementos: (cavalo as any).conjuntos?.[0]?.implementos || [],
    };
  }

  async remove(id: string, actor?: AuditActor) {
    await this.assertNoRelatedRecords([
      {
        count: this.prisma.lancamentoFinanceiro.count({ where: { cavaloMecanicoId: id } }),
        message: 'Não foi possível excluir: cavalo mecânico possui lançamentos financeiros vinculados ao histórico.',
      },
      {
        count: this.prisma.conjunto.count({ where: { cavaloMecanicoId: id } }),
        message: 'Não foi possível excluir: cavalo mecânico possui composições registradas. Inative o cadastro para preservar os dados.',
      },
      {
        count: this.prisma.historicoCavaloMecanico.count({ where: { cavaloMecanicoId: id } }),
        message: 'Não foi possível excluir: cavalo mecânico possui histórico registrado. Inative o cadastro para preservar os dados.',
      },
    ]);
    return super.remove(id, actor);
  }

  async atualizarComposicao(id: string, dto: UpdateCaminhaoDto, actor?: AuditActor) {
    const antes = await this.findOne(id);
    const { implementos = [], conjuntoStatus, conjuntoObservacoes, ...cavaloDto } = dto;

    if (implementos.length) this.composicoes.validateComposition(implementos, cavaloDto.tipoCavalo ?? (antes as any).tipoCavalo);

    const depois = await this.composicoes.runCompositionTransaction<any>(this.prisma, async (tx) => {
      const cavalo = await tx.cavaloMecanico.update({
        where: { id },
        data: this.nullifyEmptyStrings(cavaloDto) as any,
        include: { motorista: true },
      });

      const activeConjuntos = await tx.conjunto.findMany({
        where: { cavaloMecanicoId: id, status: 'ATIVO' },
        include: { implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      });
      const endedAt = new Date();

      for (const conjunto of activeConjuntos) {
        await tx.conjuntoImplemento.updateMany({
          where: { conjuntoId: conjunto.id, dataFim: null },
          data: { dataFim: endedAt },
        });
        const updatedConjunto = await tx.conjunto.update({
          where: { id: conjunto.id },
          data: {
            status: 'INATIVO',
            nome: `${conjunto.nome} - hist ${endedAt.getTime()}`,
          },
          include: { implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } } },
        });
        await tx.historicoConjuntoOperacional.create({
          data: {
            conjuntoId: conjunto.id,
            acao: 'ENCERRAMENTO_COMPOSICAO',
            dadosAntes: JSON.parse(JSON.stringify(conjunto)),
            dadosDepois: JSON.parse(JSON.stringify(updatedConjunto)),
            observacoes: 'Composição encerrada por alteração no cadastro do cavalo mecânico',
          },
        });
      }

      const currentImplementos = await Promise.all(
        implementos.map((implemento) => {
          const data = {
            ...this.nullifyEmptyStrings(implemento),
            quantidadeEixos: this.composicoes.normalizeImplementoEixos(implemento),
            capacidadeCarga: implemento.capacidadeCarga ?? 0,
          } as any;
          if (implemento.id) {
            const { id: implementoId, ...updateData } = data;
            return tx.implemento.update({ where: { id: implementoId }, data: updateData });
          }
          return tx.implemento.create({ data });
        }),
      );

      const conjunto = currentImplementos.length
        ? await this.composicoes.createConjunto(tx, cavalo, currentImplementos, conjuntoStatus || 'ATIVO', conjuntoObservacoes || null, endedAt)
        : null;

      const current = await tx.cavaloMecanico.findUniqueOrThrow({
        where: { id },
        include: {
          motorista: true,
          conjuntos: {
            where: { status: 'ATIVO' },
            include: { implementos: { include: { implemento: true }, orderBy: { ordem: 'asc' } } },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });

      await tx.historicoCavaloMecanico.create({
        data: {
          cavaloMecanicoId: id,
          acao: 'ALTERACAO_COMPOSICAO',
          dadosAntes: JSON.parse(JSON.stringify(antes)),
          dadosDepois: JSON.parse(JSON.stringify({ cavalo: current, conjunto })),
          observacoes: 'Alteração de carretas/dolly vinculados ao cavalo mecânico',
        },
      });

      return current;
    });

    if ((antes as any).motoristaId !== (depois as any).motoristaId) {
      await this.registrarHistoricoMotorista((antes as any).motoristaId, 'REMOCAO_CAVALO', antes, depois);
      await this.registrarHistoricoMotorista((depois as any).motoristaId, 'VINCULO_CAVALO', antes, depois);
    }
    await this.audit('ATUALIZACAO_COMPOSICAO', id, antes, depois, actor);
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
        observacoes: 'Vínculo de cavalo mecânico registrado automaticamente',
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

  private nullifyEmptyStrings<T extends Record<string, any>>(data: T): T {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])) as T;
  }
}
