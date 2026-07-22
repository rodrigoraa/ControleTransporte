BEGIN;

CREATE TYPE "TipoComissao" AS ENUM ('PERCENTUAL', 'POR_VIAGEM');

ALTER TABLE "lancamentos_financeiros"
ADD COLUMN "tipoComissao" "TipoComissao",
ADD COLUMN "percentualComissao" DECIMAL(5,2),
ADD COLUMN "valorComissaoPorViagem" DECIMAL(14,2),
ADD COLUMN "valorComissao" DECIMAL(14,2),
ADD COLUMN "quantidadeEixosComissao" INTEGER,
ADD COLUMN "faturamentoOrigemId" TEXT;

ALTER TABLE "categorias_financeiras"
ADD COLUMN "codigoSistema" TEXT;

CREATE UNIQUE INDEX "categorias_financeiras_codigoSistema_key"
ON "categorias_financeiras"("codigoSistema");

CREATE UNIQUE INDEX "lancamentos_financeiros_faturamentoOrigemId_key"
ON "lancamentos_financeiros"("faturamentoOrigemId");

CREATE INDEX "lancamentos_financeiros_tipoComissao_idx"
ON "lancamentos_financeiros"("tipoComissao");

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_faturamentoOrigemId_fkey"
FOREIGN KEY ("faturamentoOrigemId") REFERENCES "lancamentos_financeiros"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_percentualComissao_check"
CHECK ("percentualComissao" IS NULL OR ("percentualComissao" >= 0 AND "percentualComissao" <= 100)),
ADD CONSTRAINT "lancamentos_financeiros_valorComissaoPorViagem_check"
CHECK ("valorComissaoPorViagem" IS NULL OR "valorComissaoPorViagem" >= 0),
ADD CONSTRAINT "lancamentos_financeiros_valorComissao_check"
CHECK ("valorComissao" IS NULL OR "valorComissao" >= 0),
ADD CONSTRAINT "lancamentos_financeiros_quantidadeEixosComissao_check"
CHECK ("quantidadeEixosComissao" IS NULL OR "quantidadeEixosComissao" >= 0),
ADD CONSTRAINT "lancamentos_financeiros_origemComissao_check"
CHECK ("faturamentoOrigemId" IS NULL OR ("tipoLancamento" = 'DESPESA' AND "faturamentoOrigemId" <> "id")),
ADD CONSTRAINT "lancamentos_financeiros_dadosComissao_check"
CHECK (
  "tipoComissao" IS NULL OR (
    "tipoLancamento" = 'FATURAMENTO'
    AND "faturamentoOrigemId" IS NULL
    AND "quantidadeEixosComissao" IN (7, 9)
    AND "valorComissao" IS NOT NULL
  )
);

INSERT INTO "categorias_financeiras" (
  "id",
  "nome",
  "codigoSistema",
  "tipoLancamento",
  "ativo",
  "observacoes",
  "createdAt",
  "updatedAt"
)
VALUES (
  'categoria-comissao-motorista',
  'Comissão de motorista',
  'COMISSAO_MOTORISTA',
  'DESPESA',
  true,
  'Categoria criada automaticamente para despesas de comissão vinculadas aos faturamentos.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("nome") DO UPDATE SET
  "codigoSistema" = 'COMISSAO_MOTORISTA',
  "tipoLancamento" = 'DESPESA',
  "ativo" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

COMMIT;
