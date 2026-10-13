import { commissionDefaults } from './commission';
import { importCalendarDate, ImportRow } from './financialImport';

export type FinancialImportIssue = {
  code: 'CAVALO' | 'MOTORISTA' | 'CLIENTE' | 'COMPOSICAO' | 'COMISSAO' | 'PLANILHA' | 'CONFLITO' | 'DESCONHECIDO';
  title: string;
  summary: string;
  steps: string[];
  actionLabel: 'Conferir associações' | 'Informar comissão' | 'Conferir histórico do cavalo' | 'Corrigir planilha' | 'Revisar conflito';
};

const statusIssue: Record<string, FinancialImportIssue['code']> = {
  PLACA_NAO_ENCONTRADA: 'CAVALO', PENDENTE_MOTORISTA: 'MOTORISTA', PENDENTE_CLIENTE: 'CLIENTE',
  PENDENTE_COMPOSICAO: 'COMPOSICAO', PENDENTE_COMISSAO: 'COMISSAO', DADOS_INVALIDOS: 'PLANILHA', CONFLITO: 'CONFLITO',
};

function validCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function invalidCommissionValue(value: number | undefined, max = 999_999_999_999.99) {
  return value !== undefined && (!Number.isFinite(value) || value <= 0 || value > max
    || Math.abs(value * 100 - Math.round(value * 100)) > 0.001);
}

export function financialImportIssues(row: ImportRow): FinancialImportIssue[] {
  if (['PRONTO', 'DUPLICADO', 'DUPLICADO_ARQUIVO'].includes(row.status)) return [];
  if (!Object.prototype.hasOwnProperty.call(statusIssue, row.status)) return [{
    code: 'DESCONHECIDO', title: 'Confira esta linha antes de importar',
    summary: `A linha ${row.linha} tem uma situação que precisa de conferência.`,
    steps: ['Atualize a prévia e confira os detalhes apresentados para esta linha.', 'Se a situação continuar, peça ao responsável financeiro para verificar antes de importar.'],
    actionLabel: 'Conferir associações',
  }];

  const issues: FinancialImportIssue[] = [];
  const dateValid = validCalendarDate(row.data);
  if (row.status === 'DADOS_INVALIDOS' || !dateValid) issues.push({
    code: 'PLANILHA', title: 'Corrija os dados desta linha na planilha',
    summary: dateValid ? `A linha ${row.linha} contém dados que não podem ser importados.` : `A data do faturamento na linha ${row.linha} está ausente ou inválida.`,
    steps: ['Confira as células indicadas nos detalhes da linha, incluindo data, placa, peso e valor.', 'Corrija os dados na planilha original e salve uma nova versão do arquivo.', 'Selecione o arquivo corrigido e clique em Conferir planilha.'],
    actionLabel: 'Corrigir planilha',
  });
  if (row.status === 'CONFLITO') issues.push({
    code: 'CONFLITO', title: 'Confira o conflito com o responsável financeiro',
    summary: `Os dados ou as associações da linha ${row.linha} entram em conflito com registros já confirmados.`,
    steps: ['Compare o CTRC, a data, o valor e as associações com os registros existentes.', 'Peça ao responsável financeiro para verificar qual informação está correta. O lançamento existente será preservado.', 'Não altere a chave ou o CTRC para contornar o conflito e não reenvie o mesmo CTRC com dados modificados como tentativa de correção.'],
    actionLabel: 'Revisar conflito',
  });
  if (!row.cavalo?.id || row.status === 'PLACA_NAO_ENCONTRADA') issues.push({
    code: 'CAVALO', title: 'Escolha o cavalo correto para esta linha',
    summary: row.placa ? `A placa ${row.placa} da planilha ainda precisa ser associada ao cavalo correto.` : 'A placa da planilha não foi identificada nesta linha.',
    steps: ['Confira a placa na planilha. Se estiver incorreta, corrija o arquivo original.', 'No campo Cavalo mecânico desta linha, selecione o cavalo correto.', row.modoComposicao === 'CADASTRO_MANUAL' ? 'Clique em Atualizar prévia para conferir a composição atual e a comissão, como no cadastro manual.' : 'Clique em Atualizar prévia para verificar a associação e as carretas usadas na data do faturamento.'],
    actionLabel: 'Conferir associações',
  });
  if (!row.motorista?.id || row.status === 'PENDENTE_MOTORISTA') issues.push({
    code: 'MOTORISTA', title: 'Escolha o motorista desta linha',
    summary: `O motorista ${row.motoristaExterno.nome || 'informado na planilha'} ainda precisa de uma associação confirmada.`,
    steps: ['No campo Motorista desta linha, selecione o motorista correto entre os cadastros existentes.', 'Confira o nome da planilha e as sugestões antes de escolher.', 'Clique em Atualizar prévia para validar a associação.'],
    actionLabel: 'Conferir associações',
  });
  if (!row.cliente?.id || row.status === 'PENDENTE_CLIENTE') issues.push({
    code: 'CLIENTE', title: 'Escolha o cliente ou pagador desta linha',
    summary: `O pagador ${row.clienteExterno.nome || 'informado na planilha'} ainda precisa de uma associação confirmada.`,
    steps: ['No campo Cliente / pagador desta linha, selecione o cadastro correto.', 'Confira o nome da planilha e as sugestões antes de escolher.', 'Clique em Atualizar prévia para validar a associação.'],
    actionLabel: 'Conferir associações',
  });

  const manual = row.modoComposicao === 'CADASTRO_MANUAL';
  const compositionResolved = Boolean(row.cavalo?.id && dateValid && (manual || row.conjunto?.id
    && row.quantidadeEixos != null && Number.isInteger(row.quantidadeEixos) && row.quantidadeEixos >= 0
    ) && row.status !== 'PENDENTE_COMPOSICAO');
  if (row.cavalo?.id && dateValid && !compositionResolved) {
    const placa = row.cavalo.placa;
    const data = importCalendarDate(row.data);
    issues.push({
      code: 'COMPOSICAO', title: 'Confira as carretas usadas nesta data',
      summary: `Não foi possível confirmar quais carretas estavam com o cavalo ${placa} em ${data}. Os eixos e a comissão desse faturamento ainda não podem ser determinados.`,
      steps: [`Clique em Ver histórico do cavalo e confira quais carretas aparecem para ${placa} em ${data}.`, 'Se faltar um registro ou aparecerem duas composições ao mesmo tempo, peça ao responsável pela frota ou ao suporte para corrigir os registros desse período. Mudar apenas o cadastro atual não comprova as carretas de uma viagem antiga.', 'Depois da correção, volte à importação e clique em Atualizar prévia. Escolher uma comissão não resolve a falta dessa informação.'],
      actionLabel: 'Conferir histórico do cavalo',
    });
  }
  const commission = row.comissao;
  const commissionInvalid = !['PERCENTUAL', 'POR_VIAGEM'].includes(commission.tipoComissao || '')
    || invalidCommissionValue(commission.percentualComissao, 100)
    || invalidCommissionValue(commission.valorComissaoPorViagem);
  if (compositionResolved && row.comissaoNecessaria && commissionDefaults(row.quantidadeEixos || 0)
    && (row.status === 'PENDENTE_COMISSAO' || commissionInvalid)) issues.push({
    code: 'COMISSAO', title: 'Informe como a comissão será calculada',
    summary: `A composição usada neste cadastro tem ${row.quantidadeEixos} eixos. Falta escolher ou corrigir a comissão do motorista.`,
    steps: ['Na própria linha, escolha o tipo de comissão: percentual ou por viagem.', 'Confira o percentual ou o valor por viagem. Use um valor positivo, com até duas casas decimais; o percentual deve ser de até 100%.', 'Confira a opção de desconto de impostos e clique em Atualizar prévia.'],
    actionLabel: 'Informar comissão',
  });
  const priority = !dateValid ? 'PLANILHA' : statusIssue[row.status];
  return issues.sort((a, b) => Number(b.code === priority) - Number(a.code === priority));
}
