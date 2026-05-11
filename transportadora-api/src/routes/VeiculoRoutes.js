const express = require("express");
const veiculoController = require("../controllers/VeiculoController");

const router = express.Router();

router.get("/", veiculoController.listar);
router.post("/", veiculoController.criar);
router.get("/:id", veiculoController.buscar);
router.put("/:id", veiculoController.atualizar);
router.delete("/:id", veiculoController.remover);
router.get("/:id/extrato", veiculoController.extrato);

module.exports = router;
