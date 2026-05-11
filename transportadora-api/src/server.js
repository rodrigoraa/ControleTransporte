const express = require("express");
const cors = require("cors");
const clienteRoutes = require("./routes/ClienteRoutes");
const motoristaRoutes = require("./routes/MotoristaRoutes");
const veiculoRoutes = require("./routes/VeiculoRoutes");
const caminhaoRoutes = require("./routes/CaminhaoRoutes");
const composicaoVeiculoRoutes = require("./routes/ComposicaoVeiculoRoutes");
const despesaRoutes = require("./routes/DespesaRoutes");
const faturamentoRoutes = require("./routes/FaturamentoRoutes");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/clientes", clienteRoutes);
app.use("/motoristas", motoristaRoutes);
app.use("/veiculos", veiculoRoutes);
app.use("/caminhoes", caminhaoRoutes);
app.use("/composicoes-veiculos", composicaoVeiculoRoutes);
app.use("/despesas", despesaRoutes);
app.use("/faturamentos", faturamentoRoutes);

app.get("/", (req, res) => {
    res.json({
        mensagem: "API da Transportadora funcionando 🚛"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
