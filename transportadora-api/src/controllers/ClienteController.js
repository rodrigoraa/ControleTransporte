const clienteService = require("../services/ClienteService");

function responderErro(res, error) {
    res.status(error.statusCode || 500).json({
        erro: error.message || "Erro interno do servidor"
    });
}

async function listar(req, res) {
    try {
        const clientes = await clienteService.listarClientes();
        res.json(clientes);
    } catch (error) {
        res.status(500).json({
            erro: "Erro ao listar clientes"
        });
    }
}

async function criar(req, res) {
    try {
        const { nome } = req.body;

        if (!nome) {
            return res.status(400).json({
                erro: "O nome do cliente é obrigatório"
            });
        }

        const cliente = await clienteService.criarCliente(nome);

        res.status(201).json(cliente);
    } catch (error) {
        res.status(500).json({
            erro: "Erro ao criar cliente"
        });
    }
}

async function atualizar(req, res) {
    try {
        const { nome } = req.body;

        if (!nome) {
            return res.status(400).json({
                erro: "O nome do cliente e obrigatorio"
            });
        }

        const cliente = await clienteService.atualizarCliente(req.params.id, nome);
        res.json(cliente);
    } catch (error) {
        responderErro(res, error);
    }
}

async function remover(req, res) {
    try {
        await clienteService.removerCliente(req.params.id);
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
