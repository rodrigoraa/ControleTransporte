const express = require("express");
const clienteController = require("../controllers/clienteController");

const router = express.Router();

router.get("/", clienteController.listar);
router.post("/", clienteController.criar);

module.exports = router;
