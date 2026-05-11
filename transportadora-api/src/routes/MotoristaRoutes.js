const express = require("express");
const motoristaController = require("../controllers/MotoristaController");

const router = express.Router();

router.get("/", motoristaController.listar);
router.post("/", motoristaController.criar);
router.get("/:id", motoristaController.buscar);
router.put("/:id", motoristaController.atualizar);
router.delete("/:id", motoristaController.remover);

module.exports = router;
