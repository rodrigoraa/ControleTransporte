const express = require("express");
const caminhaoController = require("../controllers/CaminhaoController");

const router = express.Router();

router.get("/", caminhaoController.listar);
router.post("/", caminhaoController.criar);
router.put("/:id", caminhaoController.atualizar);
router.delete("/:id", caminhaoController.remover);
router.get("/:id/extrato", caminhaoController.extrato);

module.exports = router;
