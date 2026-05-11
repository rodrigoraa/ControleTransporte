const despesaService = require("../services/DespesaService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const despesas = await despesaService.listarDespesas();
        res.json(despesas);
    } catch (error) {
        responderErro(res, error);
    }
}

async function criar(req, res) {
    try {
        const despesa = await despesaService.criarDespesa(req.body);
        res.status(201).json(despesa);
    } catch (error) {
        responderErro(res, error);
    }
}

async function atualizar(req, res) {
    try {
        const despesa = await despesaService.atualizarDespesa(req.params.id, req.body);
        res.json(despesa);
    } catch (error) {
        responderErro(res, error);
    }
}

async function remover(req, res) {
    try {
        await despesaService.removerDespesa(req.params.id);
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
