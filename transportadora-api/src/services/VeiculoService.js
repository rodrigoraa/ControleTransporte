const prisma = require("../prisma/client");

const TIPOS_VEICULO = ["CAVALO", "CARRETA", "DOLLY"];

function normalizarTipo(tipo) {
    const tipoNormalizado = String(tipo || "").trim().toUpperCase();

    if (!TIPOS_VEICULO.includes(tipoNormalizado)) {
        const erro = new Error("Tipo de veiculo invalido. Use CAVALO, CARRETA ou DOLLY.");
        erro.statusCode = 400;
        throw erro;
    }

    return tipoNormalizado;
}

function normalizarPlaca(placa) {
    return String(placa || "").trim().toUpperCase();
}

function montarDadosVeiculo(dados, tipoObrigatorio = true) {
    const placa = normalizarPlaca(dados.placa);

    if (!placa) {
        const erro = new Error("A placa do veiculo e obrigatoria.");
        erro.statusCode = 400;
        throw erro;
    }

    const resultado = {
        placa,
        tipoDescricao: dados.tipoDescricao || dados.tipoDetalhe || null,
        marca: dados.marca || null,
        modelo: dados.modelo || null,
        anoFabricacao: dados.anoFabricacao ? Number(dados.anoFabricacao) : null,
        proprietario: dados.proprietario || null,
        situacaoOperacional: dados.situacaoOperacional || "Ativo",
        situacaoCadastro: dados.situacaoCadastro || "Normal"
    };

    if (dados.tipo || tipoObrigatorio) {
        resultado.tipo = normalizarTipo(dados.tipo);
    }

    return resultado;
}

async function listarVeiculos(filtros = {}) {
    const where = {};

    if (filtros.tipo) {
        where.tipo = normalizarTipo(filtros.tipo);
    }

    return prisma.veiculo.findMany({
        where,
        include: {
            motoristaAtual: true
        },
        orderBy: [
            { tipo: "asc" },
            { placa: "asc" }
        ]
    });
}

async function buscarVeiculoPorId(id) {
    const veiculo = await prisma.veiculo.findUnique({
        where: { id: Number(id) },
        include: {
            motoristaAtual: true
        }
    });

    if (!veiculo) {
        const erro = new Error("Veiculo nao encontrado.");
        erro.statusCode = 404;
        throw erro;
    }

    return veiculo;
}

async function criarVeiculo(dados) {
    return prisma.veiculo.create({
        data: montarDadosVeiculo(dados)
    });
}

async function atualizarVeiculo(id, dados) {
    await buscarVeiculoPorId(id);

    const data = {};

    if (Object.prototype.hasOwnProperty.call(dados, "placa")) {
        const placa = normalizarPlaca(dados.placa);

        if (!placa) {
            const erro = new Error("A placa do veiculo e obrigatoria.");
            erro.statusCode = 400;
            throw erro;
        }

        data.placa = placa;
    }

    if (Object.prototype.hasOwnProperty.call(dados, "tipo")) {
        data.tipo = normalizarTipo(dados.tipo);
    }

    [
        "marca",
        "modelo",
        "tipoDescricao",
        "tipoDetalhe",
        "proprietario",
        "situacaoOperacional",
        "situacaoCadastro"
    ].forEach((campo) => {
        if (Object.prototype.hasOwnProperty.call(dados, campo)) {
            const destino = campo === "tipoDetalhe" ? "tipoDescricao" : campo;
            data[destino] = dados[campo] || null;
        }
    });

    if (Object.prototype.hasOwnProperty.call(dados, "anoFabricacao")) {
        data.anoFabricacao = dados.anoFabricacao ? Number(dados.anoFabricacao) : null;
    }

    return prisma.veiculo.update({
        where: { id: Number(id) },
        data
    });
}

async function removerVeiculo(id) {
    await buscarVeiculoPorId(id);

    return prisma.veiculo.delete({
        where: { id: Number(id) }
    });
}

async function listarCaminhoes() {
    const caminhoes = await listarVeiculos({ tipo: "CAVALO" });

    return caminhoes.map((caminhao) => ({
        ...caminhao,
        motorista: caminhao.motoristaAtual?.nome || ""
    }));
}

async function criarCaminhao(dados) {
    const caminhao = await criarVeiculo({
        ...dados,
        tipo: "CAVALO"
    });

    if (dados.motorista) {
        const motorista = await prisma.motorista.create({
            data: {
                nome: dados.motorista,
                veiculoAtualId: caminhao.id
            }
        });

        return {
            ...caminhao,
            motorista: motorista.nome,
            motoristaAtual: motorista
        };
    }

    return {
        ...caminhao,
        motorista: ""
    };
}

async function atualizarCaminhao(id, dados) {
    const caminhao = await atualizarVeiculo(id, {
        ...dados,
        tipo: "CAVALO"
    });

    if (Object.prototype.hasOwnProperty.call(dados, "motorista")) {
        await prisma.motorista.updateMany({
            where: { veiculoAtualId: Number(id) },
            data: { veiculoAtualId: null }
        });

        if (dados.motorista) {
            await prisma.motorista.create({
                data: {
                    nome: dados.motorista,
                    veiculoAtualId: Number(id)
                }
            });
        }
    }

    return caminhao;
}

module.exports = {
    TIPOS_VEICULO,
    normalizarTipo,
    normalizarPlaca,
    listarVeiculos,
    buscarVeiculoPorId,
    criarVeiculo,
    atualizarVeiculo,
    removerVeiculo,
    listarCaminhoes,
    criarCaminhao,
    atualizarCaminhao
};
