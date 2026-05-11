const express = require("express");
const faturamentoController = require("../controllers/FaturamentoController");

const router = express.Router();

router.get("/", faturamentoController.listar);
router.post("/", faturamentoController.criar);
router.put("/:id", faturamentoController.atualizar);
router.delete("/:id", faturamentoController.remover);

module.exports = router;
