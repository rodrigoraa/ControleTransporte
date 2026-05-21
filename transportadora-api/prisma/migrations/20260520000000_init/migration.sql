CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'USUARIO');
CREATE TYPE "StatusGeral" AS ENUM ('ATIVO', 'INATIVO');
CREATE TYPE "StatusFuncionario" AS ENUM ('ATIVO', 'AFASTADO', 'DESLIGADO');
CREATE TYPE "StatusAcompanhamento" AS ENUM ('ATIVO', 'ENCERRADO');
CREATE TYPE "TipoLancamento" AS ENUM ('DESPESA', 'FATURAMENTO');
CREATE TYPE "CategoriaLancamento" AS ENUM ('CALCARIO_DOLOMITICO', 'PECAS_MECANICAS', 'MANUTENCAO', 'COMBUSTIVEL', 'PNEUS', 'SERVICO', 'OUTROS');
CREATE TYPE "UnidadeQuantidade" AS ENUM ('KG', 'UNIDADE');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senha" TEXT NOT NULL,
  "perfil" "PerfilUsuario" NOT NULL DEFAULT 'USUARIO',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clientes" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "documento" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "endereco" TEXT,
  "observacoes" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "funcionarios" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "telefone" TEXT,
  "cargo" TEXT,
  "dataAdmissao" TIMESTAMP(3),
  "status" "StatusFuncionario" NOT NULL DEFAULT 'ATIVO',
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "motoristas" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cpf" TEXT,
  "cnh" TEXT,
  "categoriaCnh" TEXT,
  "validadeCnh" TIMESTAMP(3),
  "telefone" TEXT,
  "status" "StatusGeral",
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "caminhoes" (
  "id" TEXT NOT NULL,
  "placa" TEXT NOT NULL,
  "marca" TEXT,
  "modelo" TEXT,
  "ano" INTEGER,
  "tipo" TEXT,
  "cor" TEXT,
  "chassi" TEXT,
  "renavam" TEXT,
  "status" "StatusGeral",
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "caminhoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fornecedores" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "documento" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "endereco" TEXT,
  "observacoes" TEXT,
  "ativo" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categorias_financeiras" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipoLancamento" "TipoLancamento",
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "acompanhamentos" (
  "id" TEXT NOT NULL,
  "caminhaoId" TEXT NOT NULL,
  "motoristaId" TEXT NOT NULL,
  "tipoOperacao" TEXT NOT NULL,
  "tipoVeiculo" TEXT NOT NULL,
  "dataInicio" TIMESTAMP(3),
  "dataFim" TIMESTAMP(3),
  "status" "StatusAcompanhamento",
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "acompanhamentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lancamentos_financeiros" (
  "id" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "placaOuPessoa" TEXT NOT NULL,
  "motoristaId" TEXT NOT NULL,
  "fornecedorId" TEXT,
  "caminhaoId" TEXT,
  "clienteId" TEXT,
  "categoriaId" TEXT,
  "tipoLancamento" "TipoLancamento" NOT NULL,
  "categoria" "CategoriaLancamento",
  "descricao" TEXT,
  "quantidade" DECIMAL(12,3) NOT NULL,
  "unidadeQuantidade" "UnidadeQuantidade" NOT NULL,
  "valorUnitario" DECIMAL(14,2) NOT NULL,
  "valorTotal" DECIMAL(14,2) NOT NULL,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");
CREATE UNIQUE INDEX "funcionarios_cpf_key" ON "funcionarios"("cpf");
CREATE UNIQUE INDEX "motoristas_cpf_key" ON "motoristas"("cpf");
CREATE UNIQUE INDEX "motoristas_cnh_key" ON "motoristas"("cnh");
CREATE UNIQUE INDEX "caminhoes_placa_key" ON "caminhoes"("placa");
CREATE UNIQUE INDEX "caminhoes_chassi_key" ON "caminhoes"("chassi");
CREATE UNIQUE INDEX "caminhoes_renavam_key" ON "caminhoes"("renavam");
CREATE UNIQUE INDEX "fornecedores_documento_key" ON "fornecedores"("documento");
CREATE UNIQUE INDEX "categorias_financeiras_nome_key" ON "categorias_financeiras"("nome");

CREATE INDEX "acompanhamentos_caminhaoId_idx" ON "acompanhamentos"("caminhaoId");
CREATE INDEX "acompanhamentos_motoristaId_idx" ON "acompanhamentos"("motoristaId");
CREATE INDEX "lancamentos_financeiros_data_idx" ON "lancamentos_financeiros"("data");
CREATE INDEX "lancamentos_financeiros_tipoLancamento_idx" ON "lancamentos_financeiros"("tipoLancamento");
CREATE INDEX "lancamentos_financeiros_categoria_idx" ON "lancamentos_financeiros"("categoria");
CREATE INDEX "lancamentos_financeiros_motoristaId_idx" ON "lancamentos_financeiros"("motoristaId");
CREATE INDEX "lancamentos_financeiros_fornecedorId_idx" ON "lancamentos_financeiros"("fornecedorId");
CREATE INDEX "lancamentos_financeiros_caminhaoId_idx" ON "lancamentos_financeiros"("caminhaoId");
CREATE INDEX "lancamentos_financeiros_clienteId_idx" ON "lancamentos_financeiros"("clienteId");
CREATE INDEX "lancamentos_financeiros_categoriaId_idx" ON "lancamentos_financeiros"("categoriaId");

ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
