import { AlertTriangle, History, ListChecks } from 'lucide-react';
import { useState, type RefObject } from 'react';
import { financialImportIssues } from '../utils/financialImportIssues';
import { importCalendarDate, type ImportRow } from '../utils/financialImport';

type IssueActions = {
  disabled: boolean;
  onReview: (row: ImportRow) => void;
  onHistory: (row: ImportRow) => void;
};

export function FinancialImportIssuePanel({ rows, selected, dirty, disabled, panelRef, onReview, onHistory, onSelectReady, onRefresh }: IssueActions & {
  rows: ImportRow[];
  selected: number[];
  dirty: boolean;
  panelRef?: RefObject<HTMLDivElement>;
  onSelectReady: () => void;
  onRefresh: () => void;
}) {
  const [visible, setVisible] = useState(5);
  const affected = rows.filter((row) => financialImportIssues(row).length);
  const selectedLines = new Set(selected);
  const blocking = affected.filter((row) => selectedLines.has(row.linha));
  const ordered = [...blocking, ...affected.filter((row) => !selectedLines.has(row.linha))];
  const readyCount = rows.filter((row) => row.status === 'PRONTO').length;
  if (!affected.length && !dirty) return null;

  return <div className={`import-issues ${blocking.length ? 'import-issues-blocked' : ''}`} role="region" aria-labelledby="import-issues-title" tabIndex={-1} ref={panelRef}>
    <div className="import-issues-heading"><AlertTriangle size={23} aria-hidden="true" /><div>
      <h3 id="import-issues-title">{dirty ? 'Confira suas alterações antes de importar' : blocking.length ? `${blocking.length} ${blocking.length === 1 ? 'linha selecionada precisa' : 'linhas selecionadas precisam'} de correção` : readyCount === 0 ? 'Nenhuma linha está pronta para importar' : `${affected.length} ${affected.length === 1 ? 'linha com pendência ficou' : 'linhas com pendência ficaram'} fora da seleção`}</h3>
      <p>{dirty ? 'Clique em Atualizar prévia para conferir as associações e comissões que você alterou.' : blocking.length ? 'A importação está bloqueada para essas linhas. Veja o motivo e use o botão de cada linha para saber como resolver.' : readyCount === 0 ? 'Resolva as pendências abaixo e atualize a prévia antes de importar.' : 'Você pode importar as linhas prontas e resolver as demais depois.'}</p>
    </div></div>
    <div className="import-issues-actions">
      {dirty && <button type="button" className="button primary" disabled={disabled} onClick={onRefresh}>Atualizar prévia</button>}
      {readyCount > 0 && <button type="button" className="button" disabled={disabled || dirty} onClick={onSelectReady}><ListChecks size={17} aria-hidden="true" />Selecionar apenas {readyCount} {readyCount === 1 ? 'linha pronta' : 'linhas prontas'}</button>}
    </div>
    <ul className="import-issue-list">{ordered.slice(0, visible).map((row) => {
      const issues = financialImportIssues(row);
      return <li key={row.linha}>
        <div className="import-issue-identity"><strong>Linha {row.linha} · {row.cavalo?.placa || row.placa || 'Placa não informada'}</strong><span>{importCalendarDate(row.data)}{selectedLines.has(row.linha) ? ' · Selecionada' : ' · Fora da seleção'}</span></div>
        <div className="import-issue-reason">{issues.map((issue) => <p key={issue.code}><strong>{issue.title}</strong><span>{issue.summary}</span></p>)}</div>
        <div className="import-issues-actions">
          <button type="button" className="button" disabled={disabled} onClick={() => onReview(row)}>Como resolver a linha {row.linha}</button>
          {row.cavalo && issues.some((issue) => issue.code === 'COMPOSICAO') && <button type="button" className="button ghost" disabled={disabled || dirty} onClick={() => onHistory(row)}><History size={17} aria-hidden="true" />Ver histórico do cavalo</button>}
        </div>
      </li>;
    })}</ul>
    {ordered.length > visible && <button type="button" className="button ghost" disabled={disabled} onClick={() => setVisible((value) => value + 5)}>Mostrar mais pendências ({ordered.length - visible})</button>}
  </div>;
}

export function ImportRowProblemHelp({ row, disabled, onHistory }: { row: ImportRow; disabled: boolean; onHistory?: (row: ImportRow) => void }) {
  const issues = financialImportIssues(row);
  if (!issues.length) return null;
  return <section className="import-row-help" aria-label={`Como resolver a linha ${row.linha}`}>
    <h4>O que precisa ser corrigido nesta linha</h4>
    {issues.map((issue) => <article key={issue.code}>
      <strong>{issue.title}</strong><p>{issue.summary}</p>
      <ol>{issue.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {issue.code === 'COMPOSICAO' && row.cavalo && onHistory && <button type="button" className="button" disabled={disabled} onClick={() => onHistory(row)}><History size={17} aria-hidden="true" />Ver histórico do cavalo {row.cavalo.placa}</button>}
    </article>)}
    <p className="import-blocked-explanation">A importação desta linha permanece bloqueada. Depois de corrigir, clique em Atualizar prévia.</p>
    {row.pendencias.length > 0 && <details><summary>Ver detalhes da conferência</summary><ul>{row.pendencias.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}
  </section>;
}

export type ImportErrorContext = 'arquivo' | 'previa' | 'confirmacao' | 'comissao';

export function ImportErrorNotice({ context, message, noticeRef }: { context: ImportErrorContext; message: string; noticeRef?: RefObject<HTMLDivElement> }) {
  const titles = { arquivo: 'Confira o arquivo escolhido', previa: 'Não foi possível conferir a planilha', confirmacao: 'A importação não foi concluída', comissao: 'A comissão precisa de ajuste' };
  const steps = {
    arquivo: 'Escolha uma planilha Excel .xls ou .xlsx com dados e clique em Conferir planilha.',
    previa: 'Confira o motivo abaixo, corrija o arquivo ou a seleção indicada e tente conferir a planilha novamente.',
    confirmacao: 'Atualize a prévia para conferir a situação das linhas antes de tentar importar novamente.',
    comissao: 'Confira as linhas selecionadas e escolha o tipo de comissão nas linhas que já têm as carretas identificadas.',
  };
  return <div className="import-error-notice" role="alert" tabIndex={-1} ref={noticeRef}>
    <AlertTriangle size={24} aria-hidden="true" /><div><h3>{titles[context]}</h3><p className="import-error-reason">{message}</p><p><strong>Como resolver:</strong> {steps[context]}</p></div>
  </div>;
}
