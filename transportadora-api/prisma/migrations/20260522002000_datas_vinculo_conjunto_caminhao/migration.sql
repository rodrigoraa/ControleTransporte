ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "dataColocacaoConjunto" TIMESTAMP(3);
ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "dataRemocaoConjunto" TIMESTAMP(3);

