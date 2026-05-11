const motoristaService = require("../services/MotoristaService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const motoristas = await motoristaService.listarMotoristas();
        res.json(motoristas);
    } catch (error) {
        responderErro(res, error);
    }
}

async function buscar(req, res) {
    try {
        const motorista = await motoristaService.buscarMotoristaPorId(req.params.id);
        res.json(motorista);
    } catch (error) {
        responderErro(res, error);
    }
}

async function criar(req, res) {
    try {
        const motorista = await motoristaService.criarMotorista(req.body);
        res.status(201).json(motorista);
    } catch (error) {
        responderErro(res, error);
    }
}

async function atualizar(req, res) {
    try {
        const motorista = await motoristaService.atualizarMotorista(req.params.id, req.body);
        res.json(motorista);
    } catch (error) {
        responderErro(res, error);
    }
}

async function remover(req, res) {
    try {
        await motoristaService.removerMotorista(req.params.id);
        res.status(204).send();
    } catch (error) {
        responderErro(res, error);
    }
}

module.exports = {
    listar,
    buscar,
    criar,
    atualizar,
    remover
};
