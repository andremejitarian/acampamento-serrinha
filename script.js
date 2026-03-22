// ─── Constantes ────────────────────────────────────────────────────────────

const DESCONTO_IRMAOS = 0.05;
const TAXA_CARTAO_6X = 0.0967;
const TAXA_CARTAO_AVISTA = 0.04;
const CUPONS = { CUPOM5: 0.05, CUPOM10: 0.10, CUPOM15: 0.15 };

// ─── Estado ─────────────────────────────────────────────────────────────────

let config = null;          // config do acampamento (do JSON)
let criancas = [];          // array de blocos de criança
let cupomAtivo = null;      // null ou { codigo, pct }
let pagamentoTipo = null;   // "pix_avista" | "pix_sinal" | "cartao_parcelado"
let currentStep = 1;

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const eventoId = params.get("evento") || "A001";

  try {
    const resp = await fetch("acampamentos.json");
    const json = await resp.json();
    config = json[eventoId];
    if (!config) throw new Error(`Evento ${eventoId} não encontrado`);
  } catch (e) {
    alert("Não foi possível carregar as informações do evento. Tente novamente.");
    return;
  }

  document.title = `Inscrição — ${config.nome}`;
  document.getElementById("eventoNome").textContent = config.nome;
  document.getElementById("eventoPeriodo").textContent = config.periodo;

  // Adicionar primeira criança
  addCrianca();

  // Eventos
  document.getElementById("btn-add-crianca").addEventListener("click", addCrianca);
  document.getElementById("btn-step1-next").addEventListener("click", goToStep2);
  document.getElementById("btn-step2-back").addEventListener("click", () => goToStep(1));
  document.getElementById("btn-step2-next").addEventListener("click", submitForm);
  document.getElementById("btn-cupom").addEventListener("click", aplicarCupom);
  document.getElementById("cupom-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); aplicarCupom(); }
  });

  // Selecionar forma de pagamento ao clicar no radio-item
  document.getElementById("pagamento-group").addEventListener("change", (e) => {
    if (e.target.name === "pagamento") {
      pagamentoTipo = e.target.value;
      document.querySelectorAll(".radio-item").forEach(el => {
        el.classList.toggle("selected", el.dataset.tipo === pagamentoTipo);
      });
      atualizarResumo();
    }
  });

  // Formatação de CPF e telefone
  document.getElementById("resp-cpf").addEventListener("input", (e) => {
    e.target.value = formatCpf(e.target.value);
  });
  document.getElementById("resp-telefone").addEventListener("input", (e) => {
    e.target.value = formatTelefone(e.target.value);
  });
});

// ─── Criança ─────────────────────────────────────────────────────────────────

function addCrianca() {
  const idx = criancas.length;
  const template = document.getElementById("crianca-template");
  const clone = template.content.cloneNode(true);
  const block = clone.querySelector(".child-block");

  block.dataset.idx = idx;
  block.querySelector(".child-num").textContent = idx + 1;

  // Nomes únicos para radio buttons
  block.querySelectorAll("[name*='PLACEHOLDER']").forEach(el => {
    el.name = el.name.replace("PLACEHOLDER", idx);
  });

  // Remover botão oculto se for a primeira criança
  const removeBtn = block.querySelector(".btn-remove-crianca");
  if (idx === 0) removeBtn.style.display = "none";
  removeBtn.addEventListener("click", () => removeCrianca(idx));

  // CPF formatting
  block.querySelector(".c-cpf").addEventListener("input", (e) => {
    e.target.value = formatCpf(e.target.value);
  });
  block.querySelector(".c-cep").addEventListener("input", (e) => {
    e.target.value = formatCep(e.target.value);
  });

  document.getElementById("criancas-container").appendChild(clone);
  criancas.push(idx);
  atualizarNumeracaoCriancas();
}

function removeCrianca(idx) {
  const block = document.querySelector(`.child-block[data-idx="${idx}"]`);
  if (block) block.remove();
  criancas = criancas.filter(i => i !== idx);
  atualizarNumeracaoCriancas();
}

function atualizarNumeracaoCriancas() {
  const blocos = document.querySelectorAll(".child-block");
  blocos.forEach((b, i) => {
    b.querySelector(".child-num").textContent = i + 1;
    const removeBtn = b.querySelector(".btn-remove-crianca");
    removeBtn.style.display = blocos.length === 1 ? "none" : "";
  });
}

// ─── Navegação ───────────────────────────────────────────────────────────────

function goToStep(n) {
  document.getElementById(`step-${currentStep}`).style.display = "none";
  currentStep = n;
  document.getElementById(`step-${n}`).style.display = "block";
  updateDots();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateDots() {
  [1, 2, 3].forEach(i => {
    const dot = document.getElementById(`dot-${i}`);
    dot.className = "step-dot";
    if (i < currentStep) dot.classList.add("done");
    else if (i === currentStep) dot.classList.add("active");
  });
}

function goToStep2() {
  if (!validateStep1()) return;
  atualizarResumo();
  goToStep(2);
}

// ─── Validação ───────────────────────────────────────────────────────────────

function validateStep1() {
  let ok = true;

  const required = ["resp-nome", "resp-cpf", "resp-email", "resp-telefone"];
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { markError(el); ok = false; }
    else clearError(el);
  });

  if (!document.getElementById("concordo-desistencia").checked) {
    alert("Por favor, confirme que leu e concorda com a política de desistência.");
    ok = false;
  }

  // Validar cada criança
  const blocos = document.querySelectorAll(".child-block");
  if (blocos.length === 0) { alert("Adicione pelo menos uma criança."); return false; }

  blocos.forEach(block => {
    const reqFields = ["c-nome", "c-nascimento", "c-escola", "c-ano-escolar",
                       "c-endereco", "c-cep", "c-rg", "c-cpf", "c-convenio", "c-num-convenio"];
    reqFields.forEach(cls => {
      const el = block.querySelector(`.${cls}`);
      if (el && !el.value.trim()) { markError(el); ok = false; }
      else if (el) clearError(el);
    });

    // Autorizo participação
    if (!block.querySelector(".c-autorizo-participacao").checked) {
      alert(`Confirme a autorização de participação para todas as crianças.`);
      ok = false;
    }
  });

  return ok;
}

function validateStep2() {
  if (!pagamentoTipo) {
    alert("Selecione uma forma de pagamento.");
    return false;
  }
  return true;
}

function markError(el) { el.classList.add("error"); el.classList.remove("valid"); }
function clearError(el) { el.classList.remove("error"); el.classList.add("valid"); }

// ─── Cálculo de preços ───────────────────────────────────────────────────────

function calcularTotais() {
  const preco = config.precoPorCrianca;
  const qtd = document.querySelectorAll(".child-block").length;
  let base = qtd * preco;
  const descontoIrmaos = qtd > 1 ? Math.round(base * DESCONTO_IRMAOS * 100) / 100 : 0;
  base -= descontoIrmaos;
  const descontoCupom = cupomAtivo ? Math.round(base * cupomAtivo.pct * 100) / 100 : 0;
  const totalAvista = Math.round((base - descontoCupom) * 100) / 100;
  const totalCartaoAvista = Math.round(totalAvista / (1 - TAXA_CARTAO_AVISTA) * 100) / 100;
  const totalCartao = Math.round(totalAvista / (1 - TAXA_CARTAO_6X) * 100) / 100;
  const parcela = Math.round(totalCartao / 6 * 100) / 100;
  const sinal = Math.round(totalAvista * 0.30 * 100) / 100;
  const saldo = Math.round((totalAvista - sinal) * 100) / 100;

  return { qtd, preco, descontoIrmaos, descontoCupom, totalAvista, totalCartaoAvista, totalCartao, parcela, sinal, saldo };
}

function atualizarResumo() {
  const t = calcularTotais();

  // Atualizar descrições nas opções de pagamento
  document.getElementById("desc-pix-avista").textContent = `R$ ${fmt(t.totalAvista)}`;
  document.getElementById("desc-pix-sinal").textContent = `Sinal: R$ ${fmt(t.sinal)} · Saldo: R$ ${fmt(t.saldo)}`;
  document.getElementById("desc-cartao-avista").textContent = `R$ ${fmt(t.totalCartaoAvista)}`;
  document.getElementById("desc-cartao").textContent = `6x de R$ ${fmt(t.parcela)} (total R$ ${fmt(t.totalCartao)})`;

  // Resumo de valores
  const box = document.getElementById("summary-box");
  let html = `<div class="summary-row"><span>${t.qtd} criança${t.qtd > 1 ? "s" : ""} × R$ ${fmt(t.preco)}</span><span>R$ ${fmt(t.qtd * t.preco)}</span></div>`;
  if (t.descontoIrmaos > 0)
    html += `<div class="summary-row discount"><span>Desconto irmãos (5%)</span><span>− R$ ${fmt(t.descontoIrmaos)}</span></div>`;
  if (t.descontoCupom > 0)
    html += `<div class="summary-row discount"><span>Cupom ${cupomAtivo.codigo} (${(cupomAtivo.pct * 100).toFixed(0)}%)</span><span>− R$ ${fmt(t.descontoCupom)}</span></div>`;
  html += `<div class="summary-row total"><span>Total à vista (PIX)</span><span>R$ ${fmt(t.totalAvista)}</span></div>`;
  box.innerHTML = html;
}

// ─── Cupom ───────────────────────────────────────────────────────────────────

function aplicarCupom() {
  const codigo = document.getElementById("cupom-input").value.trim().toUpperCase();
  const msg = document.getElementById("cupom-msg");

  if (!codigo) {
    cupomAtivo = null;
    msg.textContent = "";
    msg.className = "cupom-msg";
    atualizarResumo();
    return;
  }

  const pct = CUPONS[codigo];
  if (pct) {
    cupomAtivo = { codigo, pct };
    msg.textContent = `Cupom aplicado: ${(pct * 100).toFixed(0)}% de desconto.`;
    msg.className = "cupom-msg ok";
  } else {
    cupomAtivo = null;
    msg.textContent = "Cupom inválido.";
    msg.className = "cupom-msg err";
  }

  atualizarResumo();
}

// ─── Coleta de dados ─────────────────────────────────────────────────────────

function coletarPayload() {
  const t = calcularTotais();
  const totalFinal = pagamentoTipo === "cartao_parcelado" ? t.totalCartao
    : pagamentoTipo === "cartao_avista" ? t.totalCartaoAvista
    : t.totalAvista;

  const responsavel = {
    nome: v("resp-nome"),
    cpf: v("resp-cpf"),
    email: v("resp-email"),
    telefone: v("resp-telefone").replace(/\D/g, ""),
  };

  const blocos = document.querySelectorAll(".child-block");
  const criancasData = Array.from(blocos).map(block => ({
    nome: qv(block, ".c-nome"),
    dataNascimento: qv(block, ".c-nascimento"),
    escola: qv(block, ".c-escola"),
    anoEscolar: qv(block, ".c-ano-escolar"),
    endereco: qv(block, ".c-endereco"),
    cep: qv(block, ".c-cep"),
    rg: qv(block, ".c-rg"),
    cpf: qv(block, ".c-cpf"),
    saude: {
      alergias: qv(block, ".c-alergias"),
      restricoesAlimentares: qv(block, ".c-restricoes-alimentares"),
      restricoesMedicacao: qv(block, ".c-restricoes-medicacao"),
      medicacaoFebre: qv(block, ".c-med-febre"),
      medicacaoDiarreia: qv(block, ".c-med-diarreia"),
      medicacaoPicada: qv(block, ".c-med-picada"),
      medicacaoContinuo: qv(block, ".c-med-continuo"),
      condicoes: Array.from(block.querySelectorAll(".c-cond:checked")).map(cb => cb.value),
      convenio: qv(block, ".c-convenio"),
      numConvenio: qv(block, ".c-num-convenio"),
    },
    autorizacoes: {
      nadar: block.querySelector(".c-nadar:checked")?.value ?? "",
      beliche: block.querySelector(".c-beliche:checked")?.value ?? "",
      infoAdicional: qv(block, ".c-info-adicional"),
      autorizoParticipacao: block.querySelector(".c-autorizo-participacao").checked,
      usoImagem: block.querySelector(".c-uso-imagem:checked")?.value ?? "",
    },
  }));

  const inscricaoId = gerarCodigoInscricao(config.edicao);

  return {
    inscricao_id: inscricaoId,
    evento: {
      id: config.id,
      event_id: config.event_id,
      nome: config.nome,
      periodo: config.periodo,
      dataPagamentoFinal: config.dataPagamentoFinal,
    },
    responsavel,
    criancas: criancasData,
    pagamento: { tipo: pagamentoTipo },
    totais: {
      qtdCriancas: t.qtd,
      precoPorCrianca: t.preco,
      descontoIrmaos: t.descontoIrmaos,
      descontoCupom: t.descontoCupom,
      cupom: cupomAtivo?.codigo ?? null,
      totalAvista: t.totalAvista,
      totalFinal,
    },
    extras: {
      contatoEmergencia: v("contato-emergencia"),
      comoSoube: v("como-soube"),
      concordaDesistencia: document.getElementById("concordo-desistencia").checked,
    },
  };
}

// ─── Submit ──────────────────────────────────────────────────────────────────

async function submitForm() {
  if (!validateStep2()) return;

  const payload = coletarPayload();

  showLoading("Criando sua inscrição…");

  try {
    const resp = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const link1 = data.output?.link || data.link || "";
    const link2 = data.output?.link2 || data.link2 || "";

    hideLoading();
    showConfirmacao(link1, link2, payload.totais.totalFinal, payload.totais.totalAvista);

  } catch (e) {
    hideLoading();
    alert("Ocorreu um erro ao processar sua inscrição. Por favor, tente novamente ou entre em contato.");
    console.error(e);
  }
}

function showConfirmacao(link1, link2, totalFinal, totalAvista) {
  goToStep(3);

  const container = document.getElementById("payment-links");
  const t = calcularTotais();

  if (pagamentoTipo === "pix_sinal" && link2) {
    document.getElementById("success-msg").textContent = "Acesse os links abaixo para efetuar o pagamento.";
    container.innerHTML = `
      <div style="text-align:left;width:100%">
        <p style="font-size:0.9em;color:#666;margin-bottom:8px">Sinal de 30% — R$ ${fmt(t.sinal)}</p>
        <a href="${link1}" target="_blank" class="btn-payment" style="margin-bottom:16px;width:100%;justify-content:center">Pagar sinal agora</a>
        <p style="font-size:0.9em;color:#666;margin-bottom:8px">Saldo de 70% — R$ ${fmt(t.saldo)} (vence em ${formatDatePtBR(config.dataPagamentoFinal)})</p>
        <a href="${link2}" target="_blank" class="btn-payment" style="background:#555;width:100%;justify-content:center">Link do saldo</a>
      </div>`;
  } else {
    const valorStr = pagamentoTipo === "cartao_parcelado"
      ? `R$ ${fmt(totalFinal)} (6x de R$ ${fmt(t.parcela)})`
      : `R$ ${fmt(totalAvista)}`;
    document.getElementById("success-msg").textContent = `Valor: ${valorStr}`;
    container.innerHTML = `<a href="${link1}" target="_blank" class="btn-payment">Ir para o pagamento →</a>`;
  }
}

// ─── Loading ─────────────────────────────────────────────────────────────────

function showLoading(text) {
  document.getElementById("overlayText").textContent = text;
  document.getElementById("loadingOverlay").classList.add("visible");
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.remove("visible");
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function gerarCodigoInscricao(edicao) {
  const sufixo = Date.now().toString(36).slice(-4).toUpperCase();
  return `ACAMP${edicao}${sufixo}`;
}

function fmt(value) {
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDatePtBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function v(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function qv(block, selector) {
  return block.querySelector(selector)?.value?.trim() ?? "";
}

function formatCpf(value) {
  return value.replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
}

function formatTelefone(value) {
  return value.replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{4})$/, "$1-$2")
    .slice(0, 15);
}

function formatCep(value) {
  return value.replace(/\D/g, "")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 9);
}
