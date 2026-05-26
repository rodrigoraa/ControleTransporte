CREATE TYPE "TipoCavaloMecanico" AS ENUM ('SIMPLES_TOCO_4X2', 'TRUCADO_6X2', 'TRACADO_6X4');

ALTER TABLE "cavalos_mecanicos" ADD COLUMN "tipoCavalo" "TipoCavaloMecanico";
