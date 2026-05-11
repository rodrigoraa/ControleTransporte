const express = require("express");
const clienteController = require("../controllers/ClienteController");

const router = express.Router();

router.get("/", clienteController.listar);
router.post("/", clienteController.criar);
router.put("/:id", clienteController.atualizar);
router.delete("/:id", clienteController.remover);

module.exports = router;
