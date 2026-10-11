import { Prisma } from '@prisma/client';

export const composicaoHistoricaSelect = {
  id: true,
  nome: true,
  cavaloMecanicoId: true,
  tipo: true,
  quantidadeTotalEixos: true,
  status: true,
  createdAt: true,
  justificativaSemImplemento: true,
  implementos: {
    select: { implementoId: true, ordem: true, dataInicio: true, dataFim: true },
    orderBy: { ordem: 'asc' as const },
  },
  historicos: {
    select: { acao: true, dadosAntes: true, dadosDepois: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ConjuntoSelect;

export type ComposicaoHistorica = Prisma.ConjuntoGetPayload<{ select: typeof composicaoHistoricaSelect }>;
export type ContextoFrotaHistorica = {
  conjuntos: readonly ComposicaoHistorica[];
  cavalos: ReadonlyMap<string, { id: string; placa: string }>;
};
export type ResolucaoComposicaoHistorica = {
  status: 'RESOLVIDA' | 'AMBIGUA' | 'SEM_HISTORICO';
  conjuntoId: string | null;
  quantidadeTotalEixos: number | null;
  motivo: string;
  candidatos: string[];
};

type Intervalo = { inicio: number; fim: number; seguro: boolean };
type ObjetoJson = Record<string, unknown>;

function objeto(value: unknown): ObjetoJson | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjetoJson : null;
}

function timestamp(value: unknown): number | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function snapshots(conjunto: ComposicaoHistorica): ObjetoJson[] {
  return conjunto.historicos.flatMap((historico) => [historico.dadosAntes, historico.dadosDepois])
    .map(objeto).filter((item): item is ObjetoJson => Boolean(item && (item.id == null || item.id === conjunto.id)));
}

function assinaturaImplementos(links: readonly { implementoId: string; ordem: number }[]) {
  return [...links].sort((a, b) => a.ordem - b.ordem)
    .map((link) => [link.implementoId, link.ordem]);
}

function estruturaAlterada(conjunto: ComposicaoHistorica, registros: ObjetoJson[]) {
  const atual = JSON.stringify(assinaturaImplementos(conjunto.implementos));
  return registros.some((registro) => {
    if (typeof registro.cavaloMecanicoId === 'string' && registro.cavaloMecanicoId !== conjunto.cavaloMecanicoId) return true;
    if (registro.quantidadeTotalEixos != null && Number(registro.quantidadeTotalEixos) !== conjunto.quantidadeTotalEixos) return true;
    if (typeof registro.tipo === 'string' && registro.tipo !== conjunto.tipo) return true;
    if (!Array.isArray(registro.implementos)) return false;
    const links = registro.implementos.map(objeto);
    if (links.some((link) => !link || typeof link.implementoId !== 'string' || !Number.isInteger(link.ordem))) return true;
    return JSON.stringify(assinaturaImplementos(links as Array<{ implementoId: string; ordem: number }>)) !== atual;
  });
}

function intervalo(conjunto: ComposicaoHistorica): Intervalo | null {
  const registros = snapshots(conjunto);
  const reativada = conjunto.historicos.some((historico) => {
    const antes = objeto(historico.dadosAntes);
    const depois = objeto(historico.dadosDepois);
    return antes?.id === conjunto.id && depois?.id === conjunto.id
      && typeof antes.status === 'string' && antes.status !== 'ATIVO' && depois.status === 'ATIVO';
  });
  const alterada = estruturaAlterada(conjunto, registros) || reativada;
  const todasCriacoes = conjunto.historicos.filter((historico) => historico.acao === 'CRIACAO_COMPOSICAO');
  const criacoes = conjunto.historicos.filter((historico) => historico.acao === 'CRIACAO_COMPOSICAO'
    && objeto(historico.dadosDepois)?.status === 'ATIVO');
  const encerramentos = conjunto.historicos.filter((historico) => historico.acao === 'ENCERRAMENTO_COMPOSICAO');
  const fimHistorico = encerramentos.length ? Math.min(...encerramentos.map((item) => item.createdAt.getTime())) : null;

  if (!conjunto.implementos.length) {
    // Empty compositions have no operational link dates; registration timestamps alone are insufficient.
    if (!criacoes.length) {
      const nuncaAtivo = conjunto.status !== 'ATIVO' && !registros.some((registro) => registro.status === 'ATIVO')
        && todasCriacoes.length && todasCriacoes.every((item) => {
        const status = objeto(item.dadosDepois)?.status;
        return status === 'INATIVO' || status === 'MANUTENCAO';
      });
      if (nuncaAtivo && !alterada) return null;
      return { inicio: -Infinity, fim: fimHistorico ?? Infinity, seguro: false };
    }
    const inicio = Math.min(...criacoes.map((item) => item.createdAt.getTime()));
    const fim = fimHistorico ?? Infinity;
    if (fim <= inicio) return null;
    return { inicio, fim, seguro: !alterada && criacoes.length === 1 && Boolean(conjunto.justificativaSemImplemento?.trim())
      && (conjunto.status === 'ATIVO' || fimHistorico !== null) && !(conjunto.status === 'ATIVO' && fimHistorico !== null) };
  }

  const inicios = conjunto.implementos.map((link) => timestamp(link.dataInicio));
  const fins = conjunto.implementos.map((link) => link.dataFim === null ? Infinity : timestamp(link.dataFim));
  if (inicios.some((value) => value === null) || fins.some((value) => value === null)) {
    return { inicio: -Infinity, fim: Infinity, seguro: false };
  }
  const starts = inicios as number[];
  const ends = fins as number[];
  if (ends.some((value, index) => value < starts[index])) return { inicio: -Infinity, fim: Infinity, seguro: false };
  // Records created inactive have zero-duration links and never establish operational possession.
  if (!alterada && ends.every((value, index) => value === starts[index])) return null;
  const inicio = Math.min(...starts);
  const fim = Math.max(...ends);
  const datasIguais = starts.every((value) => value === starts[0]) && ends.every((value) => value === ends[0]);
  const encerramentoCoerente = Number.isFinite(fim) || conjunto.status === 'ATIVO';
  const eventosCoerentes = (fimHistorico === null || ends.every((value) => value === fimHistorico))
    && criacoes.every((criacao) => criacao.createdAt.getTime() <= inicio);
  if (!alterada) return { inicio, fim, seguro: datasIguais && encerramentoCoerente && eventosCoerentes };

  const iniciosAnteriores = registros.flatMap((registro) => Array.isArray(registro.implementos)
    ? registro.implementos.map(objeto).flatMap((link) => {
      const value = timestamp(link?.dataInicio);
      return value === null ? [] : [value];
    }) : []);
  return {
    inicio: iniciosAnteriores.length ? Math.min(inicio, ...iniciosAnteriores) : -Infinity,
    fim: Number.isFinite(fim) ? fim : fimHistorico ?? Infinity,
    seguro: false,
  };
}

/**
 * Link intervals are [start,end): replacement closes and opens links at the same instant.
 * Invoices only identify a calendar day, so a composition must cover that entire UTC day.
 */
export function resolverComposicaoHistorica(
  conjuntos: readonly ComposicaoHistorica[],
  data: string | Date,
  cavaloMecanicoId: string,
): ResolucaoComposicaoHistorica {
  const textoData = data instanceof Date && Number.isFinite(data.getTime()) ? data.toISOString().slice(0, 10) : String(data);
  const inicioDia = /^\d{4}-\d{2}-\d{2}$/.test(textoData) ? Date.parse(textoData + 'T00:00:00.000Z') : NaN;
  const fimDia = inicioDia + 86_400_000;
  const base = { conjuntoId: null, quantidadeTotalEixos: null, candidatos: [] as string[] };
  if (!Number.isFinite(inicioDia) || new Date(inicioDia).toISOString().slice(0, 10) !== textoData) {
    return { ...base, status: 'SEM_HISTORICO', motivo: 'A data do faturamento é inválida para resolver a composição histórica.' };
  }

  const possiveis = conjuntos.flatMap((conjunto) => {
    const registros = snapshots(conjunto);
    if (conjunto.cavaloMecanicoId !== cavaloMecanicoId && !registros.some((registro) => registro.cavaloMecanicoId === cavaloMecanicoId)) return [];
    const periodo = intervalo(conjunto);
    if (!periodo || periodo.inicio >= fimDia || periodo.fim <= inicioDia) return [];
    return [{ conjunto, periodo }];
  });
  const candidatos = possiveis.map(({ conjunto }) => conjunto.id);
  if (!possiveis.length) {
    return { ...base, status: 'SEM_HISTORICO', motivo: 'Não há histórico operacional suficiente para determinar a composição do cavalo na data do faturamento.' };
  }
  const unico = possiveis.length === 1 ? possiveis[0] : null;
  if (!unico || !unico.periodo.seguro || unico.periodo.inicio > inicioDia || unico.periodo.fim < fimDia
    || unico.conjunto.cavaloMecanicoId !== cavaloMecanicoId || !Number.isInteger(unico.conjunto.quantidadeTotalEixos)
    || unico.conjunto.quantidadeTotalEixos < 0 || (unico.conjunto.implementos.length > 0 && unico.conjunto.quantidadeTotalEixos === 0)) {
    return { ...base, candidatos, status: 'AMBIGUA', motivo: 'A composição histórica não pode ser determinada com segurança: há troca no mesmo dia, sobreposição ou dados históricos incompletos/alterados. Revise o histórico da frota.' };
  }
  return {
    status: 'RESOLVIDA', conjuntoId: unico.conjunto.id,
    quantidadeTotalEixos: unico.conjunto.quantidadeTotalEixos,
    candidatos, motivo: 'Composição identificada pelos vínculos operacionais vigentes durante todo o dia do faturamento.',
  };
}
