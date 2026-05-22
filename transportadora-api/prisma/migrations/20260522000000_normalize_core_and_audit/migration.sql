CREATE TABLE IF NOT EXISTS "auditorias" (
  "id" TEXT NOT NULL,
  "entidade" TEXT NOT NULL,
  "entidadeId" TEXT,
  "acao" TEXT NOT NULL,
  "usuarioId" TEXT,
  "dadosAntes" JSONB,
  "dadosDepois" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auditorias_entidade_idx" ON "auditorias"("entidade");
CREATE INDEX IF NOT EXISTS "auditorias_entidadeId_idx" ON "auditorias"("entidadeId");
CREATE INDEX IF NOT EXISTS "auditorias_usuarioId_idx" ON "auditorias"("usuarioId");
CREATE INDEX IF NOT EXISTS "auditorias_createdAt_idx" ON "auditorias"("createdAt");

ALTER TABLE "caminhoes" ADD COLUMN IF NOT EXISTS "conjuntoId" TEXT;

UPDATE "caminhoes" c
SET "conjuntoId" = cj."id"
FROM "conjuntos" cj
WHERE c."tipo" IS NOT NULL AND c."tipo" = cj."nome";

CREATE INDEX IF NOT EXISTS "caminhoes_conjuntoId_idx" ON "caminhoes"("conjuntoId");

ALTER TABLE "caminhoes" DROP CONSTRAINT IF EXISTS "caminhoes_conjuntoId_fkey";
ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "caminhoes" ALTER COLUMN "status" SET DEFAULT 'ATIVO';
UPDATE "caminhoes" SET "status" = 'ATIVO' WHERE "status" IS NULL;
ALTER TABLE "caminhoes" ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "fornecedores" ALTER COLUMN "ativo" SET DEFAULT true;
UPDATE "fornecedores" SET "ativo" = true WHERE "ativo" IS NULL;
ALTER TABLE "fornecedores" ALTER COLUMN "ativo" SET NOT NULL;

ALTER TABLE "lancamentos_financeiros" RENAME COLUMN "placaOuPessoa" TO "placa";
DROP INDEX IF EXISTS "lancamentos_financeiros_categoria_idx";
ALTER TABLE "lancamentos_financeiros" DROP COLUMN IF EXISTS "categoria";
DROP TYPE IF EXISTS "CategoriaLancamento";
ALTER TABLE "caminhoes" DROP COLUMN IF EXISTS "tipo";
