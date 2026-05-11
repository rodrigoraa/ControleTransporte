const veiculoService = require("../services/VeiculoService");
const composicaoService = require("../services/ComposicaoVeiculoService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const caminhoes = await veiculoService.listarCaminhoes();
        res.json(caminhoes);
    } catch (error) {
        responderErro(res, error);
    }
}

async function criar(req, res) {
    try {
        const caminhao = await veiculoService.criarCaminhao(req.body);
        res.status(201).json(caminhao);
    } catch (error) {
        responderErro(res, error);
    }
}

async function atualizar(req, res) {
    try {
        const caminhao = await veiculoService.atualizarCaminhao(req.params.id, req.body);
        res.json(caminhao);
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
    criar,
    atualizar,
    remover,
    extrato
};
