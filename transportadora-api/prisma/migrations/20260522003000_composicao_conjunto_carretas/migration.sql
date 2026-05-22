ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "dollyPlaca" TEXT;
ALTER TABLE "conjuntos" ADD COLUMN IF NOT EXISTS "segundaCarretaPlaca" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_dollyPlaca_key" ON "conjuntos"("dollyPlaca") WHERE "dollyPlaca" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_segundaCarretaPlaca_key" ON "conjuntos"("segundaCarretaPlaca") WHERE "segundaCarretaPlaca" IS NOT NULL;

