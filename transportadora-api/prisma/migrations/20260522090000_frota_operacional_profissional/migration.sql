CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TYPE "StatusGeral" ADD VALUE IF NOT EXISTS 'MANUTENCAO';

DO $$ BEGIN
  CREATE TYPE "TipoImplemento" AS ENUM ('CARRETA', 'SEMIRREBOQUE', 'REBOQUE', 'DOLLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoCarroceria" AS ENUM ('BAU', 'GRANELEIRO', 'SIDER', 'TANQUE', 'PRANCHA', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoConjuntoOperacional" AS ENUM ('SIMPLES', 'BITREM', 'RODOTREM', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "cavalos_mecanicos" (
  "id" TEXT NOT NULL,
  "placa" TEXT NOT NULL,
  "marca" TEXT,
  "modelo" TEXT,
  "ano" INTEGER,
  "renavam" TEXT,
  "chassi" TEXT,
  "cor" TEXT,
  "status" "StatusGeral" NOT NULL DEFAULT 'ATIVO',
  "motoristaId" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cavalos_mecanicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "implementos" (
  "id" TEXT NOT NULL,
  "placa" TEXT,
  "tipo" "TipoImplemento" NOT NULL,
  "carroceria" "TipoCarroceria" NOT NULL DEFAULT 'OUTRO',
  "quantidadeEixos" INTEGER NOT NULL,
  "capacidadeCarga" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "status" "StatusGeral" NOT NULL DEFAULT 'ATIVO',
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "implementos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "tipo" "TipoConjuntoOperacional" NOT NULL DEFAULT 'SIMPLES';
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "cavaloMecanicoId" TEXT;
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "quantidadeTotalEixos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "capacidadeTotal" DECIMAL(12,3) NOT NULL DEFAULT 0;
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "status" "StatusGeral" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "justificativaSemImplemento" TEXT;
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
ALTER TABLE "conjuntos" ALTER COLUMN "placa" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "conjuntos_implementos" (
  "id" TEXT NOT NULL,
  "conjuntoId" TEXT NOT NULL,
  "implementoId" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 1,
  "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataFim" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conjuntos_implementos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historicos_cavalos_mecanicos" (
  "id" TEXT NOT NULL,
  "cavaloMecanicoId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "dadosAntes" JSONB,
  "dadosDepois" JSONB,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historicos_cavalos_mecanicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historicos_implementos" (
  "id" TEXT NOT NULL,
  "implementoId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "dadosAntes" JSONB,
  "dadosDepois" JSONB,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historicos_implementos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historicos_conjuntos_operacionais" (
  "id" TEXT NOT NULL,
  "conjuntoId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "dadosAntes" JSONB,
  "dadosDepois" JSONB,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historicos_conjuntos_operacionais_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "lancamentos_financeiros" ADD COLUMN IF NOT EXISTS "cavaloMecanicoId" TEXT;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN IF NOT EXISTS "conjuntoId" TEXT;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN IF NOT EXISTS "implementoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "cavalos_mecanicos_placa_key" ON "cavalos_mecanicos"("placa");
CREATE UNIQUE INDEX IF NOT EXISTS "cavalos_mecanicos_chassi_key" ON "cavalos_mecanicos"("chassi");
CREATE UNIQUE INDEX IF NOT EXISTS "cavalos_mecanicos_renavam_key" ON "cavalos_mecanicos"("renavam");
CREATE INDEX IF NOT EXISTS "cavalos_mecanicos_motoristaId_idx" ON "cavalos_mecanicos"("motoristaId");
CREATE UNIQUE INDEX IF NOT EXISTS "implementos_placa_key" ON "implementos"("placa");
CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_implementos_conjuntoId_implementoId_key" ON "conjuntos_implementos"("conjuntoId", "implementoId");
CREATE INDEX IF NOT EXISTS "conjuntos_cavaloMecanicoId_idx" ON "conjuntos"("cavaloMecanicoId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_cavaloMecanicoId_idx" ON "lancamentos_financeiros"("cavaloMecanicoId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_conjuntoId_idx" ON "lancamentos_financeiros"("conjuntoId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_implementoId_idx" ON "lancamentos_financeiros"("implementoId");

INSERT INTO "cavalos_mecanicos" ("id", "placa", "marca", "modelo", "ano", "renavam", "chassi", "cor", "status", "observacoes", "createdAt", "updatedAt")
SELECT "id", "placa", "marca", "modelo", "ano", "renavam", "chassi", "cor", "status", COALESCE("observacoes", '') || ' | Migrado do cadastro legado de caminhoes.', "createdAt", "updatedAt"
FROM "caminhoes"
WHERE "placa" ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
ON CONFLICT ("placa") DO NOTHING;

INSERT INTO "implementos" ("id", "placa", "tipo", "carroceria", "quantidadeEixos", "capacidadeCarga", "status", "observacoes")
SELECT gen_random_uuid()::text, placa, tipo, 'OUTRO', eixos, capacidade, 'ATIVO', 'Criado automaticamente a partir do conjunto legado.'
FROM (
  SELECT "placa" AS placa, 'SEMIRREBOQUE'::"TipoImplemento" AS tipo, 3 AS eixos, 32000::decimal AS capacidade FROM "conjuntos" WHERE "placa" IS NOT NULL
  UNION ALL
  SELECT "dollyPlaca", 'DOLLY'::"TipoImplemento", 2, 0::decimal FROM "conjuntos" WHERE "dollyPlaca" IS NOT NULL
  UNION ALL
  SELECT "segundaCarretaPlaca", 'SEMIRREBOQUE'::"TipoImplemento", 3, 32000::decimal FROM "conjuntos" WHERE "segundaCarretaPlaca" IS NOT NULL
) origem
WHERE placa IS NOT NULL
ON CONFLICT ("placa") DO NOTHING;

UPDATE "conjuntos" c
SET "cavaloMecanicoId" = cm."id",
    "quantidadeTotalEixos" = COALESCE((SELECT SUM(i."quantidadeEixos") FROM "implementos" i WHERE i."placa" IN (c."placa", c."dollyPlaca", c."segundaCarretaPlaca")), 0),
    "capacidadeTotal" = COALESCE((SELECT SUM(i."capacidadeCarga") FROM "implementos" i WHERE i."placa" IN (c."placa", c."dollyPlaca", c."segundaCarretaPlaca")), 0),
    "tipo" = CASE WHEN c."segundaCarretaPlaca" IS NOT NULL AND c."dollyPlaca" IS NOT NULL THEN 'RODOTREM'::"TipoConjuntoOperacional" ELSE 'SIMPLES'::"TipoConjuntoOperacional" END
FROM "caminhoes" cam
JOIN "cavalos_mecanicos" cm ON cm."placa" = cam."placa"
WHERE cam."conjuntoId" = c."id" AND c."cavaloMecanicoId" IS NULL;

INSERT INTO "conjuntos_implementos" ("id", "conjuntoId", "implementoId", "ordem")
SELECT gen_random_uuid()::text, c."id", i."id", x.ordem
FROM "conjuntos" c
JOIN LATERAL (VALUES (c."placa", 1), (c."dollyPlaca", 2), (c."segundaCarretaPlaca", 3)) AS x(placa, ordem) ON x.placa IS NOT NULL
JOIN "implementos" i ON i."placa" = x.placa
ON CONFLICT ("conjuntoId", "implementoId") DO NOTHING;

UPDATE "conjuntos"
SET "justificativaSemImplemento" = 'Conjunto legado sem implemento identificado automaticamente.'
WHERE "cavaloMecanicoId" IS NOT NULL AND "quantidadeTotalEixos" = 0 AND "justificativaSemImplemento" IS NULL;

UPDATE "lancamentos_financeiros" lf
SET "cavaloMecanicoId" = cm."id",
    "conjuntoId" = c."id"
FROM "cavalos_mecanicos" cm
LEFT JOIN "conjuntos" c ON c."cavaloMecanicoId" = cm."id"
WHERE lf."placa" = cm."placa";

ALTER TABLE "conjuntos" ALTER COLUMN "cavaloMecanicoId" SET NOT NULL;
ALTER TABLE "cavalos_mecanicos" ADD CONSTRAINT "cavalos_mecanicos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conjuntos" ADD CONSTRAINT "conjuntos_cavaloMecanicoId_fkey" FOREIGN KEY ("cavaloMecanicoId") REFERENCES "cavalos_mecanicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conjuntos_implementos" ADD CONSTRAINT "conjuntos_implementos_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conjuntos_implementos" ADD CONSTRAINT "conjuntos_implementos_implementoId_fkey" FOREIGN KEY ("implementoId") REFERENCES "implementos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historicos_cavalos_mecanicos" ADD CONSTRAINT "historicos_cavalos_mecanicos_cavaloMecanicoId_fkey" FOREIGN KEY ("cavaloMecanicoId") REFERENCES "cavalos_mecanicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historicos_implementos" ADD CONSTRAINT "historicos_implementos_implementoId_fkey" FOREIGN KEY ("implementoId") REFERENCES "implementos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historicos_conjuntos_operacionais" ADD CONSTRAINT "historicos_conjuntos_operacionais_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_cavaloMecanicoId_fkey" FOREIGN KEY ("cavaloMecanicoId") REFERENCES "cavalos_mecanicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_implementoId_fkey" FOREIGN KEY ("implementoId") REFERENCES "implementos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
