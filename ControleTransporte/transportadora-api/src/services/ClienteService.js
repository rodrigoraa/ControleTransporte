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

module.exports = {
    listarClientes,
    criarCliente
};