import { maskDocument, maskPhone, maskPlate } from '../utils/formatters';

export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'number' | 'select' | 'multiselect' | 'textarea' | 'password' | 'money' | 'checkbox';
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
  sortable?: boolean;
  sortKey?: string;
  filterKey?: string;
  filterType?: 'text' | 'date' | 'number' | 'select';
  filterOptions?: { label: string; value: string }[];
  required?: boolean;
  maxLength?: number;
  hidden?: boolean;
  showWhen?: { field: string; hasValue?: boolean };
};

export type Resource = {
  title: string;
  path: string;
  endpoint: string;
  fields: Field[];
  readOnly?: boolean;
  fixedParams?: Record<string, string>;
  fixedValues?: Record<string, string>;
};

export function resourceListPath(resource: Pick<Resource, 'path'>) {
  return `/${resource.path}`;
}

const statusGeral = [
  { label: 'Ativo', value: 'ATIVO' },
  { label: 'Inativo', value: 'INATIVO' },
  { label: 'Manutenção', value: 'MANUTENCAO' },
];

const tiposCavalo = [
  { label: 'Simples / Toco (4x2) - 2 eixos, para cargas menores', value: 'SIMPLES_TOCO_4X2' },
  { label: 'Trucado (6x2) - 3 eixos, um eixo traseiro com tração', value: 'TRUCADO_6X2' },
  { label: 'Traçado (6x4) - 3 eixos, dois eixos com tração', value: 'TRACADO_6X4' },
];

export const tiposImplemento = [
  { label: 'Carreta', value: 'CARRETA' },
  { label: 'Semirreboque', value: 'SEMIRREBOQUE' },
  { label: 'Reboque', value: 'REBOQUE' },
  { label: 'Dolly', value: 'DOLLY' },
];

export const carrocerias = [
  { label: 'Baú', value: 'BAU' },
  { label: 'Graneleiro', value: 'GRANELEIRO' },
  { label: 'Sider', value: 'SIDER' },
  { label: 'Tanque', value: 'TANQUE' },
  { label: 'Prancha', value: 'PRANCHA' },
  { label: 'Outro', value: 'OUTRO' },
];

const lancamentoFields: Field[] = [
  { name: 'data', label: 'Data', type: 'date', required: true, table: true, sortable: true, filterKey: 'data', filterType: 'date' },
  { name: 'cavaloMecanicoId', label: 'Cavalo mecânico', type: 'select', required: true, table: true, sortable: true, filterKey: 'cavalo', filterType: 'text', relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'cavaloMecanico' } },
  { name: 'conjuntoId', label: 'Conjunto usado', type: 'select', hidden: true, relation: { endpoint: '/conjuntos', labelKey: 'nome', fallbackKey: 'tipo', objectKey: 'conjunto' } },
  { name: 'motoristaId', label: 'Motorista', type: 'select', table: true, sortable: true, filterKey: 'motorista', filterType: 'text', relation: { endpoint: '/motoristas', labelKey: 'nome', fallbackKey: 'cpf', objectKey: 'motorista' } },
  { name: 'fornecedorId', label: 'Fornecedor', type: 'select', required: true, table: true, sortable: true, filterKey: 'fornecedor', filterType: 'text', relation: { endpoint: '/fornecedores', labelKey: 'nome', fallbackKey: 'documento', objectKey: 'fornecedor' } },
  { name: 'clienteId', label: 'Cliente', type: 'select', filterKey: 'cliente', filterType: 'text', relation: { endpoint: '/clientes', labelKey: 'nome', fallbackKey: 'documento', objectKey: 'cliente' } },
  { name: 'tipoLancamento', label: 'Tipo', type: 'select', required: true, table: true, options: [{ label: 'Despesa', value: 'DESPESA' }, { label: 'Faturamento', value: 'FATURAMENTO' }] },
  { name: 'categoriaId', label: 'Categoria', type: 'select', table: true, sortable: true, filterKey: 'categoria', filterType: 'text', relation: { endpoint: '/categorias-financeiras', labelKey: 'nome', fallbackKey: 'tipoLancamento', objectKey: 'categoriaFinanceira' } },
  { name: 'descricao', label: 'Descrição' },
  { name: 'quantidade', label: 'Quantidade', type: 'number', required: true, table: true, sortable: true, filterKey: 'quantidade', filterType: 'number' },
  { name: 'unidadeQuantidade', label: 'Unidade da quantidade', type: 'select', required: true, options: [{ label: 'KG', value: 'KG' }, { label: 'Litros', value: 'LITROS' }, { label: 'Unidade', value: 'UNIDADE' }] },
  { name: 'valorUnitario', label: 'Valor unitário', type: 'money', required: true, table: true, sortable: true, filterKey: 'valorUnitario', filterType: 'number' },
  { name: 'multiplicarQuantidade', label: 'Multiplicar quantidade pelo valor unitário', type: 'checkbox', required: true },
  { name: 'valorTotal', label: 'Valor total', type: 'money', table: true, sortable: true, filterKey: 'valorTotal', filterType: 'number' },
  { name: 'observacoes', label: 'Observações', type: 'textarea' },
];

export const crudResources: Resource[] = [
  {
    title: 'Clientes',
    path: 'clientes',
    endpoint: '/clientes',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true, filterKey: 'nome', filterType: 'text' },
      { name: 'documento', label: 'CPF/CNPJ', table: true, mask: maskDocument, filterKey: 'documento', filterType: 'text' },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone, filterKey: 'telefone', filterType: 'text' },
      { name: 'email', label: 'E-mail', type: 'email', table: true, filterKey: 'email', filterType: 'text' },
      { name: 'endereco', label: 'Endereço' },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
      { name: 'ativo', label: 'Ativo', type: 'checkbox', required: true },
    ],
  },
  {
    title: 'Motoristas',
    path: 'motoristas',
    endpoint: '/motoristas',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true, filterKey: 'nome', filterType: 'text' },
      { name: 'cpf', label: 'CPF', table: true, mask: maskDocument, filterKey: 'cpf', filterType: 'text' },
      { name: 'cnh', label: 'CNH', table: true, filterKey: 'cnh', filterType: 'text' },
      { name: 'categoriaCnh', label: 'Categoria CNH' },
      { name: 'validadeCnh', label: 'Validade CNH', type: 'date' },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone, filterKey: 'telefone', filterType: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
  },
  {
    title: 'Cavalos mecânicos',
    path: 'caminhoes',
    endpoint: '/caminhoes',
    fields: [
      { name: 'placa', label: 'Placa do cavalo', required: true, table: true, mask: maskPlate, maxLength: 128, filterKey: 'placa', filterType: 'text' },
      { name: 'composicaoAtual', label: 'Composição atual', table: true, hidden: true, filterKey: 'composicao', filterType: 'text' },
      { name: 'marca', label: 'Marca', table: true, filterKey: 'marca', filterType: 'text' },
      { name: 'modelo', label: 'Modelo', table: true, filterKey: 'modelo', filterType: 'text' },
      { name: 'ano', label: 'Ano', type: 'number', table: true, filterKey: 'ano', filterType: 'number' },
      { name: 'tipoCavalo', label: 'Tipo de cavalo', type: 'select', options: tiposCavalo, table: true, filterKey: 'tipoCavalo', filterType: 'select' },
      { name: 'motoristaId', label: 'Motorista atual', type: 'select', table: true, filterKey: 'motoristaAtual', filterType: 'text', relation: { endpoint: '/motoristas', labelKey: 'nome', fallbackKey: 'cpf', objectKey: 'motorista' } },
      { name: 'cor', label: 'Cor' },
      { name: 'chassi', label: 'Chassi' },
      { name: 'renavam', label: 'Renavam' },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral, table: true, filterKey: 'status', filterType: 'select' },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
  },
  {
    title: 'Fornecedores',
    path: 'fornecedores',
    endpoint: '/fornecedores',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true, filterKey: 'nome', filterType: 'text' },
      { name: 'documento', label: 'CPF/CNPJ', table: true, mask: maskDocument, filterKey: 'documento', filterType: 'text' },
      { name: 'telefone', label: 'Telefone', table: true, mask: maskPhone, filterKey: 'telefone', filterType: 'text' },
      { name: 'email', label: 'E-mail', type: 'email', table: true, filterKey: 'email', filterType: 'text' },
      { name: 'endereco', label: 'Endereço' },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
      { name: 'ativo', label: 'Ativo', type: 'checkbox' },
    ],
  },
  {
    title: 'Categorias financeiras',
    path: 'categorias-financeiras',
    endpoint: '/categorias-financeiras',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true, filterKey: 'nome', filterType: 'text' },
      { name: 'tipoLancamento', label: 'Tipo', type: 'select', table: true, filterKey: 'tipoLancamento', filterType: 'select', options: [{ label: 'Despesa', value: 'DESPESA' }, { label: 'Faturamento', value: 'FATURAMENTO' }] },
      { name: 'ativo', label: 'Ativo', type: 'checkbox', table: true, filterKey: 'ativo', filterType: 'select', filterOptions: [{ label: 'Sim', value: 'true' }, { label: 'Não', value: 'false' }] },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
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
        if (field.name === 'clienteId') return { ...field, required: true, table: true, sortable: true };
        if (field.name === 'categoriaId') return { ...field, relation: { ...field.relation!, params: { tipoLancamento: 'FATURAMENTO' } } };
        return field;
      }),
  },
  {
    title: 'Usuários',
    path: 'users',
    endpoint: '/users',
    fields: [
      { name: 'nome', label: 'Nome', required: true, table: true },
      { name: 'email', label: 'E-mail', type: 'email', required: true, table: true },
      { name: 'senha', label: 'Senha', type: 'password', required: true },
      { name: 'perfil', label: 'Perfil', type: 'select', table: true, options: [{ label: 'Admin', value: 'ADMIN' }, { label: 'Usuário', value: 'USUARIO' }] },
      { name: 'ativo', label: 'Ativo', type: 'checkbox', table: true },
    ],
  },
  {
    title: 'Auditoria',
    path: 'auditorias',
    endpoint: '/auditorias',
    readOnly: true,
    fields: [
      { name: 'createdAt', label: 'Data', type: 'date', table: true },
      { name: 'entidade', label: 'Entidade', table: true },
      { name: 'entidadeId', label: 'Registro', table: true },
      { name: 'acao', label: 'Ação', table: true },
      { name: 'usuarioId', label: 'Usuário' },
      { name: 'dadosAntes', label: 'Dados anteriores', type: 'textarea' },
      { name: 'dadosDepois', label: 'Dados novos', type: 'textarea' },
    ],
  },
];




