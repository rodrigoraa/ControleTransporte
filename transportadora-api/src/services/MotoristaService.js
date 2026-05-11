const prisma = require("../prisma/client");

function montarDadosMotorista(dados) {
    const nome = String(dados.nome || "").trim();

    if (!nome) {
        const erro = new Error("O nome do motorista e obrigatorio.");
        erro.statusCode = 400;
        throw erro;
    }

    return {
        nome,
        apelido: dados.apelido || null,
        cpf: dados.cpf || null,
        telefone: dados.telefone || null,
        cidade: dados.cidade || null,
        situacao: dados.situacao || "Ativo",
        veiculoAtualId: dados.veiculoAtualId ? Number(dados.veiculoAtualId) : null
    };
}

async function listarMotoristas() {
    return prisma.motorista.findMany({
        include: {
            veiculoAtual: true
        },
        orderBy: { nome: "asc" }
    });
}

async function buscarMotoristaPorId(id) {
    const motorista = await prisma.motorista.findUnique({
        where: { id: Number(id) },
        include: {
            veiculoAtual: true
        }
    });

    if (!motorista) {
        const erro = new Error("Motorista nao encontrado.");
        erro.statusCode = 404;
        throw erro;
    }

    return motorista;
}

async function criarMotorista(dados) {
    return prisma.motorista.create({
        data: montarDadosMotorista(dados),
        include: {
            veiculoAtual: true
        }
    });
}

async function atualizarMotorista(id, dados) {
    await buscarMotoristaPorId(id);

    const atual = await prisma.motorista.findUnique({
        where: { id: Number(id) }
    });

    return prisma.motorista.update({
        where: { id: Number(id) },
        data: montarDadosMotorista({
            ...atual,
            ...dados,
            veiculoAtualId: Object.prototype.hasOwnProperty.call(dados, "veiculoAtualId")
                ? dados.veiculoAtualId
                : atual.veiculoAtualId
        }),
        include: {
            veiculoAtual: true
        }
    });
}

async function removerMotorista(id) {
    await buscarMotoristaPorId(id);

    return prisma.motorista.delete({
        where: { id: Number(id) }
    });
}

module.exports = {
    listarMotoristas,
    buscarMotoristaPorId,
    criarMotorista,
    atualizarMotorista,
    removerMotorista
};
