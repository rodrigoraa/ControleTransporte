const prisma = require("../prisma/client");

async function listarClientes() {
    return await prisma.cliente.findMany({
        orderBy: {
            nome: "asc"
        }
    });
}

async function criarCliente(nome) {
    return await prisma.cliente.create({
        data: {
            nome
        }
    });
}

async function atualizarCliente(id, nome) {
    return await prisma.cliente.update({
        where: {
            id: Number(id)
        },
        data: {
            nome
        }
    });
}

async function removerCliente(id) {
    return await prisma.cliente.delete({
        where: {
            id: Number(id)
        }
    });
}

module.exports = {
    listarClientes,
    criarCliente,
    atualizarCliente,
    removerCliente
};
