const prisma = require("../prisma/client");

function parseDecimal(value, fallback = undefined) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return Number(String(value).replace(",", "."));
}

function formatarDespesa(despesa) {
    return {
        ...despesa,
        quantidade: Number(despesa.quantidade),
        valorUnitario: Number(despesa.valorUnitario),
        total: Number(despesa.total),
        produto: "",
        unidadeQuantidade: "unidade"
    };
}

function montarDadosDespesa(dados) {
    const quantidade = parseDecimal(dados.quantidade, 1);
    const valorUnitario = parseDecimal(dados.valorUnitario, 0);

    return {
        data: new Date(dados.data),
        placa: dados.placa || null,
        motorista: dados.motorista || null,
        fornecedor: dados.fornecedor || null,
        tipo: dados.tipo || null,
        descricao: dados.descricao || dados.produto || null,
        quantidade,
        valorUnitario,
        total: quantidade * valorUnitario,
        km: dados.km === undefined || dados.km === null || dados.km === "" ? null : Number(dados.km)
    };
}

async function listarDespesas() {
    const despesas = await prisma.despesa.findMany({
        orderBy: {
            data: "desc"
        }
    });

    return despesas.map(formatarDespesa);
}

async function criarDespesa(dados) {
    const despesa = await prisma.despesa.create({
        data: montarDadosDespesa(dados)
    });

    return formatarDespesa(despesa);
}

async function atualizarDespesa(id, dados) {
    const despesa = await prisma.despesa.update({
        where: {
            id: Number(id)
        },
        data: montarDadosDespesa(dados)
    });

    return formatarDespesa(despesa);
}

async function removerDespesa(id) {
    return await prisma.despesa.delete({
        where: {
            id: Number(id)
        }
    });
}

module.exports = {
    listarDespesas,
    criarDespesa,
    atualizarDespesa,
    removerDespesa
};
