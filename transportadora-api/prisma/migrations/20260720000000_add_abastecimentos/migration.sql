CREATE TABLE "abastecimentos" (
  "id" TEXT NOT NULL,
  "cavaloMecanicoId" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "kmAnterior" DECIMAL(12,1) NOT NULL,
  "kmAtual" DECIMAL(12,1) NOT NULL,
  "litros" DECIMAL(12,3) NOT NULL,
  "distanciaPercorrida" DECIMAL(12,1) NOT NULL,
  "mediaKmLitro" DECIMAL(12,3) NOT NULL,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "abastecimentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "abastecimentos_cavaloMecanicoId_data_idx" ON "abastecimentos"("cavaloMecanicoId", "data");

ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_cavaloMecanicoId_fkey"
  FOREIGN KEY ("cavaloMecanicoId") REFERENCES "cavalos_mecanicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
