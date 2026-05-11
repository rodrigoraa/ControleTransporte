(function () {
  const state = {
    veiculos: [],
    motoristas: [],
    filtroTipo: "",
    apiBase: localStorage.getItem("controleTransporteApiBase") || "http://localhost:3000",
  };

  const $ = (selector) => document.querySelector(selector);

  const elements = {
    alert: $("#alert"),
    apiBase: $("#apiBase"),
    reloadButton: $("#reloadButton"),
    compositionForm: $("#compositionForm"),
    compositionTruckSelect: $("#compositionTruckSelect"),
    compositionDriverSelect: $("#compositionDriverSelect"),
    compositionItems: $("#compositionItems"),
    addCompositionItem: $("#addCompositionItem"),
    extractTruckSelect: $("#extractTruckSelect"),
    extractView: $("#extractView"),
  };

  elements.apiBase.value = state.apiBase;

  document.querySelectorAll(".workflow-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".workflow-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));

      button.classList.add("active");
      $(`#view-${button.dataset.view}`).classList.add("active");
    });
  });

  function apiUrl(path) {
    return `${state.apiBase.replace(/\/$/, "")}${path}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      let message = `Erro ${response.status}`;
      try {
        const body = await response.json();
        message = body.erro || message;
      } catch (error) {
        message = response.statusText || message;
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  function showAlert(message, type = "error") {
    elements.alert.textContent = message;
    elements.alert.className = type === "success" ? "alert success" : "alert";
    elements.alert.hidden = false;

    window.clearTimeout(showAlert.timeout);
    showAlert.timeout = window.setTimeout(() => {
      elements.alert.hidden = true;
    }, 4200);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function cleanPayload(payload) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== "" && value !== null && value !== undefined)
    );
  }

  function dateValue(value) {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleString("pt-BR");
  }

  function vehicleName(veiculo) {
    if (!veiculo) {
      return "-";
    }
    return [veiculo.placa, veiculo.marca, veiculo.modelo].filter(Boolean).join(" / ");
  }

  function vehicleKind(veiculo) {
    if (!veiculo) {
      return "-";
    }
    return veiculo.tipoDescricao || veiculo.tipo || "-";
  }

  function options(items, label, emptyText = "Selecione") {
    return [`<option value="">${emptyText}</option>`]
      .concat(items.map((item) => `<option value="${item.id}">${label(item)}</option>`))
      .join("");
  }

  function renderSelectors() {
    const plateOptions = options(state.veiculos, vehicleName);
    elements.compositionTruckSelect.innerHTML = plateOptions;
    elements.extractTruckSelect.innerHTML = plateOptions;
    elements.compositionDriverSelect.innerHTML = options(state.motoristas, (item) => item.nome, "Selecionar motorista");
    ensureCompositionRows();
  }

  function compositionVehicleOptions(selectedValue = "") {
    return [`<option value="">Selecione uma placa</option>`]
      .concat(
        state.veiculos.map((item) => {
          const selected = String(item.id) === String(selectedValue) ? " selected" : "";
          return `<option value="${item.id}"${selected}>${item.placa} - ${vehicleKind(item)}</option>`;
        })
      )
      .join("");
  }

  function addCompositionRow(selectedValue = "") {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <label>
        Placa
        <select name="itemVeiculoId" required>
          ${compositionVehicleOptions(selectedValue)}
        </select>
      </label>
      <label>
        Tipo
        <input name="itemTipo" readonly />
      </label>
      <button class="icon-button remove-item" type="button" title="Remover placa">Remover</button>
    `;

    const select = row.querySelector('select[name="itemVeiculoId"]');
    const typeInput = row.querySelector('input[name="itemTipo"]');

    function updateType() {
      const veiculo = state.veiculos.find((item) => String(item.id) === String(select.value));
      typeInput.value = vehicleKind(veiculo);
    }

    select.addEventListener("change", updateType);
    row.querySelector(".remove-item").addEventListener("click", () => {
      row.remove();
      ensureCompositionRows();
    });

    elements.compositionItems.appendChild(row);
    updateType();
  }

  function ensureCompositionRows() {
    if (!elements.compositionItems.children.length) {
      addCompositionRow();
    } else {
      Array.from(elements.compositionItems.querySelectorAll('select[name="itemVeiculoId"]')).forEach((select) => {
        const selectedValue = select.value;
        select.innerHTML = compositionVehicleOptions(selectedValue);
        select.dispatchEvent(new Event("change"));
      });
    }
  }

  function syncTruckFromDriver() {
    const motorista = state.motoristas.find((item) => String(item.id) === String(elements.compositionDriverSelect.value));

    if (motorista?.veiculoAtualId) {
      elements.compositionTruckSelect.value = String(motorista.veiculoAtualId);
    }
  }

  function syncDriverFromTruck() {
    const motorista = state.motoristas.find((item) => String(item.veiculoAtualId) === String(elements.compositionTruckSelect.value));

    if (motorista) {
      elements.compositionDriverSelect.value = String(motorista.id);
    }
  }

  function renderExtract(extrato) {
    const atual = extrato.conjuntoAtual;
    const itensAtuais = atual?.itens || [];
    const historico = extrato.historico || [];

    elements.extractView.innerHTML = `
      <div class="extract-card">
        <div class="data-grid">
          <div>
            <span>Placa</span>
            <strong>${extrato.caminhao.placa}</strong>
          </div>
          <div>
            <span>Marca / modelo</span>
            <strong>${[extrato.caminhao.marca, extrato.caminhao.modelo].filter(Boolean).join(" / ") || "-"}</strong>
          </div>
          <div>
            <span>Motorista atual</span>
            <strong>${extrato.caminhao.motoristaAtual?.nome || atual?.motorista?.nome || "-"}</strong>
          </div>
        </div>

        <div>
          <h3 class="section-title">Conjunto atual</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Tipo</th>
                  <th>Placa</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Inicio</th>
                </tr>
              </thead>
              <tbody>
                ${
                  itensAtuais.length
                    ? itensAtuais
                        .map(
                          (item) => `
                            <tr>
                              <td>${item.ordem}</td>
                              <td>${item.veiculo.tipoDescricao || "-"}</td>
                              <td>${item.veiculo.placa}</td>
                              <td>${item.veiculo.marca || "-"}</td>
                              <td>${item.veiculo.modelo || "-"}</td>
                              <td>${dateValue(atual.dataInicio)}</td>
                            </tr>
                          `
                        )
                        .join("")
                    : `<tr><td colspan="6">Sem conjunto atual.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 class="section-title">Historico de conjuntos anteriores</h3>
          <div class="history-list">
            ${
              historico.length
                ? historico
                    .map(
                      (composicao) => `
                        <article class="history-item">
                          <span>${dateValue(composicao.dataInicio)} ate ${dateValue(composicao.dataFim)}</span>
                          <strong>${composicao.itens.map((item) => item.veiculo.placa).join(" + ")}</strong>
                        </article>
                      `
                    )
                    .join("")
                : `<div class="extract-empty">Nenhum conjunto anterior salvo.</div>`
            }
          </div>
        </div>
      </div>
    `;
  }

  async function loadData() {
    state.apiBase = elements.apiBase.value.trim() || "http://localhost:3000";
    localStorage.setItem("controleTransporteApiBase", state.apiBase);

    const [veiculos, motoristas] = await Promise.all([
      request("/veiculos"),
      request("/motoristas"),
    ]);

    state.veiculos = veiculos;
    state.motoristas = motoristas;

    renderSelectors();

    const firstPlate = state.veiculos[0];
    if (firstPlate) {
      elements.extractTruckSelect.value = String(firstPlate.id);
      await loadExtract(firstPlate.id);
    } else {
      elements.extractView.textContent = "Cadastre uma placa para consultar o extrato.";
    }
  }

  async function loadExtract(id) {
    if (!id) {
      elements.extractView.textContent = "Selecione um caminhao para consultar.";
      return;
    }

    const extrato = await request(`/caminhoes/${id}/extrato`);
    renderExtract(extrato);
  }

  elements.reloadButton.addEventListener("click", async () => {
    try {
      await loadData();
      showAlert("Dados atualizados.", "success");
    } catch (error) {
      showAlert(error.message);
    }
  });

  elements.compositionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const payload = cleanPayload(formData(elements.compositionForm));
      payload.placaPrincipalId = Number(payload.placaPrincipalId);
      if (payload.motoristaId) {
        payload.motoristaId = Number(payload.motoristaId);
      }
      payload.itens = Array.from(elements.compositionItems.querySelectorAll('select[name="itemVeiculoId"]'))
        .filter((select) => select.value)
        .map((select, index) => ({
          veiculoId: Number(select.value),
          ordem: index + 1,
        }));

      const ids = payload.itens.map((item) => item.veiculoId);
      if (new Set(ids).size !== ids.length) {
        throw new Error("Nao selecione a mesma placa mais de uma vez no conjunto.");
      }

      if (!payload.itens.length) {
        throw new Error("Selecione ao menos uma placa engatada.");
      }

      await request("/composicoes-veiculos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      elements.compositionForm.reset();
      elements.compositionItems.innerHTML = "";
      ensureCompositionRows();
      await loadData();
      elements.extractTruckSelect.value = String(payload.placaPrincipalId);
      await loadExtract(payload.placaPrincipalId);
      document.querySelector('[data-view="extrato"]').click();
      showAlert("Conjunto atualizado e historico preservado.", "success");
    } catch (error) {
      showAlert(error.message);
    }
  });

  elements.extractTruckSelect.addEventListener("change", async (event) => {
    try {
      await loadExtract(event.target.value);
    } catch (error) {
      showAlert(error.message);
    }
  });

  elements.compositionDriverSelect.addEventListener("change", () => {
    syncTruckFromDriver();
  });

  elements.compositionTruckSelect.addEventListener("change", () => {
    syncDriverFromTruck();
  });

  elements.addCompositionItem.addEventListener("click", () => {
    addCompositionRow();
  });

  loadData().catch((error) => {
    showAlert(error.message);
  });
})();
