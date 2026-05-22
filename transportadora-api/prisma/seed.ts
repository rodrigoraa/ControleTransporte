import 'dotenv/config';
import {
  PerfilUsuario,
  PrismaClient,
  TipoCarroceria,
  TipoConjuntoOperacional,
  TipoImplemento,
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
  const motoristas = await seedMotoristas();
  const cavalos = await seedCavalos(motoristas);
  const implementos = await seedImplementos();
  const conjuntos = await seedConjuntos(cavalos, implementos);
  const categorias = await seedCategorias();
  await seedLancamentos({ clientes, fornecedores, motoristas, conjuntos, categorias });

  const resumo = await Promise.all([
    prisma.cliente.count(), prisma.fornecedor.count(), prisma.motorista.count(), prisma.cavaloMecanico.count(),
    prisma.implemento.count(), prisma.conjunto.count(), prisma.categoriaFinanceira.count(), prisma.lancamentoFinanceiro.count(),
  ]);
  console.log(`Seed finalizado. Login: ${admin.email} / admin123`);
  console.log(`Dados no banco: ${resumo[0]} clientes, ${resumo[1]} fornecedores, ${resumo[2]} motoristas, ${resumo[3]} cavalos, ${resumo[4]} implementos, ${resumo[5]} conjuntos, ${resumo[6]} categorias, ${resumo[7]} lancamentos.`);
}

async function seedUsers() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@transportadora.com' }, update: {},
    create: { nome: 'Administrador', email: 'admin@transportadora.com', senha: await bcrypt.hash('admin123', 10), perfil: PerfilUsuario.ADMIN },
  });
  await prisma.user.upsert({
    where: { email: 'usuario@transportadora.com' }, update: {},
    create: { nome: 'Usuario Operacional', email: 'usuario@transportadora.com', senha: await bcrypt.hash('usuario123', 10), perfil: PerfilUsuario.USUARIO },
  });
  return admin;
}

async function cleanMassData() {
  await prisma.lancamentoFinanceiro.deleteMany({ where: { observacoes: { contains: 'Massa de teste' } } });
}

async function seedClientes() {
  const nomes = ['Mineradora Serra Azul', 'Cooperativa Campo Verde', 'Calcario Bom Vale', 'Construtora Horizonte', 'Agropecuaria Santa Luzia', 'Cimentos Planalto', 'Pedreira Rio Claro', 'Fazenda Tres Irmaos', 'Usina Alto Norte', 'Distribuidora Granorte', 'Armazem Campo Forte', 'Metalurgica Via Sul'];
  return Promise.all(nomes.map((nome, index) => prisma.cliente.upsert({
    where: { documento: `10.000.${String(index + 100).padStart(3, '0')}/0001-00` }, update: { nome, ativo: true },
    create: { nome, documento: `10.000.${String(index + 100).padStart(3, '0')}/0001-00`, telefone: `(31) 9${String(81000000 + index).slice(0, 8)}`, email: `financeiro${index + 1}@cliente-teste.com`, endereco: `Rodovia BR-${40 + index}, km ${120 + index}`, observacoes: 'Cadastro para massa de teste', ativo: true },
  })));
}

async function seedFornecedores() {
  const nomes = ['Posto Rota Pesada', 'Auto Pecas Diesel Forte', 'Oficina Marcha Lenta', 'Pneus Estrada Real', 'Lubrificantes Minas', 'Borracharia Rei da Rodagem', 'Mecanica Sao Cristovao', 'Transport Parts Brasil', 'Auto Eletrica Alternador', 'Lavador Brilho Truck', 'Seguradora Rodovias', 'Rastreador Via Sat'];
  return Promise.all(nomes.map((nome, index) => prisma.fornecedor.upsert({
    where: { documento: `20.000.${String(index + 100).padStart(3, '0')}/0001-00` }, update: { nome, ativo: true },
    create: { nome, documento: `20.000.${String(index + 100).padStart(3, '0')}/0001-00`, telefone: `(31) 9${String(82000000 + index).slice(0, 8)}`, email: `contato${index + 1}@fornecedor-teste.com`, endereco: `Av. Industrial, ${1000 + index}`, observacoes: 'Cadastro para massa de teste', ativo: true },
  })));
}

async function seedMotoristas() {
  const nomes = ['Carlos Almeida', 'Joao Batista', 'Marcos Vinicius', 'Andre Luiz', 'Fernando Reis', 'Lucas Pereira', 'Tiago Correia', 'Roberto Nunes', 'Gustavo Prado', 'Paulo Sergio'];
  return Promise.all(nomes.map((nome, index) => prisma.motorista.upsert({
    where: { cpf: `222.333.44${index}-${50 + index}` }, update: { nome, status: 'ATIVO' },
    create: { nome, cpf: `222.333.44${index}-${50 + index}`, cnh: `CNH9${String(index + 10000000).padStart(8, '0')}`, categoriaCnh: index % 2 === 0 ? 'E' : 'D', validadeCnh: new Date(Date.UTC(2028 + (index % 4), 11, 31)), telefone: `(31) 9${String(84000000 + index).slice(0, 8)}`, status: 'ATIVO', observacoes: 'Cadastro para massa de teste' },
  })));
}

async function seedCavalos(motoristas: Awaited<ReturnType<typeof seedMotoristas>>) {
  const dados = [
    ['MID5J90', 'Scania', 'R 440', 2018, 'Branco'], ['ABC1D23', 'Volvo', 'FH 540', 2021, 'Vermelho'],
    ['DEF4G56', 'Mercedes-Benz', 'Actros', 2019, 'Prata'], ['HIJ7K89', 'DAF', 'XF 480', 2022, 'Azul'],
    ['LMN0P12', 'Iveco', 'Hi-Way', 2017, 'Branco'], ['QRS3T45', 'MAN', 'TGX', 2020, 'Preto'],
  ] as const;
  return Promise.all(dados.map(([placa, marca, modelo, ano, cor], index) => prisma.cavaloMecanico.upsert({
    where: { placa }, update: { marca, modelo, ano, cor, motoristaId: motoristas[index % motoristas.length].id, status: 'ATIVO' },
    create: { placa, marca, modelo, ano, cor, motoristaId: motoristas[index % motoristas.length].id, chassi: `9BSCAVALO${String(index).padStart(8, '0')}`, renavam: `1876543${String(index).padStart(4, '0')}`, status: 'ATIVO', observacoes: 'Cadastro para massa de teste' },
  })));
}

async function seedImplementos() {
  const dados = [
    ['CAR1A01', TipoImplemento.SEMIRREBOQUE, TipoCarroceria.GRANELEIRO, 3, 32000], ['CAR1A02', TipoImplemento.SEMIRREBOQUE, TipoCarroceria.GRANELEIRO, 3, 32000],
    ['DLY1A01', TipoImplemento.DOLLY, TipoCarroceria.OUTRO, 2, 0], ['CAR1A03', TipoImplemento.SEMIRREBOQUE, TipoCarroceria.SIDER, 3, 30000],
    ['CAR1A04', TipoImplemento.SEMIRREBOQUE, TipoCarroceria.SIDER, 3, 30000], ['DLY1A02', TipoImplemento.DOLLY, TipoCarroceria.OUTRO, 2, 0],
    ['CAR1A05', TipoImplemento.CARRETA, TipoCarroceria.BAU, 3, 28000], ['CAR1A06', TipoImplemento.SEMIRREBOQUE, TipoCarroceria.TANQUE, 3, 26000],
  ] as const;
  return Promise.all(dados.map(([placa, tipo, carroceria, quantidadeEixos, capacidadeCarga]) => prisma.implemento.upsert({
    where: { placa }, update: { tipo, carroceria, quantidadeEixos, capacidadeCarga, status: 'ATIVO' },
    create: { placa, tipo, carroceria, quantidadeEixos, capacidadeCarga, status: 'ATIVO', observacoes: 'Cadastro para massa de teste' },
  })));
}

async function seedConjuntos(cavalos: Awaited<ReturnType<typeof seedCavalos>>, implementos: Awaited<ReturnType<typeof seedImplementos>>) {
  const byPlaca = (placa: string) => implementos.find((item) => item.placa === placa)!;
  const composicoes = [
    { nome: 'Bitrem graneleiro 7 eixos', tipo: TipoConjuntoOperacional.BITREM, cavalo: cavalos[0], implementos: [byPlaca('CAR1A01'), byPlaca('CAR1A02')] },
    { nome: 'Rodotrem sider 8 eixos', tipo: TipoConjuntoOperacional.RODOTREM, cavalo: cavalos[1], implementos: [byPlaca('CAR1A03'), byPlaca('DLY1A02'), byPlaca('CAR1A04')] },
    { nome: 'Conjunto bau simples', tipo: TipoConjuntoOperacional.SIMPLES, cavalo: cavalos[2], implementos: [byPlaca('CAR1A05')] },
    { nome: 'Conjunto tanque simples', tipo: TipoConjuntoOperacional.SIMPLES, cavalo: cavalos[3], implementos: [byPlaca('CAR1A06')] },
  ];
  const result = [];
  for (const item of composicoes) {
    const eixos = item.implementos.reduce((total, implemento) => total + implemento.quantidadeEixos, 0);
    const capacidade = item.implementos.reduce((total, implemento) => total + Number(implemento.capacidadeCarga), 0);
    const conjunto = await prisma.conjunto.upsert({
      where: { nome: item.nome },
      update: { tipo: item.tipo, cavaloMecanicoId: item.cavalo.id, quantidadeTotalEixos: eixos, capacidadeTotal: capacidade, status: 'ATIVO', observacoes: 'Cadastro para massa de teste' },
      create: { nome: item.nome, tipo: item.tipo, cavaloMecanicoId: item.cavalo.id, quantidadeTotalEixos: eixos, capacidadeTotal: capacidade, status: 'ATIVO', observacoes: 'Cadastro para massa de teste' },
    });
    await prisma.conjuntoImplemento.deleteMany({ where: { conjuntoId: conjunto.id } });
    await prisma.conjuntoImplemento.createMany({ data: item.implementos.map((implemento, index) => ({ conjuntoId: conjunto.id, implementoId: implemento.id, ordem: index + 1 })) });
    result.push({ ...conjunto, cavaloMecanico: item.cavalo });
  }
  return result;
}

async function seedCategorias() {
  const dados = [['Combustivel', TipoLancamento.DESPESA], ['Manutencao preventiva', TipoLancamento.DESPESA], ['Pecas mecanicas', TipoLancamento.DESPESA], ['Pneus', TipoLancamento.DESPESA], ['Borracharia', TipoLancamento.DESPESA], ['Seguro e rastreamento', TipoLancamento.DESPESA], ['Lavagem', TipoLancamento.DESPESA], ['Frete', TipoLancamento.FATURAMENTO], ['Calcario dolomitico', TipoLancamento.FATURAMENTO], ['Transporte de graos', TipoLancamento.FATURAMENTO], ['Locacao de conjunto', TipoLancamento.FATURAMENTO], ['Servico extra', TipoLancamento.FATURAMENTO]] as const;
  const categorias = await Promise.all(dados.map(([nome, tipoLancamento]) => prisma.categoriaFinanceira.upsert({
    where: { nome }, update: { tipoLancamento, ativo: true }, create: { nome, tipoLancamento, ativo: true, observacoes: 'Categoria para massa de teste' },
  })));
  return { despesas: categorias.filter((categoria) => categoria.tipoLancamento === TipoLancamento.DESPESA), faturamentos: categorias.filter((categoria) => categoria.tipoLancamento === TipoLancamento.FATURAMENTO) };
}

async function seedLancamentos({ clientes, fornecedores, motoristas, conjuntos, categorias }: { clientes: Awaited<ReturnType<typeof seedClientes>>; fornecedores: Awaited<ReturnType<typeof seedFornecedores>>; motoristas: Awaited<ReturnType<typeof seedMotoristas>>; conjuntos: Awaited<ReturnType<typeof seedConjuntos>>; categorias: Awaited<ReturnType<typeof seedCategorias>> }) {
  const lancamentos = [];
  for (let month = 0; month < 12; month += 1) {
    for (let i = 0; i < conjuntos.length; i += 1) {
      const conjunto = conjuntos[i];
      const cavalo = conjunto.cavaloMecanico;
      const motorista = motoristas[(i + month) % motoristas.length];
      const fornecedor = fornecedores[(i + month) % fornecedores.length];
      const cliente = clientes[(i + month * 2) % clientes.length];
      const categoriaDespesa = categorias.despesas[(i + month) % categorias.despesas.length];
      const categoriaFaturamento = categorias.faturamentos[(i + month) % categorias.faturamentos.length];
      const dieselQuantidade = 220 + ((i * 17 + month * 11) % 180);
      const dieselValor = money(5.65 + ((i + month) % 7) * 0.11);
      lancamentos.push({ data: monthDate(month, 3 + (i % 20)), placa: cavalo.placa, motoristaId: motorista.id, fornecedorId: fornecedor.id, cavaloMecanicoId: cavalo.id, conjuntoId: conjunto.id, clienteId: null, categoriaId: categoriaDespesa.id, tipoLancamento: TipoLancamento.DESPESA, descricao: `Abastecimento ${cavalo.placa} - ${conjunto.nome}`, quantidade: dieselQuantidade, unidadeQuantidade: UnidadeQuantidade.KG, valorUnitario: dieselValor, valorTotal: money(dieselQuantidade * dieselValor), observacoes: 'Massa de teste - despesa' });
      const toneladas = 28 + ((i + month) % 9);
      const freteUnitario = money(175 + ((i * 2 + month) % 10) * 18);
      lancamentos.push({ data: monthDate(month, 15 + (i % 12)), placa: cavalo.placa, motoristaId: motorista.id, fornecedorId: null, cavaloMecanicoId: cavalo.id, conjuntoId: conjunto.id, clienteId: cliente.id, categoriaId: categoriaFaturamento.id, tipoLancamento: TipoLancamento.FATURAMENTO, descricao: `Frete ${cliente.nome} - ${conjunto.nome}`, quantidade: toneladas, unidadeQuantidade: UnidadeQuantidade.KG, valorUnitario: freteUnitario, valorTotal: money(toneladas * freteUnitario), observacoes: 'Massa de teste - faturamento' });
    }
  }
  await prisma.lancamentoFinanceiro.createMany({ data: lancamentos });
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
