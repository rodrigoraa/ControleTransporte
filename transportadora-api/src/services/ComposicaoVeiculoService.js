const prisma = require("../prisma/client");
const { normalizarPlaca } = require("./VeiculoService");

function erroValidacao(mensagem, statusCode = 400) {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
}

function dataOuAgora(data) {
    return data ? new Date(data) : new Date();
}

async function resolverCavalo(dados, tx = prisma) {
    const where = dados.placaPrincipalId || dados.cavaloId
        ? { id: Number(dados.placaPrincipalId || dados.cavaloId) }
        : { placa: normalizarPlaca(dados.placaPrincipal || dados.cavaloPlaca || dados.placa) };

    const cavalo = await tx.veiculo.findUnique({ where });

    if (!cavalo) {
        throw erroValidacao("Placa principal nao encontrada.", 404);
    }

    return cavalo;
}

async function resolverMotorista(dados, tx = prisma) {
    if (dados.motoristaId) {
        const motorista = await tx.motorista.findUnique({
            where: { id: Number(dados.motoristaId) }
        });

        if (!motorista) {
            throw erroValidacao("Motorista nao encontrado.", 404);
        }

        return motorista;
    }

    if (dados.motoristaNome || dados.motorista) {
        return tx.motorista.create({
            data: {
                nome: dados.motoristaNome || dados.motorista
            }
        });
    }

    return null;
}

function normalizarItens(dados) {
    const itens = Array.isArray(dados.itens) ? dados.itens : [];

    if (Array.isArray(dados.carretas)) {
        dados.carretas.forEach((carreta, index) => {
            itens.push({
                ...(typeof carreta === "object" ? carreta : { placa: carreta }),
                ordem: index + 1
            });
        });
    }

    if (dados.dollyId || dados.dollyPlaca) {
        itens.push({
            veiculoId: dados.dollyId,
            placa: dados.dollyPlaca,
            ordem: itens.length + 1
        });
    }

    return itens;
}

async function resolverItens(dados, cavaloId, tx = prisma) {
    const itens = normalizarItens(dados);

    if (!itens.length) {
        throw erroValidacao("Informe ao menos uma placa engatada para a composicao.");
    }

    const veiculos = [];
    const idsUsados = new Set();

    for (const [index, item] of itens.entries()) {
        const where = item.veiculoId
            ? { id: Number(item.veiculoId) }
            : { placa: normalizarPlaca(item.placa) };

        const veiculo = await tx.veiculo.findUnique({ where });

        if (!veiculo) {
            throw erroValidacao(`Veiculo do item ${index + 1} nao encontrado.`, 404);
        }

        if (veiculo.id === cavaloId) {
            throw erroValidacao("A placa principal nao pode ser incluida como item engatado nela mesma.");
        }

        if (idsUsados.has(veiculo.id)) {
            throw erroValidacao("Nao informe o mesmo veiculo mais de uma vez na composicao.");
        }

        idsUsados.add(veiculo.id);

        veiculos.push({
            veiculo,
            ordem: item.ordem ? Number(item.ordem) : index + 1,
            observacao: item.observacao || null
        });
    }

    return veiculos;
}

function includeComposicao() {
    return {
        cavalo: {
            include: {
                motoristaAtual: true
            }
        },
        motorista: true,
        itens: {
            include: {
                veiculo: true
            },
            orderBy: { ordem: "asc" }
        }
    };
}

async function listarComposicoes(filtros = {}) {
    const where = {};

    if (filtros.cavaloId) {
        where.cavaloId = Number(filtros.cavaloId);
    }

    if (filtros.atuais === "true" || filtros.atuais === true) {
        where.dataFim = null;
    }

    return prisma.composicaoVeiculo.findMany({
        where,
        include: includeComposicao(),
        orderBy: [
            { dataFim: "asc" },
            { dataInicio: "desc" }
        ]
    });
}

async function criarComposicao(dados) {
    return prisma.$transaction(async (tx) => {
        const cavalo = await resolverCavalo(dados, tx);
        const motorista = await resolverMotorista(dados, tx);
        const itens = await resolverItens(dados, cavalo.id, tx);
        const dataInicio = dataOuAgora(dados.dataInicio);

        const composicaoAtual = await tx.composicaoVeiculo.findFirst({
            where: {
                cavaloId: cavalo.id,
                dataFim: null
            }
        });

        if (composicaoAtual) {
            await tx.composicaoVeiculo.update({
                where: { id: composicaoAtual.id },
                data: { dataFim: dataInicio }
            });
        }

        if (motorista) {
            await tx.motorista.updateMany({
                where: {
                    veiculoAtualId: cavalo.id,
                    NOT: { id: motorista.id }
                },
                data: { veiculoAtualId: null }
            });

            await tx.motorista.update({
                where: { id: motorista.id },
                data: { veiculoAtualId: cavalo.id }
            });
        }

        return tx.composicaoVeiculo.create({
            data: {
                cavaloId: cavalo.id,
                motoristaId: motorista?.id || null,
                dataInicio,
                observacao: dados.observacao || null,
                itens: {
                    create: itens.map((item) => ({
                        veiculoId: item.veiculo.id,
                        ordem: item.ordem,
                        observacao: item.observacao
                    }))
                }
            },
            include: includeComposicao()
        });
    });
}

async function encerrarComposicao(id, dataFim = new Date()) {
    const composicao = await prisma.composicaoVeiculo.findUnique({
        where: { id: Number(id) }
    });

    if (!composicao) {
        throw erroValidacao("Composicao nao encontrada.", 404);
    }

    return prisma.composicaoVeiculo.update({
        where: { id: Number(id) },
        data: { dataFim: dataOuAgora(dataFim) },
        include: includeComposicao()
    });
}

async function buscarExtratoCaminhao(id) {
    const cavalo = await prisma.veiculo.findUnique({
        where: { id: Number(id) },
        include: {
            motoristaAtual: true
        }
    });

    if (!cavalo) {
        throw erroValidacao("Placa nao encontrada.", 404);
    }

    const composicoes = await prisma.composicaoVeiculo.findMany({
        where: { cavaloId: cavalo.id },
        include: includeComposicao(),
        orderBy: [
            { dataFim: "asc" },
            { dataInicio: "desc" }
        ]
    });

    return {
        caminhao: cavalo,
        conjuntoAtual: composicoes.find((composicao) => composicao.dataFim === null) || null,
        historico: composicoes.filter((composicao) => composicao.dataFim !== null)
    };
}

module.exports = {
    listarComposicoes,
    criarComposicao,
    encerrarComposicao,
    buscarExtratoCaminhao
};
