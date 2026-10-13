import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ImportRow } from '../utils/financialImport';
import { FinancialImportIssuePanel, ImportErrorNotice, ImportRowProblemHelp } from './FinancialImportIssues';
import { HistoricoOperacionalModal } from './OperationalHistoryModal';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const row: ImportRow = {
  linha: 3, chaveExterna: 'ctrc:12345', data: '2026-10-11', placa: 'NSC1I98', peso: '32500', valor: '4850',
  cavalo: { id: 'horse-1', placa: 'NSC1I98' }, conjunto: null, motorista: { id: 'driver-1', nome: 'João' }, cliente: { id: 'client-1', nome: 'Cliente' },
  motoristaExterno: { codigo: '1', nome: 'João' }, clienteExterno: { codigo: '2', nome: 'Cliente' },
  sugestoesMotorista: [], sugestoesCliente: [], quantidadeEixos: null, comissaoNecessaria: false,
  comissao: {}, status: 'PENDENTE_COMPOSICAO', pendencias: ['Não há histórico operacional suficiente.'],
};
const noop = () => undefined;
const ready = { ...row, linha: 4, status: 'PRONTO', conjunto: { id: 'set-7', nome: 'Bitrem' }, quantidadeEixos: 7 };

function panel(rows: ImportRow[], selected: number[], dirty = false) {
  return renderToStaticMarkup(<FinancialImportIssuePanel rows={rows} selected={selected} dirty={dirty} disabled={false}
    onReview={noop} onHistory={noop} onSelectReady={noop} onRefresh={noop} />);
}

describe('avisos visíveis e ações para resolver a importação', () => {
  it('identifica a linha, placa, data e causa do bloqueio com ação direta para consultar o histórico', () => {
    const html = panel([row, ready], [3, 4]);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('1 linha selecionada precisa de correção');
    expect(html).toContain('A importação está bloqueada');
    expect(html).toContain('Linha 3 · NSC1I98');
    expect(html).toContain('11/10/2026');
    expect(html).toContain('Não foi possível confirmar quais carretas');
    expect(html).toContain('Como resolver a linha 3');
    expect(html).toContain('Ver histórico do cavalo');
    expect(html).toContain('Selecionar apenas 1 linha pronta');
  });

  it('diferencia pendência desmarcada de bloqueio da seleção que será importada', () => {
    const html = panel([row, ready], [4]);
    expect(html).toContain('ficou fora da seleção');
    expect(html).toContain('Você pode importar as linhas prontas');
    expect(html).not.toContain('A importação está bloqueada');
  });

  it('prioriza linhas selecionadas e limita a lista inicial sem esconder que existem outras pendências', () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ ...row, linha: index + 2 }));
    const html = panel(rows, [8]);
    expect(html.indexOf('Linha 8 ·')).toBeLessThan(html.indexOf('Linha 2 ·'));
    expect(html).toContain('Mostrar mais pendências (2)');
  });

  it('pede revalidar alterações e impede seleção pronta ou consulta de histórico desatualizadas', () => {
    const html = panel([row, ready], [3, 4], true);
    expect(html).toContain('Confira suas alterações antes de importar');
    expect(html).toContain('Atualizar prévia');
    const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
    expect(buttons.find((button) => button.includes('Selecionar apenas'))).toContain('disabled=""');
    expect(buttons.find((button) => button.includes('Ver histórico do cavalo'))).toContain('disabled=""');
  });

  it('não apresenta linhas prontas ou duplicadas como problemas', () => {
    expect(panel([ready, { ...row, status: 'DUPLICADO' }], [4])).toBe('');
  });

  it.each(['DADOS_INVALIDOS', 'CONFLITO'])('explica que não há linhas prontas quando todas estão em %s', (status) => {
    const html = panel([{ ...ready, status }], []);
    expect(html).toContain('Nenhuma linha está pronta para importar');
    expect(html).toContain('Resolva as pendências abaixo');
    expect(html).not.toContain('Você pode importar as linhas prontas');
    expect(html).not.toContain('Selecionar apenas');
  });

  it('dá passos reais para histórico e guarda a explicação técnica em detalhes consultáveis', () => {
    const html = renderToStaticMarkup(<ImportRowProblemHelp row={row} disabled={false} onHistory={noop} />);
    expect(html).toContain('O que precisa ser corrigido nesta linha');
    expect(html).toContain('<ol>');
    expect(html).toContain('Ver histórico do cavalo NSC1I98');
    expect(html).toContain('responsável pela frota ou ao suporte');
    expect(html).toContain('Mudar apenas o cadastro atual não comprova');
    expect(html).toContain('Atualizar prévia');
    expect(html).toContain('<details><summary>Ver detalhes da conferência</summary>');
    expect(html).toContain(row.pendencias[0]);
    expect(html).not.toContain('name="conjuntoId"');
  });

  it('orienta correção na planilha original quando o problema não pode ser editado na prévia', () => {
    const html = renderToStaticMarkup(<ImportRowProblemHelp row={{ ...ready, status: 'DADOS_INVALIDOS' }} disabled={true} />);
    expect(html).toContain('Corrija os dados desta linha na planilha');
    expect(html).toContain('planilha original');
    expect(html).toContain('Selecione o arquivo corrigido');
  });

  it.each([
    ['arquivo', 'Confira o arquivo escolhido', 'Escolha uma planilha Excel'],
    ['previa', 'Não foi possível conferir a planilha', 'tente conferir a planilha novamente'],
    ['confirmacao', 'A importação não foi concluída', 'Atualize a prévia'],
    ['comissao', 'A comissão precisa de ajuste', 'escolha o tipo de comissão'],
  ] as const)('mostra erro de %s como alerta focável com motivo e próximo passo', (context, title, action) => {
    const html = renderToStaticMarkup(<ImportErrorNotice context={context} message="Motivo apresentado pelo servidor" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain(title);
    expect(html).toContain('Motivo apresentado pelo servidor');
    expect(html).toContain('Como resolver:');
    expect(html).toContain(action);
  });

  it('oferece consulta de histórico com identificação do cavalo e volta explícita à importação', () => {
    const html = renderToStaticMarkup(<HistoricoOperacionalModal resource={{ path: 'caminhoes', endpoint: '/caminhoes' }} item={row.cavalo}
      notice="Confira as carretas em 11/10/2026. A planilha continua aberta." closeLabel="Voltar para a importação" onClose={noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Histórico do cavalo NSC1I98');
    expect(html).toContain('A planilha continua aberta');
    expect(html).toContain('Voltar para a importação');
  });
});
