ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_motoristaId_fkey";
ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "motoristaId" DROP NOT NULL;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
