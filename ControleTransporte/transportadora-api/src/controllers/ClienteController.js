const clienteService = require("../services/clienteService");

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

module.exports = {
    listar,
    criar
};