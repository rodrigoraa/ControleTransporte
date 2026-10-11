import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoConjuntoOperacional, TipoImplemento } from '@prisma/client';
import { AuditActor } from '../common/audit/audit-context';
import { CrudService } from '../common/crud/crud.service';
import { PaginationDto } from '../common/crud/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateImplementoDto } from '../implementos/dto/create-implemento.dto';
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

  protected buildWhere(query: PaginationDto & Record<string, any>) {
    const where = super.buildWhere(query);
    if (query.ano !== undefined) where.ano = query.ano;
    if (query.tipoCavalo) where.tipoCavalo = query.tipoCavalo;

    const motoristaAtual = query.motoristaAtual?.trim();
    if (motoristaAtual) {
      where.motorista = {
        is: {
          OR: ['nome', 'cpf', 'cnh'].map((field) => ({
            [field]: { contains: motoristaAtual, mode: 'insensitive' as const },
          })),
        },
      };
    }

    const composicao = query.composicao?.trim();
    if (composicao) {
      const textFilter = (field: string) => ({
        [field]: { contains: composicao, mode: 'insensitive' as const },
      });
      const normalized = composicao.toUpperCase();
      const tipoImplemento = Object.values(TipoImplemento).find((value) => value === normalized);
      const tipoConjunto = Object.values(TipoConjuntoOperacional).find((value) => value === normalized);
      const implementoOr: object[] = [textFilter('placa')];
      if (tipoImplemento) implementoOr.push({ tipo: tipoImplemento });

      const compositionOr: object[] = [
        textFilter('nome'),
        textFilter('placa'),
        textFilter('dollyPlaca'),
        textFilter('segundaCarretaPlaca'),
        { implementos: { some: { implemento: { is: { OR: implementoOr } } } } },
      ];
      if (tipoConjunto) compositionOr.push({ tipo: tipoConjunto });

      where.conjuntos = {
        some: {
          status: 'ATIVO',
          OR: compositionOr,
        },
      };
    }
    return where;
  }

  async create(dto: CreateCaminhaoDto, actor?: AuditActor) {
    const { implementos = [], conjuntoStatus, conjuntoObservacoes, ...cavaloDto } = dto;

    if (!implementos.length) return super.create(cavaloDto as CreateCaminhaoDto, actor);

    const created = await this.composicoes.runCompositionTransaction<any>(this.prisma, async (tx) => {
      const referenceDate = new Date();
      const preparados = await this.prepararImplementos(tx, implementos);
      this.composicoes.validateComposition(preparados, cavaloDto.tipoCavalo);
      const cavalo = await tx.cavaloMecanico.create({
        data: this.nullifyEmptyStrings(cavaloDto) as any,
        include: { motorista: true },
      });
      const transferencias = (conjuntoStatus || 'ATIVO') === 'ATIVO'
        ? await this.composicoes.resolverTransferencias(tx, cavalo.id, preparados.flatMap((item) => item.id ? [item.id] : []), referenceDate)
        : [];
      const createdImplementos = await this.salvarImplementos(tx, preparados, conjuntoStatus || 'ATIVO');
      const conjunto = await this.composicoes.createConjunto(tx, cavalo, createdImplementos, conjuntoStatus || 'ATIVO', conjuntoObservacoes || null, referenceDate);
      await this.composicoes.registrarTransferencias(tx, transferencias, conjunto, referenceDate);

      await tx.historicoCavaloMecanico.create({
        data: {
          cavaloMecanicoId: cavalo.id,
          acao: 'CRIACAO_COM_CONJUNTO',
          dadosDepois: JSON.parse(JSON.stringify({ cavalo, conjunto })),
          observacoes: 'Cadastro completo de cavalo mecânico com implementos',
          createdAt: referenceDate,
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
    const { implementos = [], conjuntoStatus, conjuntoObservacoes, ...cavaloDto } = dto;
    const { antes, depois } = await this.composicoes.runCompositionTransaction(this.prisma, async (tx) => {
      // Refresh the entire source state on each retry, within the same transaction.
      const antes = await tx.cavaloMecanico.findUnique({ where: { id }, include: this.include as any });
      if (!antes) throw new NotFoundException('Registro não encontrado.');
      const preparados = await this.prepararImplementos(tx, implementos);
      if (preparados.length) this.composicoes.validateComposition(preparados, cavaloDto.tipoCavalo ?? antes.tipoCavalo);
      const endedAt = new Date();
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
      for (const conjunto of activeConjuntos) {
        await this.composicoes.encerrarConjunto(tx, conjunto, endedAt, 'Composição encerrada por alteração no cadastro do cavalo mecânico');
      }

      const transferencias = (conjuntoStatus || 'ATIVO') === 'ATIVO'
        ? await this.composicoes.resolverTransferencias(tx, id, preparados.flatMap((item) => item.id ? [item.id] : []), endedAt)
        : [];
      const currentImplementos = await this.salvarImplementos(tx, preparados, conjuntoStatus || 'ATIVO');

      const conjunto = currentImplementos.length
        ? await this.composicoes.createConjunto(tx, cavalo, currentImplementos, conjuntoStatus || 'ATIVO', conjuntoObservacoes || null, endedAt)
        : null;
      if (conjunto) await this.composicoes.registrarTransferencias(tx, transferencias, conjunto, endedAt);

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
          createdAt: endedAt,
        },
      });

      if (antes.motoristaId !== current.motoristaId) {
        await this.registrarHistoricoMotorista(antes.motoristaId, 'REMOCAO_CAVALO', antes, current, tx);
        await this.registrarHistoricoMotorista(current.motoristaId, 'VINCULO_CAVALO', antes, current, tx);
      }

      return { antes, depois: current };
    });

    await this.audit('ATUALIZACAO_COMPOSICAO', id, antes, depois, actor);
    return depois;
  }

  private async prepararImplementos(tx: Prisma.TransactionClient, implementos: CreateImplementoDto[]) {
    const ids = implementos.flatMap((item) => item.id ? [item.id] : []);
    const existentes = ids.length ? await tx.implemento.findMany({ where: { id: { in: ids } } }) : [];
    const porId = new Map(existentes.map((item) => [item.id, item]));
    if (porId.size !== new Set(ids).size) throw new BadRequestException('Um ou mais implementos não foram encontrados.');
    return implementos.map((item) => {
      const existente = item.id ? porId.get(item.id) : undefined;
      const tipo = item.tipo ?? existente?.tipo;
      if (!tipo) throw new BadRequestException('Informe o tipo do implemento.');
      return {
        ...this.nullifyEmptyStrings(item),
        tipo,
        carroceria: item.carroceria ?? existente?.carroceria ?? 'OUTRO',
        quantidadeEixos: this.composicoes.normalizeImplementoEixos({ tipo, quantidadeEixos: item.quantidadeEixos ?? existente?.quantidadeEixos }),
        capacidadeCarga: item.capacidadeCarga === null ? 0 : item.capacidadeCarga ?? existente?.capacidadeCarga ?? 0,
      } as Prisma.ImplementoUncheckedCreateInput;
    });
  }

  private async salvarImplementos(tx: Prisma.TransactionClient, implementos: Prisma.ImplementoUncheckedCreateInput[], status: string) {
    return Promise.all(implementos.map(async ({ id, ...data }) => {
      if (!id) return tx.implemento.create({ data });
      if (status !== 'ATIVO') {
        const ocupado = await tx.conjuntoImplemento.findFirst({
          where: { implementoId: id, dataFim: null, conjunto: { status: 'ATIVO' } },
          include: { implemento: true },
        });
        if (ocupado) {
          const alterado = Object.entries(data).some(([key, value]) => value !== undefined
            && String(value ?? '') !== String(ocupado.implemento[key as keyof typeof ocupado.implemento] ?? ''));
          if (alterado) throw new BadRequestException('Para alterar um implemento vinculado a outro cavalo, transfira-o para uma composição ativa.');
          return ocupado.implemento;
        }
      }
      return tx.implemento.update({ where: { id }, data });
    }));
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
    const motoristaIds = alteracoes.flatMap((item) => {
      const antes = item.dadosAntes as any;
      const depois = item.dadosDepois as any;
      return [antes?.cavalo?.motoristaId ?? antes?.motoristaId, depois?.cavalo?.motoristaId ?? depois?.motoristaId].filter(Boolean) as string[];
    });
    const motoristasHistoricos = motoristaIds.length
      ? await this.prisma.motorista.findMany({
          where: { id: { in: [...new Set(motoristaIds)] } },
          select: { id: true, nome: true, cpf: true },
        })
      : [];

    return {
      alteracoes,
      conjuntosAtuais,
      historicoEngates,
      lancamentos,
      motoristasHistoricos,
      totais: this.totaisLancamentos(lancamentos),
    };
  }

  private async registrarHistoricoMotorista(motoristaId: string | null | undefined, acao: string, antes: unknown, depois: unknown, tx: Pick<Prisma.TransactionClient, 'historicoMotorista'> = this.prisma) {
    if (!motoristaId) return;
    await tx.historicoMotorista.create({
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
