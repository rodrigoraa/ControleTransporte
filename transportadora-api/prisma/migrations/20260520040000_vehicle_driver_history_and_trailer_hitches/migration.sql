CREATE TABLE IF NOT EXISTS "historicos_motoristas" (
  "id" TEXT NOT NULL,
  "motoristaId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "dadosAntes" JSONB,
  "dadosDepois" JSONB,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historicos_motoristas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historicos_caminhoes" (
  "id" TEXT NOT NULL,
  "caminhaoId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "dadosAntes" JSONB,
  "dadosDepois" JSONB,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historicos_caminhoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "engates_carretas" (
  "id" TEXT NOT NULL,
  "cavaloId" TEXT NOT NULL,
  "carreta1Id" TEXT,
  "carreta2Id" TEXT,
  "motoristaId" TEXT,
  "dataInicio" TIMESTAMP(3) NOT NULL,
  "dataFim" TIMESTAMP(3),
  "status" "StatusAcompanhamento" NOT NULL DEFAULT 'ATIVO',
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "engates_carretas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "historicos_motoristas_motoristaId_idx" ON "historicos_motoristas"("motoristaId");
CREATE INDEX IF NOT EXISTS "historicos_caminhoes_caminhaoId_idx" ON "historicos_caminhoes"("caminhaoId");
CREATE INDEX IF NOT EXISTS "engates_carretas_cavaloId_idx" ON "engates_carretas"("cavaloId");
CREATE INDEX IF NOT EXISTS "engates_carretas_carreta1Id_idx" ON "engates_carretas"("carreta1Id");
CREATE INDEX IF NOT EXISTS "engates_carretas_carreta2Id_idx" ON "engates_carretas"("carreta2Id");
CREATE INDEX IF NOT EXISTS "engates_carretas_motoristaId_idx" ON "engates_carretas"("motoristaId");
CREATE INDEX IF NOT EXISTS "engates_carretas_dataInicio_idx" ON "engates_carretas"("dataInicio");

ALTER TABLE "historicos_motoristas" DROP CONSTRAINT IF EXISTS "historicos_motoristas_motoristaId_fkey";
ALTER TABLE "historicos_motoristas" ADD CONSTRAINT "historicos_motoristas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "historicos_caminhoes" DROP CONSTRAINT IF EXISTS "historicos_caminhoes_caminhaoId_fkey";
ALTER TABLE "historicos_caminhoes" ADD CONSTRAINT "historicos_caminhoes_caminhaoId_fkey" FOREIGN KEY ("caminhaoId") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engates_carretas" DROP CONSTRAINT IF EXISTS "engates_carretas_cavaloId_fkey";
ALTER TABLE "engates_carretas" DROP CONSTRAINT IF EXISTS "engates_carretas_carreta1Id_fkey";
ALTER TABLE "engates_carretas" DROP CONSTRAINT IF EXISTS "engates_carretas_carreta2Id_fkey";
ALTER TABLE "engates_carretas" DROP CONSTRAINT IF EXISTS "engates_carretas_motoristaId_fkey";
ALTER TABLE "engates_carretas" ADD CONSTRAINT "engates_carretas_cavaloId_fkey" FOREIGN KEY ("cavaloId") REFERENCES "caminhoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engates_carretas" ADD CONSTRAINT "engates_carretas_carreta1Id_fkey" FOREIGN KEY ("carreta1Id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "engates_carretas" ADD CONSTRAINT "engates_carretas_carreta2Id_fkey" FOREIGN KEY ("carreta2Id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "engates_carretas" ADD CONSTRAINT "engates_carretas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
