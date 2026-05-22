CREATE TABLE IF NOT EXISTS "conjuntos" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "placa" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conjuntos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_nome_key" ON "conjuntos"("nome");
CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_placa_key" ON "conjuntos"("placa");
