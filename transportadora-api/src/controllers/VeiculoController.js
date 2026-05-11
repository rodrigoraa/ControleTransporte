const veiculoService = require("../services/VeiculoService");
const composicaoService = require("../services/ComposicaoVeiculoService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const veiculos = await veiculoService.listarVeiculos(req.query);
        res.json(veiculos);
    } catch (error) {
        responderErro(res, error);
    }
}

async function buscar(req, res) {
    try {
        const veiculo = await veiculoService.buscarVeiculoPorId(req.params.id);
        res.json(veiculo);
    } catch (error) {
        responderErro(res, error);
    }
}

async function criar(req, res) {
    try {
        const veiculo = await veiculoService.criarVeiculo(req.body);
        res.status(201).json(veiculo);
    } catch (error) {
        responderErro(res, error);
    }
}

async function atualizar(req, res) {
    try {
        const veiculo = await veiculoService.atualizarVeiculo(req.params.id, req.body);
        res.json(veiculo);
    } catch (error) {
        responderErro(res, error);
    }
}

async function remover(req, res) {
    try {
        await veiculoService.removerVeiculo(req.params.id);
        res.status(204).send();
    } catch (error) {
        responderErro(res, error);
    }
}

async function extrato(req, res) {
    try {
        const extratoCaminhao = await composicaoService.buscarExtratoCaminhao(req.params.id);
        res.json(extratoCaminhao);
    } catch (error) {
        responderErro(res, error);
    }
}

module.exports = {
    listar,
    buscar,
    criar,
    atualizar,
    remover,
    extrato
};
