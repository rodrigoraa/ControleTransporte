BEGIN;

ALTER TABLE "lancamentos_financeiros"
ADD COLUMN "descontoImpostos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "valorComissaoBruta" DECIMAL(14,2),
ADD COLUMN "valorDescontoImpostos" DECIMAL(14,2);

UPDATE "lancamentos_financeiros"
SET
  "valorComissaoBruta" = "valorComissao",
  "valorDescontoImpostos" = CASE
    WHEN "valorComissao" IS NULL THEN NULL
    ELSE 0
  END
WHERE "tipoComissao" IS NOT NULL;

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_valorComissaoBruta_check"
CHECK ("valorComissaoBruta" IS NULL OR "valorComissaoBruta" >= 0),
ADD CONSTRAINT "lancamentos_financeiros_valorDescontoImpostos_check"
CHECK ("valorDescontoImpostos" IS NULL OR "valorDescontoImpostos" >= 0),
ADD CONSTRAINT "lancamentos_financeiros_descontoImpostos_check"
CHECK (
  "descontoImpostos" = false OR (
    "tipoLancamento" = 'FATURAMENTO'
    AND "tipoComissao" IS NOT NULL
    AND "valorComissaoBruta" IS NOT NULL
    AND "valorDescontoImpostos" IS NOT NULL
    AND "valorComissao" IS NOT NULL
    AND "valorComissao" <= "valorComissaoBruta"
  )
);

COMMIT;
