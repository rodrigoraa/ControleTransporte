const express = require("express");
const despesaController = require("../controllers/DespesaController");

const router = express.Router();

router.get("/", despesaController.listar);
router.post("/", despesaController.criar);
router.put("/:id", despesaController.atualizar);
router.delete("/:id", despesaController.remover);

module.exports = router;
