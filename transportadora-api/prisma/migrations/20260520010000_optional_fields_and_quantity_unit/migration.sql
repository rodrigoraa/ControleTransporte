DO $$ BEGIN
  CREATE TYPE "UnidadeQuantidade" AS ENUM ('KG', 'UNIDADE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "clientes" ALTER COLUMN "documento" DROP NOT NULL;

ALTER TABLE "funcionarios" ALTER COLUMN "cargo" DROP NOT NULL;
ALTER TABLE "funcionarios" ALTER COLUMN "dataAdmissao" DROP NOT NULL;

ALTER TABLE "motoristas" ALTER COLUMN "cpf" DROP NOT NULL;
ALTER TABLE "motoristas" ALTER COLUMN "cnh" DROP NOT NULL;
ALTER TABLE "motoristas" ALTER COLUMN "categoriaCnh" DROP NOT NULL;
ALTER TABLE "motoristas" ALTER COLUMN "validadeCnh" DROP NOT NULL;
ALTER TABLE "motoristas" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "motoristas" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "caminhoes" ALTER COLUMN "marca" DROP NOT NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "modelo" DROP NOT NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "ano" DROP NOT NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "tipo" DROP NOT NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "fornecedores" ALTER COLUMN "documento" DROP NOT NULL;
ALTER TABLE "fornecedores" ALTER COLUMN "ativo" DROP NOT NULL;
ALTER TABLE "fornecedores" ALTER COLUMN "ativo" DROP DEFAULT;

ALTER TABLE "acompanhamentos" ALTER COLUMN "dataInicio" DROP NOT NULL;
ALTER TABLE "acompanhamentos" ALTER COLUMN "dataFim" DROP NOT NULL;
ALTER TABLE "acompanhamentos" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "acompanhamentos" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "categoria" DROP NOT NULL;
ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "descricao" DROP NOT NULL;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN IF NOT EXISTS "unidadeQuantidade" "UnidadeQuantidade";
UPDATE "lancamentos_financeiros" SET "unidadeQuantidade" = 'UNIDADE' WHERE "unidadeQuantidade" IS NULL;
ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "unidadeQuantidade" SET NOT NULL;

ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_motoristaId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_fornecedorId_fkey";
ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "motoristaId" SET NOT NULL;
ALTER TABLE "lancamentos_financeiros" ALTER COLUMN "fornecedorId" DROP NOT NULL;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
