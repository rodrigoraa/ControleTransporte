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
  required?: boolean;
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

const statusGeral = [
  { label: 'Ativo', value: 'ATIVO' },
  { label: 'Inativo', value: 'INATIVO' },
  { label: 'Manutencao', value: 'MANUTENCAO' },
];

const tiposConjunto = [
  { label: 'Simples', value: 'SIMPLES' },
  { label: 'Bitrem', value: 'BITREM' },
  { label: 'Rodotrem', value: 'RODOTREM' },
  { label: 'Outro', value: 'OUTRO' },
];

const tiposImplemento = [
  { label: 'Carreta', value: 'CARRETA' },
  { label: 'Semirreboque', value: 'SEMIRREBOQUE' },
  { label: 'Reboque', value: 'REBOQUE' },
  { label: 'Dolly', value: 'DOLLY' },
];

const carrocerias = [
  { label: 'Bau', value: 'BAU' },
  { label: 'Graneleiro', value: 'GRANELEIRO' },
  { label: 'Sider', value: 'SIDER' },
  { label: 'Tanque', value: 'TANQUE' },
  { label: 'Prancha', value: 'PRANCHA' },
  { label: 'Outro', value: 'OUTRO' },
];

const lancamentoFields: Field[] = [
  { name: 'data', label: 'Data', type: 'date', required: true, table: true },
  { name: 'conjuntoId', label: 'Conjunto operacional', type: 'select', table: true, relation: { endpoint: '/conjuntos', labelKey: 'nome', fallbackKey: 'tipo', objectKey: 'conjunto' } },
  { name: 'cavaloMecanicoId', label: 'Cavalo mecanico (quando nao houver conjunto)', type: 'select', table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'cavaloMecanico' } },
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
    title: 'Cavalos mecanicos',
    path: 'caminhoes',
    endpoint: '/caminhoes',
    fields: [
      { name: 'placa', label: 'Placa do cavalo', required: true, table: true, mask: maskPlate },
      { name: 'marca', label: 'Marca', table: true },
      { name: 'modelo', label: 'Modelo', table: true },
      { name: 'ano', label: 'Ano', type: 'number', table: true },
      { name: 'motoristaId', label: 'Motorista atual', type: 'select', table: true, relation: { endpoint: '/motoristas', labelKey: 'nome', fallbackKey: 'cpf', objectKey: 'motorista' } },
      { name: 'cor', label: 'Cor' },
      { name: 'chassi', label: 'Chassi' },
      { name: 'renavam', label: 'Renavam' },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral, table: true },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Implementos',
    path: 'implementos',
    endpoint: '/implementos',
    fields: [
      { name: 'placa', label: 'Placa', table: true, mask: maskPlate },
      { name: 'tipo', label: 'Tipo', type: 'select', required: true, table: true, options: tiposImplemento },
      { name: 'carroceria', label: 'Carroceria', type: 'select', required: true, table: true, options: carrocerias },
      { name: 'quantidadeEixos', label: 'Quantidade de eixos', type: 'number', table: true },
      { name: 'capacidadeCarga', label: 'Capacidade de carga', type: 'number', table: true },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral, table: true },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
    ],
  },
  {
    title: 'Conjuntos operacionais',
    path: 'conjuntos',
    endpoint: '/conjuntos',
    fields: [
      { name: 'nome', label: 'Nome automatico', table: true, hidden: true },
      { name: 'tipo', label: 'Tipo automatico', type: 'select', table: true, hidden: true, options: tiposConjunto },
      { name: 'cavaloMecanicoId', label: 'Cavalo mecanico', type: 'select', required: true, table: true, relation: { endpoint: '/caminhoes', labelKey: 'placa', fallbackKey: 'modelo', objectKey: 'cavaloMecanico' } },
      { name: 'implementoIds', label: 'Implementos vinculados (ordem: 1a carreta, dolly se houver, 2a carreta)', type: 'multiselect', relation: { endpoint: '/implementos', labelKey: 'placa', fallbackKey: 'tipo' } },
      { name: 'quantidadeTotalEixos', label: 'Total de eixos', type: 'number', table: true },
      { name: 'capacidadeTotal', label: 'Capacidade total', type: 'number', table: true },
      { name: 'status', label: 'Status', type: 'select', options: statusGeral, table: true },
      { name: 'justificativaSemImplemento', label: 'Justificativa para conjunto sem implemento', type: 'textarea' },
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
        if (field.name === 'categoriaId') return { ...field, relation: { ...field.relation!, params: { tipoLancamento: 'FATURAMENTO' } } };
        return field;
      }),
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
  {
    title: 'Auditoria',
    path: 'auditorias',
    endpoint: '/auditorias',
    readOnly: true,
    fields: [
      { name: 'createdAt', label: 'Data', type: 'date', table: true },
      { name: 'entidade', label: 'Entidade', table: true },
      { name: 'entidadeId', label: 'Registro', table: true },
      { name: 'acao', label: 'Acao', table: true },
      { name: 'usuarioId', label: 'Usuario' },
      { name: 'dadosAntes', label: 'Dados anteriores', type: 'textarea' },
      { name: 'dadosDepois', label: 'Dados novos', type: 'textarea' },
    ],
  },
];
