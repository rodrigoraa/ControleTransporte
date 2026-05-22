CREATE TABLE "historicos_clientes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historicos_clientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historicos_fornecedores" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historicos_fornecedores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historicos_clientes_clienteId_idx" ON "historicos_clientes"("clienteId");

CREATE INDEX "historicos_fornecedores_fornecedorId_idx" ON "historicos_fornecedores"("fornecedorId");

ALTER TABLE "historicos_clientes"
ADD CONSTRAINT "historicos_clientes_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "historicos_fornecedores"
ADD CONSTRAINT "historicos_fornecedores_fornecedorId_fkey"
FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
