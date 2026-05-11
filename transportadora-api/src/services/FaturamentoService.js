const prisma = require("../prisma/client");

function parseDecimal(value, fallback = undefined) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return Number(String(value).replace(",", "."));
}

function formatarFaturamento(faturamento) {
    return {
        ...faturamento,
        quantidadeToneladas: Number(faturamento.quantidadeToneladas),
        valorFretePorTonelada: Number(faturamento.valorFretePorTonelada),
        valorTotalFrete: Number(faturamento.valorTotalFrete),
        quantidade: Number(faturamento.quantidadeToneladas),
        valorUnitario: Number(faturamento.valorFretePorTonelada),
        total: Number(faturamento.valorTotalFrete),
        tipo: "",
        unidadeQuantidade: "tonelada"
    };
}

function montarDadosFaturamento(dados) {
    const quantidade = parseDecimal(dados.quantidade, 1);
    const valorUnitario = parseDecimal(dados.valorUnitario, 0);

    return {
        data: new Date(dados.data),
        clienteId: Number(dados.clienteId),
        produto: dados.produto || dados.tipo || "Frete",
        placa: dados.placa || null,
        motorista: dados.motorista || null,
        quantidadeToneladas: quantidade,
        valorFretePorTonelada: valorUnitario,
        valorTotalFrete: quantidade * valorUnitario,
        km: dados.km === undefined || dados.km === null || dados.km === "" ? null : Number(dados.km),
        descricao: dados.descricao || null
    };
}

async function listarFaturamentos() {
    const faturamentos = await prisma.faturamento.findMany({
        include: {
            cliente: true
        },
        orderBy: {
            data: "desc"
        }
    });

    return faturamentos.map(formatarFaturamento);
}

async function criarFaturamento(dados) {
    const faturamento = await prisma.faturamento.create({
        data: montarDadosFaturamento(dados),
        include: {
            cliente: true
        }
    });

    return formatarFaturamento(faturamento);
}

async function atualizarFaturamento(id, dados) {
    const faturamento = await prisma.faturamento.update({
        where: {
            id: Number(id)
        },
        data: montarDadosFaturamento(dados),
        include: {
            cliente: true
        }
    });

    return formatarFaturamento(faturamento);
}

async function removerFaturamento(id) {
    return await prisma.faturamento.delete({
        where: {
            id: Number(id)
        }
    });
}

module.exports = {
    listarFaturamentos,
    criarFaturamento,
    atualizarFaturamento,
    removerFaturamento
};
