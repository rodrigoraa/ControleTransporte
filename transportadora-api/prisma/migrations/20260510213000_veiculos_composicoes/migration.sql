-- CreateEnum
CREATE TYPE "TipoVeiculo" AS ENUM ('CAVALO', 'CARRETA', 'DOLLY');

-- CreateTable
CREATE TABLE "Motorista" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "apelido" TEXT,
    "cpf" TEXT,
    "telefone" TEXT,
    "cidade" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'Ativo',
    "veiculoAtualId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" SERIAL NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" "TipoVeiculo" NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anoFabricacao" INTEGER,
    "proprietario" TEXT,
    "situacaoOperacional" TEXT NOT NULL DEFAULT 'Ativo',
    "situacaoCadastro" TEXT NOT NULL DEFAULT 'Normal',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposicaoVeiculo" (
    "id" SERIAL NOT NULL,
    "cavaloId" INTEGER NOT NULL,
    "motoristaId" INTEGER,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFim" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComposicaoVeiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposicaoVeiculoItem" (
    "id" SERIAL NOT NULL,
    "composicaoId" INTEGER NOT NULL,
    "veiculoId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComposicaoVeiculoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_cpf_key" ON "Motorista"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_veiculoAtualId_key" ON "Motorista"("veiculoAtualId");

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_placa_key" ON "Veiculo"("placa");

-- CreateIndex
CREATE INDEX "ComposicaoVeiculo_cavaloId_dataFim_idx" ON "ComposicaoVeiculo"("cavaloId", "dataFim");

-- CreateIndex
CREATE INDEX "ComposicaoVeiculo_motoristaId_idx" ON "ComposicaoVeiculo"("motoristaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoVeiculoItem_composicaoId_veiculoId_key" ON "ComposicaoVeiculoItem"("composicaoId", "veiculoId");

-- CreateIndex
CREATE INDEX "ComposicaoVeiculoItem_veiculoId_idx" ON "ComposicaoVeiculoItem"("veiculoId");

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_veiculoAtualId_fkey" FOREIGN KEY ("veiculoAtualId") REFERENCES "Veiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoVeiculo" ADD CONSTRAINT "ComposicaoVeiculo_cavaloId_fkey" FOREIGN KEY ("cavaloId") REFERENCES "Veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoVeiculo" ADD CONSTRAINT "ComposicaoVeiculo_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoVeiculoItem" ADD CONSTRAINT "ComposicaoVeiculoItem_composicaoId_fkey" FOREIGN KEY ("composicaoId") REFERENCES "ComposicaoVeiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoVeiculoItem" ADD CONSTRAINT "ComposicaoVeiculoItem_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "Veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
