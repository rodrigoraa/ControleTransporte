BEGIN;

ALTER TABLE "lancamentos_financeiros"
DROP CONSTRAINT "lancamentos_financeiros_dadosComissao_check";

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_dadosComissao_check"
CHECK (
  "tipoComissao" IS NULL OR (
    "tipoLancamento" = 'FATURAMENTO'
    AND "faturamentoOrigemId" IS NULL
    AND "quantidadeEixosComissao" IN (4, 7, 9)
    AND "valorComissao" IS NOT NULL
  )
);

COMMIT;
