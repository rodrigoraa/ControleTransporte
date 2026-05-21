import 'dotenv/config';
import {
  CategoriaLancamento,
  PerfilUsuario,
  PrismaClient,
  TipoLancamento,
  UnidadeQuantidade,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const money = (value: number) => Number(value.toFixed(2));

const monthDate = (monthOffset: number, day: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, day, 12, 0, 0));
};

async function main() {
  const admin = await seedUsers();
  await cleanMassData();

  const clientes = await seedClientes();
  const fornecedores = await seedFornecedores();
  await seedFuncionarios();
  const motoristas = await seedMotoristas();
  const caminhoes = await seedCaminhoes();
  const categorias = await seedCategorias();
  await seedAcompanhamentos(caminhoes, motoristas);
  await seedEngates(caminhoes, motoristas);
  await seedLancamentos({ clientes, fornecedores, motoristas, caminhoes, categorias });

  const resumo = await Promise.all([
    prisma.cliente.count(),
    prisma.fornecedor.count(),
    prisma.motorista.count(),
    prisma.caminhao.count(),
    prisma.categoriaFinanceira.count(),
    prisma.acompanhamento.count(),
    prisma.engateCarreta.count(),
    prisma.lancamentoFinanceiro.count(),
  ]);

  console.log(`Seed finalizado. Login: ${admin.email} / admin123`);
  console.log(
    `Dados no banco: ${resumo[0]} clientes, ${resumo[1]} fornecedores, ${resumo[2]} motoristas, ${resumo[3]} caminhoes, ${resumo[4]} categorias, ${resumo[5]} acompanhamentos, ${resumo[6]} engates, ${resumo[7]} lancamentos.`,
  );
}

async function seedUsers() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@transportadora.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@transportadora.com',
      senha: await bcrypt.hash('admin123', 10),
      perfil: PerfilUsuario.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'usuario@transportadora.com' },
    update: {},
    create: {
      nome: 'Usuario Operacional',
      email: 'usuario@transportadora.com',
      senha: await bcrypt.hash('usuario123', 10),
      perfil: PerfilUsuario.USUARIO,
    },
  });

  return admin;
}

async function cleanMassData() {
  await prisma.lancamentoFinanceiro.deleteMany({
    where: { observacoes: { contains: 'Massa de teste' } },
  });
  await prisma.acompanhamento.deleteMany({
    where: { observacoes: { contains: 'Massa de teste' } },
  });
  await prisma.engateCarreta.deleteMany({
    where: { observacoes: { contains: 'Massa de teste' } },
  });
}

async function seedClientes() {
  const nomes = [
    'Mineradora Serra Azul',
    'Cooperativa Campo Verde',
    'Calcario Bom Vale',
    'Construtora Horizonte',
    'Agropecuaria Santa Luzia',
    'Cimentos Planalto',
    'Pedreira Rio Claro',
    'Fazenda Tres Irmaos',
    'Usina Alto Norte',
    'Distribuidora Granorte',
    'Armazem Campo Forte',
    'Metalurgica Via Sul',
  ];

  return Promise.all(
    nomes.map((nome, index) =>
      prisma.cliente.upsert({
        where: { documento: `10.000.${String(index + 100).padStart(3, '0')}/0001-00` },
        update: { nome, ativo: true },
        create: {
          nome,
          documento: `10.000.${String(index + 100).padStart(3, '0')}/0001-00`,
          telefone: `(31) 9${String(81000000 + index).slice(0, 8)}`,
          email: `financeiro${index + 1}@cliente-teste.com`,
          endereco: `Rodovia BR-${40 + index}, km ${120 + index}`,
          observacoes: 'Cadastro para massa de teste',
          ativo: true,
        },
      }),
    ),
  );
}

async function seedFornecedores() {
  const nomes = [
    'Posto Rota Pesada',
    'Auto Pecas Diesel Forte',
    'Oficina Marcha Lenta',
    'Pneus Estrada Real',
    'Lubrificantes Minas',
    'Borracharia Rei da Rodagem',
    'Mecanica Sao Cristovao',
    'Transport Parts Brasil',
    'Auto Eletrica Alternador',
    'Lavador Brilho Truck',
    'Seguradora Rodovias',
    'Rastreador Via Sat',
  ];

  return Promise.all(
    nomes.map((nome, index) =>
      prisma.fornecedor.upsert({
        where: { documento: `20.000.${String(index + 100).padStart(3, '0')}/0001-00` },
        update: { nome, ativo: true },
        create: {
          nome,
          documento: `20.000.${String(index + 100).padStart(3, '0')}/0001-00`,
          telefone: `(31) 9${String(82000000 + index).slice(0, 8)}`,
          email: `contato${index + 1}@fornecedor-teste.com`,
          endereco: `Av. Industrial, ${1000 + index}`,
          observacoes: 'Cadastro para massa de teste',
          ativo: true,
        },
      }),
    ),
  );
}

async function seedFuncionarios() {
  const funcionarios = [
    ['Marina Souza', '111.222.333-44', 'Analista financeiro'],
    ['Pedro Henrique', '111.222.333-45', 'Operador logistico'],
    ['Bianca Martins', '111.222.333-46', 'Assistente administrativa'],
    ['Rafael Lima', '111.222.333-47', 'Coordenador de frota'],
    ['Helena Rocha', '111.222.333-48', 'Compras'],
  ];

  await Promise.all(
    funcionarios.map(([nome, cpf, cargo], index) =>
      prisma.funcionario.upsert({
        where: { cpf },
        update: { nome, cargo, status: 'ATIVO' },
        create: {
          nome,
          cpf,
          cargo,
          telefone: `(31) 9${String(83000000 + index).slice(0, 8)}`,
          dataAdmissao: new Date(Date.UTC(2022 + (index % 3), index % 12, 1)),
          status: 'ATIVO',
          observacoes: 'Cadastro para massa de teste',
        },
      }),
    ),
  );
}

async function seedMotoristas() {
  const nomes = [
    'Carlos Almeida',
    'Joao Batista',
    'Marcos Vinicius',
    'Andre Luiz',
    'Fernando Reis',
    'Lucas Pereira',
    'Tiago Correia',
    'Roberto Nunes',
    'Gustavo Prado',
    'Paulo Sergio',
  ];

  return Promise.all(
    nomes.map((nome, index) =>
      prisma.motorista.upsert({
        where: { cpf: `222.333.44${index}-${50 + index}` },
        update: { nome, status: 'ATIVO' },
        create: {
          nome,
          cpf: `222.333.44${index}-${50 + index}`,
          cnh: `CNH9${String(index + 10000000).padStart(8, '0')}`,
          categoriaCnh: index % 2 === 0 ? 'E' : 'D',
          validadeCnh: new Date(Date.UTC(2028 + (index % 4), 11, 31)),
          telefone: `(31) 9${String(84000000 + index).slice(0, 8)}`,
          status: 'ATIVO',
          observacoes: 'Cadastro para massa de teste',
        },
      }),
    ),
  );
}

async function seedCaminhoes() {
  const dados = [
    ['MID5J90', 'Scania', 'R 440', 2018, 'Cavalo', 'Branco'],
    ['EOE1F17', 'Librelato', 'Basculante', 2020, 'Carreta 1', 'Cinza'],
    ['EOE1F18', 'Librelato', 'Basculante', 2020, 'Carreta 2', 'Cinza'],
    ['ABC1D23', 'Volvo', 'FH 540', 2021, 'Cavalo', 'Vermelho'],
    ['DEF4G56', 'Mercedes-Benz', 'Actros', 2019, 'Cavalo', 'Prata'],
    ['HIJ7K89', 'DAF', 'XF 480', 2022, 'Cavalo', 'Azul'],
    ['LMN0P12', 'Iveco', 'Hi-Way', 2017, 'Cavalo', 'Branco'],
    ['QRS3T45', 'MAN', 'TGX', 2020, 'Cavalo', 'Preto'],
    ['UVW6X78', 'Randon', 'Graneleira', 2021, 'Carreta', 'Cinza'],
    ['YZA9B01', 'Guerra', 'Basculante', 2018, 'Carreta', 'Azul'],
    ['BCD2E34', 'Facchini', 'Sider', 2019, 'Carreta', 'Branco'],
    ['FGH5I67', 'Librelato', 'Bitrem', 2022, 'Carreta', 'Prata'],
  ] as const;

  return Promise.all(
    dados.map(([placa, marca, modelo, ano, tipo, cor], index) =>
      prisma.caminhao.upsert({
        where: { placa },
        update: { marca, modelo, ano, tipo, cor, status: 'ATIVO' },
        create: {
          placa,
          marca,
          modelo,
          ano,
          tipo,
          cor,
          chassi: `9BSTESTE${String(index).padStart(8, '0')}`,
          renavam: `9876543${String(index).padStart(4, '0')}`,
          status: 'ATIVO',
          observacoes: 'Cadastro para massa de teste',
        },
      }),
    ),
  );
}

async function seedCategorias() {
  const dados = [
    ['Combustivel', TipoLancamento.DESPESA],
    ['Manutencao preventiva', TipoLancamento.DESPESA],
    ['Pecas mecanicas', TipoLancamento.DESPESA],
    ['Pneus', TipoLancamento.DESPESA],
    ['Borracharia', TipoLancamento.DESPESA],
    ['Seguro e rastreamento', TipoLancamento.DESPESA],
    ['Lavagem', TipoLancamento.DESPESA],
    ['Frete', TipoLancamento.FATURAMENTO],
    ['Calcario dolomitico', TipoLancamento.FATURAMENTO],
    ['Transporte de graos', TipoLancamento.FATURAMENTO],
    ['Locacao de conjunto', TipoLancamento.FATURAMENTO],
    ['Servico extra', TipoLancamento.FATURAMENTO],
  ] as const;

  const categorias = await Promise.all(
    dados.map(([nome, tipoLancamento]) =>
      prisma.categoriaFinanceira.upsert({
        where: { nome },
        update: { tipoLancamento, ativo: true },
        create: {
          nome,
          tipoLancamento,
          ativo: true,
          observacoes: 'Categoria para massa de teste',
        },
      }),
    ),
  );

  return {
    despesas: categorias.filter((categoria) => categoria.tipoLancamento === TipoLancamento.DESPESA),
    faturamentos: categorias.filter((categoria) => categoria.tipoLancamento === TipoLancamento.FATURAMENTO),
  };
}

async function seedAcompanhamentos(caminhoes: Awaited<ReturnType<typeof seedCaminhoes>>, motoristas: Awaited<ReturnType<typeof seedMotoristas>>) {
  await prisma.acompanhamento.createMany({
    data: caminhoes.slice(0, 10).map((caminhao, index) => ({
      caminhaoId: caminhao.id,
      motoristaId: motoristas[index % motoristas.length].id,
      tipoOperacao: caminhao.tipo || 'Operacao geral',
      tipoVeiculo: [caminhao.tipo, caminhao.modelo].filter(Boolean).join(' - ') || 'Veiculo',
      dataInicio: monthDate(8 - (index % 6), 1),
      dataFim: index % 4 === 0 ? monthDate(index % 3, 25) : null,
      status: index % 4 === 0 ? 'ENCERRADO' : 'ATIVO',
      observacoes: 'Massa de teste - acompanhamento operacional',
    })),
  });
}

async function seedEngates(caminhoes: Awaited<ReturnType<typeof seedCaminhoes>>, motoristas: Awaited<ReturnType<typeof seedMotoristas>>) {
  const cavalos = caminhoes.filter((item) => (item.tipo || '').toLowerCase().includes('cavalo'));
  const carretas = caminhoes.filter((item) => !(item.tipo || '').toLowerCase().includes('cavalo'));

  await prisma.engateCarreta.createMany({
    data: cavalos.flatMap((cavalo, index) => [
      {
        cavaloId: cavalo.id,
        carreta1Id: carretas[index % carretas.length]?.id,
        carreta2Id: carretas[(index + 1) % carretas.length]?.id,
        motoristaId: motoristas[index % motoristas.length].id,
        dataInicio: monthDate(index % 6, 5),
        dataFim: index % 3 === 0 ? monthDate(index % 4, 20) : null,
        status: index % 3 === 0 ? 'ENCERRADO' : 'ATIVO',
        observacoes: 'Massa de teste - engate de carretas',
      },
      {
        cavaloId: cavalo.id,
        carreta1Id: carretas[(index + 2) % carretas.length]?.id,
        carreta2Id: null,
        motoristaId: motoristas[(index + 3) % motoristas.length].id,
        dataInicio: monthDate((index + 3) % 10, 12),
        dataFim: monthDate((index + 2) % 8, 22),
        status: 'ENCERRADO',
        observacoes: 'Massa de teste - engate de carretas',
      },
    ]),
  });
}

async function seedLancamentos({
  clientes,
  fornecedores,
  motoristas,
  caminhoes,
  categorias,
}: {
  clientes: Awaited<ReturnType<typeof seedClientes>>;
  fornecedores: Awaited<ReturnType<typeof seedFornecedores>>;
  motoristas: Awaited<ReturnType<typeof seedMotoristas>>;
  caminhoes: Awaited<ReturnType<typeof seedCaminhoes>>;
  categorias: Awaited<ReturnType<typeof seedCategorias>>;
}) {
  const lancamentos = [];

  for (let month = 0; month < 12; month += 1) {
    for (let i = 0; i < caminhoes.length; i += 1) {
      const caminhao = caminhoes[i];
      const motorista = motoristas[(i + month) % motoristas.length];
      const fornecedor = fornecedores[(i + month) % fornecedores.length];
      const cliente = clientes[(i + month * 2) % clientes.length];
      const categoriaDespesa = categorias.despesas[(i + month) % categorias.despesas.length];
      const categoriaFaturamento = categorias.faturamentos[(i + month) % categorias.faturamentos.length];

      const dieselQuantidade = 220 + ((i * 17 + month * 11) % 180);
      const dieselValor = money(5.65 + ((i + month) % 7) * 0.11);

      lancamentos.push({
        data: monthDate(month, 3 + (i % 20)),
        placaOuPessoa: caminhao.placa,
        motoristaId: motorista.id,
        fornecedorId: fornecedor.id,
        caminhaoId: caminhao.id,
        clienteId: null,
        categoriaId: categoriaDespesa.id,
        tipoLancamento: TipoLancamento.DESPESA,
        categoria: CategoriaLancamento.COMBUSTIVEL,
        descricao: `Abastecimento ${caminhao.placa}`,
        quantidade: dieselQuantidade,
        unidadeQuantidade: UnidadeQuantidade.KG,
        valorUnitario: dieselValor,
        valorTotal: money(dieselQuantidade * dieselValor),
        observacoes: 'Massa de teste - despesa',
      });

      if ((i + month) % 3 === 0) {
        const quantidade = 1;
        const valorUnitario = money(850 + ((i + month) % 8) * 210);
        lancamentos.push({
          data: monthDate(month, 8 + (i % 15)),
          placaOuPessoa: caminhao.placa,
          motoristaId: motorista.id,
          fornecedorId: fornecedores[(i + 3) % fornecedores.length].id,
          caminhaoId: caminhao.id,
          clienteId: null,
          categoriaId: categorias.despesas[(i + 2) % categorias.despesas.length].id,
          tipoLancamento: TipoLancamento.DESPESA,
          categoria: CategoriaLancamento.MANUTENCAO,
          descricao: `Manutencao programada ${caminhao.placa}`,
          quantidade,
          unidadeQuantidade: UnidadeQuantidade.UNIDADE,
          valorUnitario,
          valorTotal: valorUnitario,
          observacoes: 'Massa de teste - despesa',
        });
      }

      const toneladas = 28 + ((i + month) % 9);
      const freteUnitario = money(175 + ((i * 2 + month) % 10) * 18);
      lancamentos.push({
        data: monthDate(month, 15 + (i % 12)),
        placaOuPessoa: caminhao.placa,
        motoristaId: motorista.id,
        fornecedorId: null,
        caminhaoId: caminhao.id,
        clienteId: cliente.id,
        categoriaId: categoriaFaturamento.id,
        tipoLancamento: TipoLancamento.FATURAMENTO,
        categoria: CategoriaLancamento.CALCARIO_DOLOMITICO,
        descricao: `Frete ${cliente.nome} - ${caminhao.placa}`,
        quantidade: toneladas,
        unidadeQuantidade: UnidadeQuantidade.KG,
        valorUnitario: freteUnitario,
        valorTotal: money(toneladas * freteUnitario),
        observacoes: 'Massa de teste - faturamento',
      });
    }
  }

  await prisma.lancamentoFinanceiro.createMany({ data: lancamentos });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
