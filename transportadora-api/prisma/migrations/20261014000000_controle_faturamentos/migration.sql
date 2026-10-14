-- One atomic migration: old invoices get stable numbers before new writes resume.
BEGIN;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "numeroControle" INTEGER;
CREATE SEQUENCE "faturamentos_controle_seq" AS INTEGER;
ALTER SEQUENCE "faturamentos_controle_seq" OWNED BY "lancamentos_financeiros"."numeroControle";

WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "lancamentos_financeiros" WHERE "tipoLancamento" = 'FATURAMENTO'
)
UPDATE "lancamentos_financeiros" AS f
SET "numeroControle" = n
FROM numbered WHERE f."id" = numbered."id";

SELECT setval('faturamentos_controle_seq', greatest(count(*), 1), count(*) > 0)
FROM "lancamentos_financeiros" WHERE "numeroControle" IS NOT NULL;

CREATE UNIQUE INDEX "lancamentos_financeiros_numeroControle_key"
ON "lancamentos_financeiros"("numeroControle");

CREATE FUNCTION gerar_controle_faturamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."numeroControle" IS NOT NULL THEN
      RAISE EXCEPTION 'O controle do faturamento e gerado automaticamente.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."numeroControle" IS DISTINCT FROM OLD."numeroControle" THEN
    RAISE EXCEPTION 'O controle do faturamento nao pode ser alterado.' USING ERRCODE = '23514';
  END IF;

  IF NEW."tipoLancamento" = 'FATURAMENTO' AND NEW."numeroControle" IS NULL THEN
    NEW."numeroControle" := nextval(format('%I.faturamentos_controle_seq', TG_TABLE_SCHEMA)::regclass);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "lancamentos_controle_automatico"
BEFORE INSERT OR UPDATE ON "lancamentos_financeiros"
FOR EACH ROW EXECUTE FUNCTION gerar_controle_faturamento();
COMMIT;
