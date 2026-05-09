const express = require("express");
const cors = require("cors");
const clienteRoutes = require("./routes/clienteRoutes");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/clientes", clienteRoutes);

app.get("/", (req, res) => {
    res.json({
        mensagem: "API da Transportadora funcionando 🚛"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});