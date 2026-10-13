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

function membrosDoSnapshot(conjunto: ComposicaoHistorica, registro: ObjetoJson) {
  if (registro.id !== conjunto.id || !Array.isArray(registro.implementos)
    || registro.implementos.length !== conjunto.implementos.length) return null;
  const links = registro.implementos.map(objeto);
  if (links.some((link) => !link || typeof link.implementoId !== 'string' || !Number.isInteger(link.ordem))) return null;
  const membros = links as Array<ObjetoJson & { implementoId: string; ordem: number }>;
  return JSON.stringify(assinaturaImplementos(membros)) === JSON.stringify(assinaturaImplementos(conjunto.implementos)) ? membros : null;
}

function mesmaEstruturaCompleta(conjunto: ComposicaoHistorica, registro: ObjetoJson) {
  return registro.id === conjunto.id && registro.cavaloMecanicoId === conjunto.cavaloMecanicoId
    && registro.tipo === conjunto.tipo && registro.quantidadeTotalEixos === conjunto.quantidadeTotalEixos;
}

function snapshotConfirmaEncerramento(conjunto: ComposicaoHistorica, depois: ObjetoJson) {
  const membros = membrosDoSnapshot(conjunto, depois);
  if (!membros) return false;
  return membros.every((link) => {
    const atual = conjunto.implementos.find((item) => item.implementoId === link.implementoId);
    const fim = timestamp(link.dataFim);
    return Boolean(atual && atual.dataFim !== null && fim !== null && fim === timestamp(atual.dataFim)
      && timestamp(link.dataInicio) === timestamp(atual.dataInicio));
  });
}

function inicioDoSnapshotAtivo(conjunto: ComposicaoHistorica, value: unknown): number | null {
  const registro = objeto(value);
  if (!registro || registro.status !== 'ATIVO' || !mesmaEstruturaCompleta(conjunto, registro)) return null;
  const membros = membrosDoSnapshot(conjunto, registro);
  if (!membros?.length || membros.some((link) => link.dataFim !== null)) return null;
  const inicios = membros.map((link) => timestamp(link.dataInicio));
  return inicios[0] !== null && inicios.every((inicio) => inicio === inicios[0]) ? inicios[0] : null;
}

function inicioAnteriorComprovado(conjunto: ComposicaoHistorica, inicioAtual: number, fimAtual: number) {
  const atual = { inicio: inicioAtual, seguro: true };
  const resets = conjunto.historicos.filter((historico) => {
    if (historico.acao !== 'ATUALIZACAO_COMPOSICAO') return false;
    const antes = objeto(historico.dadosAntes);
    const depois = objeto(historico.dadosDepois);
    // Different IDs represent a new version, not a legacy reset of this composition's links.
    return !(antes?.id != null && depois?.id != null && antes.id !== depois.id);
  });
  if (!resets.length) return atual;
  const possiveis = resets.map((historico) => {
    const antes = objeto(historico.dadosAntes);
    return Array.isArray(antes?.implementos) ? antes.implementos.map(objeto)
      .map((link) => timestamp(link?.dataInicio)).filter((inicio): inicio is number => inicio !== null) : [];
  });
  // Failed proof still leaves an earlier possible composition; it must block arbitrary alternatives.
  const incerto = { inicio: possiveis.some((inicios) => !inicios.length) ? -Infinity : Math.min(inicioAtual, ...possiveis.flat()), seguro: false };
  const pares: Array<{ antes: number; depois: number; registro: number }> = [];
  for (const historico of resets) {
    const inicioAntes = inicioDoSnapshotAtivo(conjunto, historico.dadosAntes);
    const inicioDepois = inicioDoSnapshotAtivo(conjunto, historico.dadosDepois);
    const registro = timestamp(historico.createdAt);
    if (inicioAntes === null || inicioDepois === null || registro === null
      || inicioAntes > inicioDepois || inicioDepois > registro || registro > fimAtual) return incerto;
    // An unchanged timestamp proves no earlier interval and must never create a cycle.
    if (inicioAntes !== inicioDepois) pares.push({ antes: inicioAntes, depois: inicioDepois, registro });
  }
  if (!pares.length) return atual;
  if (Number.isFinite(fimAtual)) {
    const fechamentoComprovado = conjunto.status !== 'ATIVO' && conjunto.historicos.some((historico) => {
      const depois = objeto(historico.dadosDepois);
      return historico.acao === 'ENCERRAMENTO_COMPOSICAO' && depois && depois.status !== 'ATIVO'
        && mesmaEstruturaCompleta(conjunto, depois) && snapshotConfirmaEncerramento(conjunto, depois)
        && inicioDoSnapshotAtivo(conjunto, historico.dadosAntes) === inicioAtual;
    });
    if (!fechamentoComprovado) return incerto;
  } else if (conjunto.status !== 'ATIVO') return incerto;

  let inicio = inicioAtual;
  let limiteRegistro = fimAtual;
  const usados = new Set<number>();
  while (usados.size < pares.length) {
    const candidatos = pares.map((par, indice) => ({ par, indice }))
      .filter(({ par, indice }) => !usados.has(indice) && par.depois === inicio);
    // Missing anchors, forks and gaps must not extend the currently proven period.
    if (candidatos.length !== 1 || candidatos[0].par.registro > limiteRegistro) return incerto;
    const { par, indice } = candidatos[0];
    usados.add(indice);
    inicio = par.antes;
    limiteRegistro = par.registro;
  }
  return { inicio, seguro: true };
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
  const encerramentosCoerentes = encerramentos.every((encerramento) => {
    const depois = objeto(encerramento.dadosDepois);
    if (depois?.id != null && depois.id !== conjunto.id) return false;
    if (depois?.status === 'ATIVO') return false;
    // Legacy writers used a separate default timestamp for the audit event.
    // Its own complete snapshot can prove the operational link dates without a time tolerance.
    if (depois && 'implementos' in depois) return snapshotConfirmaEncerramento(conjunto, depois);
    return ends.every((value) => value === encerramento.createdAt.getTime());
  });
  const comprovado = !alterada ? inicioAnteriorComprovado(conjunto, inicio, fim) : { inicio, seguro: false };
  const eventosCoerentes = encerramentosCoerentes && criacoes.every((criacao) => criacao.createdAt.getTime() <= comprovado.inicio);
  if (!alterada) return { inicio: comprovado.inicio, fim, seguro: comprovado.seguro && datasIguais && encerramentoCoerente && eventosCoerentes };

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
