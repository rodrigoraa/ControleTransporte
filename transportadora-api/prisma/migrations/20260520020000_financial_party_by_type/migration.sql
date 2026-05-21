ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_fornecedorId_fkey";
ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "fornecedorId" DROP NOT NULL;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
