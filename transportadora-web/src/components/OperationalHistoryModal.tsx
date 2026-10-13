import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import type { Resource } from '../pages/resources';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { money } from '../utils/formatters';

type TimelineEvent = { id: string; when: string; kind: string; title: string; description: string; amount?: number };

type OperationalHistoryModalProps = {
  resource: Pick<Resource, 'path' | 'endpoint'>;
  item: any;
  onClose: () => void;
  notice?: string;
  closeLabel?: string;
};

export function HistoricoOperacionalModal({ resource, item, onClose, notice, closeLabel }: OperationalHistoryModalProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const isCavalo = resource.path === 'caminhoes';
  useEscapeToClose(onClose);

  useEffect(() => {
    let mounted = true;
    setError('');
    setData(null);
    api.get(`${resource.endpoint}/${item.id}/historico`)
      .then((response) => { if (mounted) setData(response.data); })
      .catch(async (requestError) => {
        const message = await apiErrorMessage(requestError, 'Não foi possível carregar o histórico.');
        if (mounted) setError(message);
      });
    return () => { mounted = false; };
  }, [resource.endpoint, item.id, retry]);

  const events = useMemo(() => data ? buildTimeline(data, isCavalo) : [], [data, isCavalo]);
  const title = isCavalo ? [item.placa, item.marca, item.modelo].filter(Boolean).join(' - ') : [item.nome, item.cpf].filter(Boolean).join(' - ');
  const heading = `Histórico ${isCavalo ? 'do cavalo' : 'do motorista'}`;

  return <div className="modal-backdrop">
    <div className="modal large-modal historico-modal" role="dialog" aria-modal="true" aria-label={`${heading}${title ? ` ${title}` : ''}`}>
      <div className="modal-header"><div><h2>{heading}</h2><span>{title}</span></div><button type="button" className="icon-button" aria-label={closeLabel || 'Fechar histórico'} onClick={onClose} autoFocus><X size={18} /></button></div>
      {notice && <div className="form-warning">{notice}</div>}
      {data && <div className="historico-stats">
        <HistoricoStat label="Eventos" value={String(events.length)} />
        <HistoricoStat label="Despesas" value={money(data.totais?.totalDespesas || 0)} />
        <HistoricoStat label="Faturamento" value={money(data.totais?.totalFaturamento || 0)} />
        <HistoricoStat label="Saldo" value={money(data.totais?.saldo || 0)} />
      </div>}
      {error && <div className="import-error-notice" role="alert"><div><h3>Não foi possível abrir o histórico</h3><p>{error}</p><p>Tente carregar novamente ou volte para a tela anterior.</p><button type="button" className="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div></div>}
      {!data && !error && <div className="empty-inline">Carregando histórico...</div>}
      {data && <>
        <div className="historico-current"><strong>Situação atual</strong><span>{isCavalo ? `${data.conjuntosAtuais?.length || 0} composição(ões) registrada(s)` : `${data.cavalosAtuais?.length || 0} cavalo(s) atualmente vinculado(s)`}</span></div>
        {isCavalo && <HistoricalFleetLinks conjuntos={data.conjuntosAtuais} open={Boolean(notice)} />}
        <div className="section-title"><h3>Linha do tempo</h3><span>Mais recentes primeiro</span></div>
        <div className="timeline">
          {events.map((event) => <article className="timeline-event" key={`${event.kind}-${event.id}`}><div className="timeline-marker" /><div className="timeline-content"><div className="timeline-heading"><strong>{event.title}</strong><time>{dateTime(event.when)}</time></div><span className="timeline-kind">{event.kind}</span><p>{event.description}</p>{event.amount !== undefined && <b>{money(event.amount)}</b>}</div></article>)}
          {!events.length && <div className="empty-inline">Ainda não há eventos históricos para este cadastro.</div>}
        </div>
      </>}
      {closeLabel && <div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>{closeLabel}</button></div>}
    </div>
  </div>;
}

type HistoricalFleetConjunto = {
  id: string;
  nome?: string | null;
  status?: string | null;
  quantidadeTotalEixos?: number | null;
  implementos?: readonly {
    id?: string;
    implementoId?: string;
    ordem?: number;
    dataInicio?: string | Date | null;
    dataFim?: string | Date | null;
    implemento?: { placa?: string | null; tipo?: string | null } | null;
  }[] | null;
};

export function HistoricalFleetLinks({ conjuntos, open = false }: { conjuntos?: readonly HistoricalFleetConjunto[] | null; open?: boolean }) {
  const statusLabels: Record<string, string> = { ATIVO: 'Ativo', INATIVO: 'Inativo', MANUTENCAO: 'Manutenção' };
  const typeLabels: Record<string, string> = { CARRETA: 'Carreta', SEMIRREBOQUE: 'Semirreboque', REBOQUE: 'Reboque', DOLLY: 'Dolly' };

  return <details open={open}><summary>Carretas e datas registradas</summary><section aria-label="Carretas e datas registradas">
    <p>Datas na mesma referência da conferência da planilha (UTC).</p>
    {!conjuntos?.length ? <div className="empty-inline">Nenhuma composição registrada para este cavalo.</div> : conjuntos.map((conjunto) => <article key={conjunto.id} className="detail-list">
      <h4>{conjunto.nome || 'Conjunto sem nome informado'}</h4>
      <p>Status registrado: {statusLabels[conjunto.status || ''] || conjunto.status || 'Não informado'} · Total de eixos: {conjunto.quantidadeTotalEixos ?? 'Não informado'}</p>
      {!conjunto.implementos?.length ? <div className="empty-inline">Sem carretas registradas neste conjunto.</div> : <div className="table-wrap"><table>
        <thead><tr><th>Ordem</th><th>Placa</th><th>Implemento</th><th>Início registrado (UTC)</th><th>Encerramento registrado (UTC)</th></tr></thead>
        <tbody>{conjunto.implementos.map((vinculo, index) => <tr key={vinculo.id || `${vinculo.implementoId || 'implemento'}-${index}`}>
          <td>{vinculo.ordem ?? 'Não informado'}</td>
          <td>{vinculo.implemento?.placa || 'Não informado'}</td>
          <td>{typeLabels[vinculo.implemento?.tipo || ''] || vinculo.implemento?.tipo || 'Não informado'}</td>
          <td>{operationalDateTime(vinculo.dataInicio)}</td>
          <td>{vinculo.dataFim === null ? 'Sem encerramento registrado' : operationalDateTime(vinculo.dataFim)}</td>
        </tr>)}</tbody>
      </table></div>}
    </article>)}
  </section></details>;
}

function operationalDateTime(value: string | Date | null | undefined) {
  if (!value) return 'Não informado';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'Não informado';
  const iso = parsed.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 19)} UTC`;
}

export function buildTimeline(data: any, isCavalo: boolean): TimelineEvent[] {
  const motoristas = new Map((data.motoristasHistoricos || []).map((motorista: any) => [motorista.id, motorista.nome]));
  const alteracoes = (data.alteracoes || []).map((registro: any) => {
    const antes = registro.dadosAntes?.cavalo || registro.dadosAntes || {};
    const depois = registro.dadosDepois?.cavalo || registro.dadosDepois || {};
    let description = registro.observacoes || historyAction(registro.acao);
    if (isCavalo && antes.motoristaId !== depois.motoristaId) {
      const anterior = motoristas.get(antes.motoristaId) || (antes.motoristaId ? 'Motorista anterior' : 'Sem motorista');
      const atual = motoristas.get(depois.motoristaId) || (depois.motoristaId ? 'Novo motorista' : 'Sem motorista');
      description = `Motorista alterado de ${anterior} para ${atual}.`;
    }
    return { id: registro.id, when: registro.createdAt, kind: 'Cadastro e vínculo', title: historyAction(registro.acao), description };
  });
  const vinculos = (isCavalo ? data.historicoEngates || [] : data.historicoCavalos || []).map((registro: any) => ({
    id: registro.id,
    when: registro.createdAt,
    kind: isCavalo ? 'Composição' : 'Vínculo com cavalo',
    title: historyAction(registro.acao),
    description: historyRelationDescription(registro, isCavalo),
  }));
  const financeiros = (data.lancamentos || []).map((registro: any) => {
    const party = registro.tipoLancamento === 'DESPESA' ? registro.fornecedor?.nome : registro.cliente?.nome;
    const relation = isCavalo ? registro.motorista?.nome : registro.cavaloMecanico?.placa;
    return {
      id: registro.id,
      when: registro.data,
      kind: 'Financeiro',
      title: registro.tipoLancamento === 'DESPESA' ? 'Despesa' : 'Faturamento',
      description: [registro.descricao, registro.categoriaFinanceira?.nome, party, relation && `${isCavalo ? 'Motorista' : 'Cavalo'}: ${relation}`].filter(Boolean).join(' • ') || 'Lançamento financeiro',
      amount: Number(registro.valorTotal || 0),
    };
  });
  return [...alteracoes, ...vinculos, ...financeiros].sort((left, right) => new Date(right.when).getTime() - new Date(left.when).getTime());
}

function historyAction(action: string) {
  const labels: Record<string, string> = { ATUALIZACAO: 'Cadastro atualizado', VINCULO_CAVALO: 'Motorista vinculado', REMOCAO_CAVALO: 'Motorista removido', CRIACAO_COM_CONJUNTO: 'Cavalo e composição cadastrados', ATUALIZACAO_COMPOSICAO: 'Composição atualizada', ENGATE_CONJUNTO: 'Conjunto engatado', DESENGATE_CONJUNTO: 'Conjunto desengatado', ATUALIZACAO_ENGATE: 'Engate atualizado', CRIACAO_COMPOSICAO: 'Composição criada' };
  return labels[action] || String(action || 'Evento').replace(/_/g, ' ').toLowerCase().replace(/^./, (letter: string) => letter.toUpperCase());
}

function historyRelationDescription(registro: any, isCavalo: boolean) {
  const snapshot = registro.dadosDepois || registro.dadosAntes || {};
  if (isCavalo) return [snapshot.nome, snapshot.tipo, snapshot.quantidadeTotalEixos != null ? `${snapshot.quantidadeTotalEixos} eixos` : null].filter(Boolean).join(' • ') || registro.observacoes || 'Alteração na composição do cavalo.';
  return [snapshot.placa, snapshot.marca, snapshot.modelo].filter(Boolean).join(' • ') || registro.observacoes || 'Alteração no vínculo do motorista com o cavalo.';
}

function HistoricoStat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function dateTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('pt-BR'); }
