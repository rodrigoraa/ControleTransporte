const express = require("express");
const composicaoController = require("../controllers/ComposicaoVeiculoController");

const router = express.Router();

router.get("/", composicaoController.listar);
router.post("/", composicaoController.criar);
router.patch("/:id/encerrar", composicaoController.encerrar);

module.exports = router;
