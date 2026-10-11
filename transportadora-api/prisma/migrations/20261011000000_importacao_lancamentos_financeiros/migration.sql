BEGIN;

CREATE TYPE "TipoEntidadeImportacao" AS ENUM ('MOTORISTA', 'CLIENTE');

CREATE TABLE "mapeamentos_importacao" (
  "id" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "tipoEntidade" "TipoEntidadeImportacao" NOT NULL,
  "codigoExterno" TEXT NOT NULL,
  "nomeExterno" TEXT NOT NULL,
  "motoristaId" TEXT,
  "clienteId" TEXT,
  "criadoPorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mapeamentos_importacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mapeamentos_importacao_entidade_check" CHECK (
    ("tipoEntidade" = 'MOTORISTA' AND "motoristaId" IS NOT NULL AND "clienteId" IS NULL)
    OR ("tipoEntidade" = 'CLIENTE' AND "clienteId" IS NOT NULL AND "motoristaId" IS NULL)
  ),
  CONSTRAINT "mapeamentos_importacao_codigo_check" CHECK (
    LENGTH(BTRIM("origem")) > 0 AND LENGTH(BTRIM("codigoExterno")) > 0
  ),
  CONSTRAINT "mapeamentos_importacao_motoristaId_fkey" FOREIGN KEY ("motoristaId")
    REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mapeamentos_importacao_clienteId_fkey" FOREIGN KEY ("clienteId")
    REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mapeamentos_importacao_origem_tipoEntidade_codigoExterno_key"
  ON "mapeamentos_importacao"("origem", "tipoEntidade", "codigoExterno");
CREATE INDEX "mapeamentos_importacao_motoristaId_idx" ON "mapeamentos_importacao"("motoristaId");
CREATE INDEX "mapeamentos_importacao_clienteId_idx" ON "mapeamentos_importacao"("clienteId");

CREATE TABLE "lancamentos_importados" (
  "id" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "chaveExterna" TEXT NOT NULL,
  "lancamentoFinanceiroId" TEXT NOT NULL,
  "dadosOriginais" JSONB NOT NULL,
  "hashDados" TEXT NOT NULL,
  "hashArquivo" TEXT NOT NULL,
  "nomeArquivo" TEXT NOT NULL,
  "usuarioId" TEXT,
  "dataImportacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lancamentos_importados_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lancamentos_importados_chave_check" CHECK (
    LENGTH(BTRIM("origem")) > 0 AND LENGTH(BTRIM("chaveExterna")) > 0
  ),
  CONSTRAINT "lancamentos_importados_lancamentoFinanceiroId_fkey" FOREIGN KEY ("lancamentoFinanceiroId")
    REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lancamentos_importados_origem_chaveExterna_key" ON "lancamentos_importados"("origem", "chaveExterna");
CREATE UNIQUE INDEX "lancamentos_importados_lancamentoFinanceiroId_key" ON "lancamentos_importados"("lancamentoFinanceiroId");
CREATE INDEX "lancamentos_importados_dataImportacao_idx" ON "lancamentos_importados"("dataImportacao");

COMMIT;
