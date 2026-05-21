import { maskDocument, maskPhone, maskPlate } from '../utils/formatters';

export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'number' | 'select' | 'textarea' | 'password' | 'money' | 'checkbox';
  options?: { label: string; value: string }[];
  relation?: {
    endpoint: string;
    labelKey: string;
    fallbackKey?: string;
    objectKey?: string;
    valueKey?: string;
    params?: Record<string, string>;
  };
  mask?: (value: string) => string;
  table?: boolean;
  required?: boolean;
  hidden?: boolean;
};

export type Resource = {
  title: string;
  path: string;
  endpoint: string;
  fields: Field[];
  fixedParams?: Record<string, string>;
  fixedValues?: Record<string, string>;
};

const statusGeral = [
  { label: 'Ativo', value: 'ATIVO' },
  { label: 'Inativo', value: 'INATIVO' },
];

const lancamentoFields: Field[] = [
  { name: 'data', label: 'Data', type: 'date', required: true, table: true },
  { name: 'placaOuPessoa', label: 'Placa', type: 'select', required: true, table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', valueKey: 'placa' } },
  { name: 'motoristaId', label: 'Motorista', type: 'select', required: true, table: true, relation: { endpoint: '/motoristas', labelKey: 'nome', fallbackKey: 'cpf', objectKey: 'motorista' } },
  { name: 'fornecedorId', label: 'Fornecedor', type: 'select', required: true, table: true, relation: { endpoint: '/fornecedores', labelKey: 'nome', fallbackKey: 'documento', objectKey: 'fornecedor' } },
  { name: 'clienteId', label: 'Cliente', type: 'select', relation: { endpoint: '/clientes', labelKey: 'nome', fallbackKey: 'documento', objectKey: 'cliente' } },
  { name: 'tipoLancamento', label: 'Tipo', type: 'select', required: true, table: true, options: [{ label: 'Despesa', value: 'DESPESA' }, { label: 'Faturamento', value: 'FATURAMENTO' }] },
  { name: 'categoriaId', label: 'Categoria', type: 'select', table: true, relation: { endpoint: '/categorias-financeiras', labelKey: 'nome', fallbackKey: 'tipoLancamento', objectKey: 'categoriaFinanceira' } },
  { name: 'descricao', label: 'Descricao', table: true },
  { name: 'quantidade', label: 'Quantidade', type: 'number', required: true },
  { name: 'unidadeQuantidade', label: 'Unidade da quantidade', type: 'select', required: true, options: [{ label: 'KG', value: 'KG' }, { label: 'Unidade', value: 'UNIDADE' }] },
  { name: 'valorUnitario', label: 'Valor unitario', type: 'money', required: true, table: true },
  { name: 'valorTotal', label: 'Valor total', type: 'money', table: true },
  { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
];

export const crudResources: Resource[] = [
  {
    title: 'Clientes',
    path: 'clientes',
    endpoint: '/clientes',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'documento', label: 'CPF/CNPJ', table: true, mask: maskDocument },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone },
      { name: 'email', label: 'Email', type: 'email', table: true },
      { name: 'endereco', label: 'Endereco' },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
      { name: 'ativo', label: 'Ativo', type: 'checkbox', required: true },
    ],
  },
  {
    title: 'Funcionarios',
    path: 'funcionarios',
    endpoint: '/funcionarios',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'cpf', label: 'CPF', required: true, table: true, mask: maskDocument },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone },
      { name: 'cargo', label: 'Cargo', table: true },
      { name: 'dataAdmissao', label: 'Data admissao', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: [{ label: 'Ativo', value: 'ATIVO' }, { label: 'Afastado', value: 'AFASTADO' }, { label: 'Desligado', value: 'DESLIGADO' }] },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Motoristas',
    path: 'motoristas',
    endpoint: '/motoristas',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'cpf', label: 'CPF', table: true, mask: maskDocument },
      { name: 'cnh', label: 'CNH', table: true },
      { name: 'categoriaCnh', label: 'Categoria CNH' },
      { name: 'validadeCnh', label: 'Validade CNH', type: 'date' },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Caminhoes',
    path: 'caminhoes',
    endpoint: '/caminhoes',
    fields: [
      { name: 'placa', label: 'Placa', required: true, table: true, mask: maskPlate },
      { name: 'marca', label: 'Marca', table: true },
      { name: 'modelo', label: 'Modelo', table: true },
      { name: 'ano', label: 'Ano', type: 'number', table: true },
      { name: 'tipo', label: 'Tipo', table: true },
      { name: 'cor', label: 'Cor' },
      { name: 'chassi', label: 'Chassi' },
      { name: 'renavam', label: 'Renavam' },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Acompanhamentos',
    path: 'acompanhamentos',
    endpoint: '/acompanhamentos',
    fields: [
      { name: 'caminhaoId', label: 'Caminhao', type: 'select', required: true, table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'caminhao' } },
      { name: 'motoristaId', label: 'Motorista', type: 'select', required: true, table: true, relation: { endpoint: '/motoristas', labelKey: 'nome', fallbackKey: 'cpf', objectKey: 'motorista' } },
      { name: 'tipoOperacao', label: 'Tipo operacao', required: true, table: true },
      { name: 'tipoVeiculo', label: 'Tipo veiculo', required: true, table: true },
      { name: 'dataInicio', label: 'Data inicio', type: 'date' },
      { name: 'dataFim', label: 'Data fim', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Ativo', value: 'ATIVO' }, { label: 'Encerrado', value: 'ENCERRADO' }] },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Engates de carretas',
    path: 'engates-carretas',
    endpoint: '/engates-carretas',
    fields: [
      { name: 'cavaloId', label: 'Cavalo', type: 'select', required: true, table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'cavalo' } },
      { name: 'carreta1Id', label: 'Carreta 1', type: 'select', table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'carreta1' } },
      { name: 'carreta2Id', label: 'Carreta 2', type: 'select', table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'carreta2' } },
      { name: 'motoristaId', label: 'Motorista', type: 'select', table: true, relation: { endpoint: '/motoristas', labelKey: 'nome', fallbackKey: 'cpf', objectKey: 'motorista' } },
      { name: 'dataInicio', label: 'Data inicio', type: 'date', required: true, table: true },
      { name: 'dataFim', label: 'Data fim', type: 'date', table: true },
      { name: 'status', label: 'Status', type: 'select', table: true, options: [{ label: 'Ativo', value: 'ATIVO' }, { label: 'Encerrado', value: 'ENCERRADO' }] },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Fornecedores',
    path: 'fornecedores',
    endpoint: '/fornecedores',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'documento', label: 'CPF/CNPJ', table: true, mask: maskDocument },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone },
      { name: 'email', label: 'Email', type: 'email', table: true },
      { name: 'endereco', label: 'Endereco' },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
      { name: 'ativo', label: 'Ativo', type: 'checkbox' },
    ],
  },
  {
    title: 'Categorias financeiras',
    path: 'categorias-financeiras',
    endpoint: '/categorias-financeiras',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'tipoLancamento', label: 'Tipo', type: 'select', table: true, options: [{ label: 'Despesa', value: 'DESPESA' }, { label: 'Faturamento', value: 'FATURAMENTO' }] },
      { name: 'ativo', label: 'Ativo', type: 'checkbox', table: true },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Despesas',
    path: 'despesas',
    endpoint: '/lancamentos-financeiros',
    fixedParams: { tipoLancamento: 'DESPESA' },
    fixedValues: { tipoLancamento: 'DESPESA' },
    fields: lancamentoFields
      .filter((field) => field.name !== 'clienteId')
      .map((field) => {
        if (field.name === 'tipoLancamento') return { ...field, table: false, hidden: true };
        if (field.name === 'categoriaId') return { ...field, relation: { ...field.relation!, params: { tipoLancamento: 'DESPESA' } } };
        if (field.name === 'clienteId') return { ...field, table: false };
        return field;
      }),
  },
  {
    title: 'Faturamento',
    path: 'faturamento',
    endpoint: '/lancamentos-financeiros',
    fixedParams: { tipoLancamento: 'FATURAMENTO' },
    fixedValues: { tipoLancamento: 'FATURAMENTO' },
    fields: lancamentoFields
      .filter((field) => field.name !== 'fornecedorId')
      .map((field) => {
        if (field.name === 'tipoLancamento') return { ...field, table: false, hidden: true };
        if (field.name === 'clienteId') return { ...field, required: true, table: true };
        if (field.name === 'fornecedorId') return { ...field, table: false };
        if (field.name === 'categoriaId') return { ...field, relation: { ...field.relation!, params: { tipoLancamento: 'FATURAMENTO' } } };
        return field;
      }),
  },
  {
    title: 'Lancamentos financeiros',
    path: 'lancamentos-financeiros',
    endpoint: '/lancamentos-financeiros',
    fields: lancamentoFields,
  },
  {
    title: 'Usuarios',
    path: 'users',
    endpoint: '/users',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'email', label: 'Email', type: 'email', required: true, table: true },
      { name: 'senha', label: 'Senha', type: 'password' },
      { name: 'perfil', label: 'Perfil', type: 'select', table: true, options: [{ label: 'Admin', value: 'ADMIN' }, { label: 'Usuario', value: 'USUARIO' }] },
      { name: 'ativo', label: 'Ativo', type: 'checkbox', table: true },
    ],
  },
];
