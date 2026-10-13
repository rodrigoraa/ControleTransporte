import { Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { api } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { commissionAfterTaxDiscount, commissionDefaults, commissionValues, CommissionType, selectedCommissionValue } from '../utils/commission';
import { applyImportCommission, batchImportCommissionAvailability, buildImportFormData, canConfirmImport, canEditImportRow, canSelectImportRow, confirmedImportLines, financialImportStatus, importCalendarDate, importCommissionForType, importEntityOptions, importFileError, ImportCommission, ImportEntity, ImportHorse, ImportPreview, ImportResult, ImportRow, ImportSelection, selectImportHorse } from '../utils/financialImport';
import { money } from '../utils/formatters';
import { financialImportIssues } from '../utils/financialImportIssues';
import { FinancialImportIssuePanel, ImportErrorNotice, ImportRowProblemHelp, type ImportErrorContext } from './FinancialImportIssues';
import { HistoricoOperacionalModal } from './OperationalHistoryModal';
import { SearchableSelect } from './SearchableSelect';

type Catalog = { cavalos: ImportHorse[]; motoristas: ImportEntity[]; clientes: ImportEntity[] };

async function loadCatalogRows<T>(endpoint: string): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let total = 0;
  do {
    const { data } = await api.get(endpoint, { params: { page, limit: 100 } });
    const current: T[] = Array.isArray(data.data) ? data.data : [];
    rows.push(...current);
    total = Number(data.total || rows.length);
    if (!current.length) break;
    page += 1;
  } while (rows.length < total);
  return rows;
}

export function FinancialImportModal({ onClose, onImported }: { onClose: () => void; onImported: (result: ImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selections, setSelections] = useState<Record<number, ImportSelection>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({ cavalos: [], motoristas: [], clientes: [] });
  const [catalogError, setCatalogError] = useState('');
  const [error, setError] = useState('');
  const [errorContext, setErrorContext] = useState<ImportErrorContext>('arquivo');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'' | 'preview' | 'confirm'>('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [batchCommission, setBatchCommission] = useState<ImportCommission>({ descontoImpostos: false });
  const [historyRow, setHistoryRow] = useState<ImportRow | null>(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const issuePanelRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const importBackdropRef = useRef<HTMLDivElement>(null);
  const lastFocusedPreview = useRef<ImportPreview | null>(null);
  useEscapeToClose(() => confirming ? setConfirming(false) : onClose(), !busy && !historyRow);

  useEffect(() => {
    importBackdropRef.current?.toggleAttribute('inert', Boolean(historyRow));
  }, [historyRow]);

  useEffect(() => {
    if (busy || historyRow || confirming || result) return;
    if (!error && preview === lastFocusedPreview.current) return;
    if (!error) lastFocusedPreview.current = preview;
    const target = error ? errorRef.current : issuePanelRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start' });
  }, [error, preview, busy, historyRow, confirming, result]);

  useEffect(() => {
    if (!reviewRequest || historyRow) return;
    editorRef.current?.focus({ preventScroll: true });
    editorRef.current?.scrollIntoView({ block: 'start' });
  }, [reviewRequest, historyRow]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadCatalogRows<ImportHorse>('/caminhoes'), loadCatalogRows<ImportEntity>('/motoristas'), loadCatalogRows<ImportEntity>('/clientes')])
      .then(([cavalos, motoristas, clientes]) => { if (mounted) setCatalog({ cavalos, motoristas, clientes }); })
      .catch(() => { if (mounted) setCatalogError('Não foi possível carregar todos os cadastros. As sugestões encontradas na prévia continuam disponíveis. Feche e abra a importação para tentar novamente.'); });
    return () => { mounted = false; };
  }, []);

  function selectFile(next: File | undefined) {
    setPreview(null);
    setSelections({});
    setSelected([]);
    setEditingLine(null);
    setDirty(false);
    setConfirming(false);
    setResult(null);
    setReviewRequest(0);
    setErrorContext('arquivo');
    const validation = next ? importFileError(next) : '';
    setFile(next && !validation ? next : null);
    setError(validation);
  }

  function updateSelection(line: number, changes: Partial<ImportSelection>) {
    setSelections((current) => ({ ...current, [line]: { ...current[line], ...changes, linha: line } }));
    setDirty(true);
    setError('');
  }

  async function refreshPreview() {
    if (!file || busy) return;
    setBusy('preview');
    setError('');
    setErrorContext('previa');
    try {
      const { data } = await api.post<ImportPreview>('/importacoes/lancamentos/preview', buildImportFormData(file, {
        hashArquivo: preview?.hashArquivo,
        selecoes: Object.values(selections),
        ...(preview ? { linhasSelecionadas: selected } : {}),
      }));
      setPreview(data);
      setSelected((current) => data.linhas.filter((row) => canSelectImportRow(row) && (!preview || current.includes(row.linha))).map((row) => row.linha));
      setEditingLine((current) => data.linhas.some((row) => row.linha === current)
        ? current
        : data.linhas.find((row) => canEditImportRow(row) && row.status !== 'PRONTO')?.linha ?? null);
      setDirty(false);
    } catch (requestError) {
      setError(await apiErrorMessage(requestError, 'Não foi possível conferir a planilha. Verifique o arquivo e tente novamente.'));
    } finally {
      setBusy('');
    }
  }

  async function confirmImport() {
    if (!file || !preview || busy || !canConfirmImport(preview.linhas, selected, dirty)) return;
    setBusy('confirm');
    setError('');
    setErrorContext('confirmacao');
    try {
      const { data } = await api.post<ImportResult>('/importacoes/lancamentos/confirmar', buildImportFormData(file, {
        hashArquivo: preview.hashArquivo, selecoes: Object.values(selections), linhasSelecionadas: confirmedImportLines(preview.linhas, selected),
      }));
      setResult(data);
      setConfirming(false);
      onImported(data);
    } catch (requestError) {
      setError(await apiErrorMessage(requestError, 'Não foi possível confirmar a importação. Atualize a prévia e tente novamente.'));
      setConfirming(false);
      setDirty(true);
    } finally {
      setBusy('');
    }
  }

  function applyBatchCommission() {
    if (!preview) return;
    setErrorContext('comissao');
    const availability = batchImportCommissionAvailability(preview.linhas, selected, selections);
    if (!availability.elegiveis) {
      setError(availability.mensagem);
      return;
    }
    if (!batchCommission.tipoComissao) {
      setError('Escolha o tipo de comissão que será aplicado aos selecionados.');
      return;
    }
    setSelections(applyImportCommission(preview.linhas, selected, selections, batchCommission));
    setDirty(true);
    setError('');
  }

  function reviewRow(row: ImportRow) {
    setEditingLine(row.linha);
    setReviewRequest((value) => value + 1);
  }

  function showHistory(row: ImportRow) {
    if (!busy && !dirty && row.cavalo) setHistoryRow(row);
  }

  const selectedRows = preview?.linhas.filter((row) => selected.includes(row.linha)) || [];
  const eligibleRows = preview?.linhas.filter(canSelectImportRow) || [];
  const editingRow = preview?.linhas.find((row) => row.linha === editingLine);
  const ready = preview && canConfirmImport(preview.linhas, selected, dirty);
  const withoutCommission = selectedRows.filter((row) => !row.comissaoNecessaria).length;
  const batchAvailability = batchImportCommissionAvailability(preview?.linhas || [], selected, selections);

  return <><div className="modal-backdrop" ref={importBackdropRef} aria-hidden={historyRow ? true : undefined}>
    <div className="modal large-modal import-modal" role="dialog" aria-modal="true" aria-label="Importar planilha de faturamento" aria-busy={Boolean(busy)}>
      <div className="modal-header">
        <div><h2>{result ? 'Importação concluída' : confirming ? 'Confirmar importação' : 'Importar planilha'}</h2><span>Faturamentos do sistema do cliente</span></div>
        <button type="button" className="icon-button" aria-label="Fechar importação" onClick={onClose} disabled={Boolean(busy)}><X size={18} /></button>
      </div>

      {error && <ImportErrorNotice context={errorContext} message={error} noticeRef={errorRef} />}

      {result ? <>
        <div className="import-stats">
          <ImportStat label="Lançamentos importados" value={result.importados} />
          <ImportStat label="Já existentes / repetidos ignorados" value={result.duplicadosIgnorados} />
          <ImportStat label="Erros" value={result.erros} />
        </div>
        <p>A listagem de faturamentos será atualizada automaticamente.</p>
        <div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>Concluir</button></div>
      </> : confirming ? <>
        <p>Importar {selectedRows.length} lançamento(s) de <strong>{preview?.arquivo || file?.name}</strong>, no total de <strong>{money(selectedRows.reduce((total, row) => total + Number(row.valor), 0))}</strong>?</p>
        <p>O peso será registrado em KG. O valor de cada faturamento será o total da planilha, sem multiplicá-lo pelo peso.</p>
        <p>A composição e a comissão de cada linha seguem a data do faturamento informada na planilha.</p>
        {withoutCommission > 0 && <div className="form-warning">{withoutCommission} lançamento(s) possui(em) composição fora da regra de 4, 7 ou 9 eixos e será(ão) importado(s) sem comissão de motorista.</div>}
        {Boolean(preview?.resumo.duplicadas) && <p>{preview?.resumo.duplicadas} linha(s) já existente(s) ou repetida(s) será(ão) ignorada(s) nesta importação.</p>}
        <p>Somente as linhas selecionadas serão importadas. Os lançamentos já existentes serão preservados.</p>
        <div className="modal-actions">
          <button type="button" className="button ghost" disabled={Boolean(busy)} onClick={() => setConfirming(false)}>Voltar para a prévia</button>
          <button type="button" className="button primary" disabled={Boolean(busy)} onClick={() => void confirmImport()}>{busy ? 'Importando...' : 'Confirmar importação'}</button>
        </div>
      </> : <>
        <div className="import-upload">
          <label>Selecionar planilha (.xls ou .xlsx)<input type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => selectFile(event.target.files?.[0])} /></label>
          <button type="button" className="button" disabled={!file || Boolean(busy)} onClick={() => void refreshPreview()}><Upload size={16} /> {busy === 'preview' ? 'Conferindo...' : preview ? 'Atualizar prévia' : 'Conferir planilha'}</button>
        </div>
        {catalogError && <div className="form-warning">{catalogError}</div>}
        {preview && <>
          <p><strong>Arquivo: {preview.arquivo || file?.name}</strong> · Confira os dados e escolha as linhas que deseja importar.</p>
          <p>Para cada frete, conferimos quais carretas estavam ligadas ao cavalo na data da planilha. Essa informação define os eixos e a comissão.</p>
          <div className="import-stats">
            <ImportStat label="Registros encontrados" value={preview.resumo.total} /><ImportStat label="Prontos" value={preview.resumo.prontas} />
            <ImportStat label="Já existentes / repetidos" value={preview.resumo.duplicadas} /><ImportStat label="Pendentes" value={preview.resumo.pendentes} />
            <ImportStat label="Inválidos" value={preview.resumo.invalidas} /><ImportStat label="Conflitos" value={preview.resumo.conflitos || 0} />
          </div>
          <FinancialImportIssuePanel rows={preview.linhas} selected={selected} dirty={dirty} disabled={Boolean(busy)} panelRef={issuePanelRef}
            onReview={reviewRow} onHistory={showHistory} onSelectReady={() => setSelected(preview.linhas.filter((row) => row.status === 'PRONTO').map((row) => row.linha))} onRefresh={() => void refreshPreview()} />
          <details className="import-batch">
            <summary>Aplicar comissão aos selecionados</summary>
            <div className="form-grid">
              <label>Tipo de comissão<SearchableSelect value={batchCommission.tipoComissao || ''} options={commissionTypes} ariaLabel="Tipo de comissão em lote" onChange={(value) => setBatchCommission((current) => ({ ...current, tipoComissao: value as CommissionType || undefined }))} /></label>
              {batchCommission.tipoComissao === 'PERCENTUAL' && <label>Percentual (%)<input type="number" min="0.01" max="100" step="0.01" placeholder="Usar padrão dos eixos" value={batchCommission.percentualComissao ?? ''} onChange={(event) => setBatchCommission((current) => ({ ...current, percentualComissao: event.target.value ? Number(event.target.value) : undefined }))} /></label>}
              {batchCommission.tipoComissao === 'POR_VIAGEM' && <label>Valor por viagem<input type="number" min="0.01" step="0.01" placeholder="Usar padrão dos eixos" value={batchCommission.valorComissaoPorViagem ?? ''} onChange={(event) => setBatchCommission((current) => ({ ...current, valorComissaoPorViagem: event.target.value ? Number(event.target.value) : undefined }))} /></label>}
              <label className="check-row"><input type="checkbox" checked={Boolean(batchCommission.descontoImpostos)} onChange={(event) => setBatchCommission((current) => ({ ...current, descontoImpostos: event.target.checked }))} /><span>Desconto de impostos (12% sobre a comissão)</span></label>
            </div>
            <small>O tipo é escolhido por você. Campos vazios usam os mesmos valores padrão do cadastro manual, conforme os eixos da composição vigente na data de cada faturamento.</small>
            <ImportBatchCommissionAction availability={batchAvailability} disabled={Boolean(busy)} onApply={applyBatchCommission} />
          </details>
          <div className="import-selection"><strong>{selected.length} linha(s) selecionada(s)</strong><button type="button" className="button ghost" disabled={Boolean(busy)} onClick={() => setSelected(preview.linhas.filter((row) => row.status === 'PRONTO').map((row) => row.linha))}>Selecionar prontas</button><button type="button" className="button ghost" disabled={Boolean(busy)} onClick={() => setSelected([])}>Limpar seleção</button></div>
          <div className="table-wrap import-table"><table>
            <thead><tr><th><input type="checkbox" aria-label="Selecionar todas as linhas disponíveis" disabled={Boolean(busy) || !eligibleRows.length} checked={Boolean(eligibleRows.length) && eligibleRows.every((row) => selected.includes(row.linha))} onChange={(event) => setSelected(event.target.checked ? eligibleRows.map((row) => row.linha) : [])} /></th><th>Linha</th><th>Data</th><th>Placa</th><th>Composição na data</th><th>Peso (KG)</th><th>Motorista</th><th>Pagador</th><th>Valor total</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>{preview.linhas.map((row) => <tr key={row.linha} className={row.linha === editingLine ? 'import-editing-row' : ''}>
              <td><input type="checkbox" aria-label={`Selecionar linha ${row.linha}`} disabled={Boolean(busy) || !canSelectImportRow(row)} checked={selected.includes(row.linha)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.linha] : current.filter((line) => line !== row.linha))} /></td>
              <td>{row.linha}</td><td>{importCalendarDate(row.data)}</td><td>{row.placa || '-'}{row.cavalo && row.cavalo.placa !== row.placa && <small>Associado: {row.cavalo.placa}</small>}</td>
              <td><ImportCompositionDetails row={row} /></td>
              <td>{formatWeight(row.peso)}</td><td>{row.motorista?.nome || row.motoristaExterno?.nome || '-'}{row.motorista && <small>Planilha: {row.motoristaExterno?.nome}</small>}</td>
              <td>{row.cliente?.nome || row.clienteExterno?.nome || '-'}{row.cliente && <small>Planilha: {row.clienteExterno?.nome}</small>}</td><td>{row.valor != null && row.valor !== '' && Number.isFinite(Number(row.valor)) ? money(row.valor) : '-'}</td>
              <td><strong>{financialImportStatus(row.status)}</strong>{financialImportIssues(row).length ? financialImportIssues(row).map((issue) => <small className="import-row-issue" key={issue.code}>{issue.title}</small>) : row.pendencias?.map((message, index) => <small key={index}>{message}</small>)}</td>
              <td>{(canEditImportRow(row) || financialImportIssues(row).length > 0) && <button type="button" className="button ghost" disabled={Boolean(busy)} onClick={() => reviewRow(row)}>{row.status === 'PRONTO' ? 'Conferir linha' : 'Como resolver'}</button>}</td>
            </tr>)}</tbody>
          </table></div>
          {editingRow && (canEditImportRow(editingRow) || financialImportIssues(editingRow).length > 0) && <div ref={editorRef} tabIndex={-1} className="import-review-target" aria-label={`Conferir linha ${editingRow.linha}`}><ImportRowEditor row={editingRow} selection={selections[editingRow.linha]} catalog={catalog} disabled={Boolean(busy) || !canEditImportRow(editingRow)} historyDisabled={dirty} onHistory={showHistory} onChange={(changes) => updateSelection(editingRow.linha, changes)} onReset={() => {
            setSelections((current) => Object.fromEntries(Object.entries(current).filter(([line]) => Number(line) !== editingRow.linha)));
            setDirty(true);
          }} /></div>}
          <div className="modal-actions"><button type="button" className="button ghost" disabled={Boolean(busy)} onClick={onClose}>Cancelar</button><button type="button" className="button" disabled={Boolean(busy) || !file} onClick={() => void refreshPreview()}>Atualizar prévia</button><button type="button" className="button primary" disabled={!ready || Boolean(busy)} onClick={() => setConfirming(true)}>{ready && !selected.length ? 'Concluir conferência' : `Importar ${selected.length} selecionado(s)`}</button></div>
          {!dirty && selectedRows.some((row) => row.status !== 'PRONTO') && <p className="import-footer-help">A importação está bloqueada pelas linhas selecionadas com pendência. Use <strong>Como resolver</strong> ou <strong>Selecionar apenas as prontas</strong> no aviso acima.</p>}
        </>}
      </>}
    </div>
  </div>{historyRow?.cavalo && <HistoricoOperacionalModal resource={{ path: 'caminhoes', endpoint: '/caminhoes' }} item={historyRow.cavalo}
    notice={`Confira quais carretas estavam ligadas ao cavalo ${historyRow.cavalo.placa} em ${importCalendarDate(historyRow.data)}. O cadastro atual pode ser diferente. Esta consulta não altera os registros; a planilha continua aberta para você voltar e atualizar a prévia.`}
    closeLabel="Voltar para a importação" onClose={() => { setHistoryRow(null); reviewRow(historyRow); }} />}</>;
}

const commissionTypes = [{ value: 'PERCENTUAL', label: 'Percentual' }, { value: 'POR_VIAGEM', label: 'Por viagem' }];

export function ImportBatchCommissionAction({ availability, disabled, onApply }: {
  availability: ReturnType<typeof batchImportCommissionAvailability>;
  disabled: boolean;
  onApply: () => void;
}) {
  return <div className="import-selection">
    <button type="button" className="button" disabled={disabled || !availability.elegiveis} onClick={onApply}>Aplicar aos selecionados</button>
    <span role="status">{availability.mensagem}</span>
  </div>;
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function formatWeight(value: string | null) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '-';
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function ImportCompositionDetails({ row }: { row: ImportRow }) {
  return <>
    <span>{row.conjunto?.nome || 'Carretas nesta data: a conferir'}</span>
    <small>{row.quantidadeEixos != null ? `${row.quantidadeEixos} eixos · ` : ''}{importCalendarDate(row.data)}</small>
  </>;
}

export function ImportRowEditor({ row, selection, catalog, disabled, historyDisabled = false, onHistory, onChange, onReset }: { row: ImportRow; selection?: ImportSelection; catalog: Catalog; disabled: boolean; historyDisabled?: boolean; onHistory?: (row: ImportRow) => void; onChange: (changes: Partial<ImportSelection>) => void; onReset: () => void }) {
  const currentCommission = { ...row.comissao, ...selection };
  const changedHorse = Boolean(selection?.cavaloMecanicoId && selection.cavaloMecanicoId !== row.cavalo?.id);
  const defaults = commissionDefaults(row.quantidadeEixos || 0);
  const values = commissionValues(Number(row.valor), currentCommission.percentualComissao, currentCommission.valorComissaoPorViagem);
  const commission = commissionAfterTaxDiscount(selectedCommissionValue(currentCommission.tipoComissao, values), currentCommission.descontoImpostos);
  const horseOptions = new Map([...catalog.cavalos, ...(row.cavalo ? [row.cavalo] : [])].map((cavalo) => [cavalo.id, { value: cavalo.id, label: cavalo.placa }]));
  return <div className="import-editor">
    <div className="section-title"><h3>Conferir linha {row.linha}</h3><span>{row.placa} · {importCalendarDate(row.data)}</span></div>
    <ImportRowProblemHelp row={row} disabled={disabled || historyDisabled || changedHorse} onHistory={onHistory} />
    <div className="form-grid">
      <label>Cavalo mecânico<SearchableSelect value={selection?.cavaloMecanicoId || row.cavalo?.id || ''} options={[...horseOptions.values()]} disabled={disabled} ariaLabel={`Cavalo da linha ${row.linha}`} onChange={(value) => { if (value) onChange(selectImportHorse(row, selection, value)); }} /><small>Placa na planilha: {row.placa || '-'}</small></label>
      <label>Motorista<SearchableSelect value={selection?.motoristaId || row.motorista?.id || ''} options={importEntityOptions(catalog.motoristas, row.sugestoesMotorista, row.motorista)} disabled={disabled} ariaLabel={`Motorista da linha ${row.linha}`} onChange={(value) => { if (value) onChange({ motoristaId: value }); }} /><small>Motorista da planilha: {externalName(row.motoristaExterno)}</small></label>
      <label>Cliente / pagador<SearchableSelect value={selection?.clienteId || row.cliente?.id || ''} options={importEntityOptions(catalog.clientes, row.sugestoesCliente, row.cliente)} disabled={disabled} ariaLabel={`Cliente da linha ${row.linha}`} onChange={(value) => { if (value) onChange({ clienteId: value }); }} /><small>Pagador da planilha: {externalName(row.clienteExterno)}</small></label>
    </div>
    {changedHorse ? <div className="form-warning">Você alterou o cavalo. Clique em Atualizar prévia para conferir as carretas, os eixos e a comissão do cavalo escolhido.</div> : !row.cavalo || !row.conjunto || row.quantidadeEixos == null || row.status === 'PENDENTE_COMPOSICAO' ? null : defaults ? <div className="commission-section">
      <div className="commission-heading"><strong>Comissão de motorista</strong><span><ImportCompositionDetails row={row} /></span></div>
      <div className="form-grid">
        <label>Tipo de comissão<SearchableSelect value={currentCommission.tipoComissao || ''} options={commissionTypes} disabled={disabled} ariaLabel={`Comissão da linha ${row.linha}`} onChange={(value) => onChange(value ? importCommissionForType(row.quantidadeEixos, value as CommissionType, currentCommission) : { tipoComissao: undefined })} /></label>
        {currentCommission.tipoComissao === 'PERCENTUAL' && <label>Percentual (%)<input type="number" min="0.01" max="100" step="0.01" disabled={disabled} value={currentCommission.percentualComissao ?? ''} onChange={(event) => onChange({ percentualComissao: Number(event.target.value) })} /></label>}
        {currentCommission.tipoComissao === 'POR_VIAGEM' && <label>Valor por viagem<input type="number" min="0.01" step="0.01" disabled={disabled} value={currentCommission.valorComissaoPorViagem ?? ''} onChange={(event) => onChange({ valorComissaoPorViagem: Number(event.target.value) })} /></label>}
        <label className="check-row"><input type="checkbox" disabled={disabled || !currentCommission.tipoComissao} checked={Boolean(currentCommission.descontoImpostos)} onChange={(event) => onChange({ descontoImpostos: event.target.checked })} /><span>Desconto de impostos (12% sobre a comissão)</span></label>
      </div>
      {currentCommission.tipoComissao && <div className="commission-summary"><div><span>Comissão bruta</span><strong>{money(commission.gross)}</strong></div><div><span>Desconto de impostos</span><strong>{money(commission.taxDiscount)}</strong></div><div><span>Comissão líquida</span><strong>{money(commission.net)}</strong></div></div>}
    </div> : <div className="form-warning">Composição {row.conjunto.nome}, com {row.quantidadeEixos} eixos em {importCalendarDate(row.data)}: este faturamento não gera comissão. Você confirmará essa condição antes de importar.</div>}
    <small>Escolha cadastros existentes e atualize a prévia para conferir as associações. Nenhum cadastro será criado automaticamente.</small>
    {selection && <button type="button" className="button ghost" disabled={disabled} onClick={onReset}>Desfazer ajustes desta linha</button>}
  </div>;
}

function externalName(entity: { codigo: string | null; nome: string } | null | undefined) {
  return entity ? [entity.codigo, entity.nome].filter(Boolean).join(' / ') || '-' : '-';
}
