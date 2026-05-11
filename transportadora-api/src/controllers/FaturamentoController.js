const faturamentoService = require("../services/FaturamentoService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const faturamentos = await faturamentoService.listarFaturamentos();
        res.json(faturamentos);
    } catch (error) {
        responderErro(res, error);
    }
}

async function criar(req, res) {
    try {
        const faturamento = await faturamentoService.criarFaturamento(req.body);
        res.status(201).json(faturamento);
    } catch (error) {
        responderErro(res, error);
    }
}

async function atualizar(req, res) {
    try {
        const faturamento = await faturamentoService.atualizarFaturamento(req.params.id, req.body);
        res.json(faturamento);
    } catch (error) {
        responderErro(res, error);
    }
}

async function remover(req, res) {
    try {
        await faturamentoService.removerFaturamento(req.params.id);
        res.status(204).send();
    } catch (error) {
        responderErro(res, error);
    }
}

module.exports = {
    listar,
    criar,
    atualizar,
    remover
};
