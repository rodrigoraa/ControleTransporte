CREATE TABLE IF NOT EXISTS "categorias_financeiras" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipoLancamento" "TipoLancamento",
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "categorias_financeiras_nome_key" ON "categorias_financeiras"("nome");

ALTER TABLE "lancamentos_financeiros" ADD COLUMN IF NOT EXISTS "categoriaId" TEXT;
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_categoriaId_idx" ON "lancamentos_financeiros"("categoriaId");

ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_categoriaId_fkey";
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
