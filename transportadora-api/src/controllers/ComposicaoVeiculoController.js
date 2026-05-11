const composicaoService = require("../services/ComposicaoVeiculoService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const composicoes = await composicaoService.listarComposicoes(req.query);
        res.json(composicoes);
    } catch (error) {
        responderErro(res, error);
    }
}

async function criar(req, res) {
    try {
        const composicao = await composicaoService.criarComposicao(req.body);
        res.status(201).json(composicao);
    } catch (error) {
        responderErro(res, error);
    }
}

async function encerrar(req, res) {
    try {
        const composicao = await composicaoService.encerrarComposicao(req.params.id, req.body.dataFim);
        res.json(composicao);
    } catch (error) {
        responderErro(res, error);
    }
}

module.exports = {
    listar,
    criar,
    encerrar
};
