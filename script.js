// ─── Validação de CPF ────────────────────────────────────────────────────────

function isValidCpf(cpf) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let r = 11 - (sum % 11);
  if ((r >= 10 ? 0 : r) !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  r = 11 - (sum % 11);
  return (r >= 10 ? 0 : r) === parseInt(c[10]);
}

// ─── Validação de email ───────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Busca de CEP ─────────────────────────────────────────────────────────────

async function buscarEnderecoPorCep(cep) {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;
  try {
    return await Promise.any([
      fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`).then(async r => {
        const d = await r.json();
        if (d.erro) throw new Error("não encontrado");
        return { logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf };
      }),
      fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`).then(async r => {
        const d = await r.json();
        if (d.name === "CepPromiseError") throw new Error("não encontrado");
        return { logradouro: d.street, bairro: d.neighborhood, cidade: d.city, estado: d.state };
      }),
    ]);
  } catch {
    return null;
  }
}

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
  document.getElementById("cupom-input").addEventListener("input", aplicarCupom);

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

  // Formatação — Responsável 1
  document.getElementById("resp-cpf").addEventListener("input", (e) => {
    e.target.value = formatCpf(e.target.value);
  });
  document.getElementById("resp-telefone").addEventListener("input", (e) => {
    e.target.value = formatTelefone(e.target.value);
  });
  document.getElementById("resp-cep").addEventListener("input", (e) => {
    e.target.value = formatCep(e.target.value);
  });

  // Formatação — Responsável 2
  document.getElementById("resp2-cpf").addEventListener("input", (e) => {
    e.target.value = formatCpf(e.target.value);
  });
  document.getElementById("resp2-telefone").addEventListener("input", (e) => {
    e.target.value = formatTelefone(e.target.value);
  });

  // Validação on blur — Responsável 1
  document.getElementById("resp-cpf").addEventListener("blur", () => {
    const input = document.getElementById("resp-cpf");
    const msg = document.getElementById("cpf-msg");
    if (!input.value.trim()) return;
    if (isValidCpf(input.value)) {
      msg.textContent = "CPF válido";
      msg.className = "field-msg ok";
      clearError(input);
    } else {
      msg.textContent = "CPF inválido";
      msg.className = "field-msg err";
      markError(input);
    }
  });

  document.getElementById("resp-email").addEventListener("blur", () => {
    const input = document.getElementById("resp-email");
    const msg = document.getElementById("email-msg");
    if (!input.value.trim()) return;
    if (isValidEmail(input.value)) {
      msg.textContent = "";
      msg.className = "field-msg";
      clearError(input);
    } else {
      msg.textContent = "Email inválido";
      msg.className = "field-msg err";
      markError(input);
    }
  });

  // Validação on blur — Responsável 2
  document.getElementById("resp2-cpf").addEventListener("blur", () => {
    const input = document.getElementById("resp2-cpf");
    const msg = document.getElementById("cpf2-msg");
    if (!input.value.trim()) return;
    if (isValidCpf(input.value)) {
      msg.textContent = "CPF válido";
      msg.className = "field-msg ok";
      clearError(input);
    } else {
      msg.textContent = "CPF inválido";
      msg.className = "field-msg err";
      markError(input);
    }
  });

  document.getElementById("resp2-email").addEventListener("blur", () => {
    const input = document.getElementById("resp2-email");
    const msg = document.getElementById("email2-msg");
    if (!input.value.trim()) return;
    if (isValidEmail(input.value)) {
      msg.textContent = "";
      msg.className = "field-msg";
      clearError(input);
    } else {
      msg.textContent = "Email inválido";
      msg.className = "field-msg err";
      markError(input);
    }
  });

  document.getElementById("resp-cep").addEventListener("blur", async (e) => {
    const input = e.target;
    const msg = document.getElementById("cep-msg");
    if (input.value.replace(/\D/g, "").length !== 8) return;
    msg.textContent = "Buscando…";
    msg.className = "field-msg";
    const dados = await buscarEnderecoPorCep(input.value);
    if (dados) {
      if (dados.logradouro) document.getElementById("resp-endereco").value = dados.logradouro;
      if (dados.bairro) document.getElementById("resp-bairro").value = dados.bairro;
      if (dados.cidade) document.getElementById("resp-cidade").value = dados.cidade;
      if (dados.estado) document.getElementById("resp-estado").value = dados.estado.toUpperCase();
      msg.textContent = "";
      msg.className = "field-msg";
      clearError(input);
      document.getElementById("resp-numero").focus();
    } else {
      msg.textContent = "CEP não encontrado. Preencha o endereço manualmente.";
      msg.className = "field-msg err";
    }
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

  // CPF formatting + validation
  const cpfField = block.querySelector(".c-cpf");
  cpfField.addEventListener("input", (e) => {
    e.target.value = formatCpf(e.target.value);
  });
  cpfField.addEventListener("blur", (e) => {
    if (!e.target.value.trim()) return;
    if (isValidCpf(e.target.value)) {
      clearError(e.target);
    } else {
      markError(e.target);
    }
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

  const required = ["resp-nome", "resp-cpf", "resp-email", "resp-telefone",
                    "resp-cep", "resp-endereco", "resp-numero", "resp-bairro", "resp-cidade", "resp-estado"];
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { markError(el); ok = false; }
    else clearError(el);
  });

  // CPF — Responsável 1
  const cpfInput = document.getElementById("resp-cpf");
  const cpfMsg = document.getElementById("cpf-msg");
  if (cpfInput.value.trim() && !isValidCpf(cpfInput.value)) {
    markError(cpfInput);
    cpfMsg.textContent = "CPF inválido";
    cpfMsg.className = "field-msg err";
    ok = false;
  }

  // Email — Responsável 1
  const emailInput = document.getElementById("resp-email");
  const emailMsg = document.getElementById("email-msg");
  if (emailInput.value.trim() && !isValidEmail(emailInput.value.trim())) {
    markError(emailInput);
    emailMsg.textContent = "Email inválido";
    emailMsg.className = "field-msg err";
    ok = false;
  }

  // Responsável 2 — obrigatórios: nome, CPF, telefone
  const required2 = ["resp2-nome", "resp2-cpf", "resp2-telefone"];
  required2.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { markError(el); ok = false; }
    else clearError(el);
  });

  // CPF — Responsável 2
  const cpf2Input = document.getElementById("resp2-cpf");
  const cpf2Msg = document.getElementById("cpf2-msg");
  if (cpf2Input.value.trim() && !isValidCpf(cpf2Input.value)) {
    markError(cpf2Input);
    cpf2Msg.textContent = "CPF inválido";
    cpf2Msg.className = "field-msg err";
    ok = false;
  }

  // Email — Responsável 2 (opcional, mas valida se preenchido)
  const email2Input = document.getElementById("resp2-email");
  const email2Msg = document.getElementById("email2-msg");
  if (email2Input.value.trim() && !isValidEmail(email2Input.value.trim())) {
    markError(email2Input);
    email2Msg.textContent = "Email inválido";
    email2Msg.className = "field-msg err";
    ok = false;
  }

  const concordoEl = document.getElementById("concordo-desistencia");
  if (!concordoEl.checked) {
    markGroupError(concordoEl.closest(".form-group"));
    ok = false;
  } else {
    clearGroupError(concordoEl.closest(".form-group"));
  }

  // Validar cada criança
  const blocos = document.querySelectorAll(".child-block");
  if (blocos.length === 0) { alert("Adicione pelo menos uma criança."); return false; }

  blocos.forEach(block => {
    const reqFields = ["c-nome", "c-nascimento", "c-escola", "c-ano-escolar",
                       "c-rg", "c-cpf", "c-convenio", "c-num-convenio"];
    reqFields.forEach(cls => {
      const el = block.querySelector(`.${cls}`);
      if (el && !el.value.trim()) { markError(el); ok = false; }
      else if (el) clearError(el);
    });

    const cpfEl = block.querySelector(".c-cpf");
    if (cpfEl && cpfEl.value.trim() && !isValidCpf(cpfEl.value)) {
      markError(cpfEl);
      ok = false;
    }

    // Radios obrigatórios
    const nadarGroup = block.querySelector(".c-nadar").closest(".form-group");
    if (!block.querySelector(".c-nadar:checked")) {
      markGroupError(nadarGroup); ok = false;
    } else clearGroupError(nadarGroup);

    const belicheGroup = block.querySelector(".c-beliche").closest(".form-group");
    if (!block.querySelector(".c-beliche:checked")) {
      markGroupError(belicheGroup); ok = false;
    } else clearGroupError(belicheGroup);

    const imagemGroup = block.querySelector(".c-uso-imagem").closest(".form-group");
    if (!block.querySelector(".c-uso-imagem:checked")) {
      markGroupError(imagemGroup); ok = false;
    } else clearGroupError(imagemGroup);

    // Autorizo participação
    const participacaoEl = block.querySelector(".c-autorizo-participacao");
    if (!participacaoEl.checked) {
      markGroupError(participacaoEl.closest(".form-group")); ok = false;
    } else clearGroupError(participacaoEl.closest(".form-group"));
  });

  if (!ok) scrollToFirstError();
  return ok;
}

function validateStep2() {
  const pagamentoGroup = document.getElementById("pagamento-group");
  if (!pagamentoTipo) {
    markGroupError(pagamentoGroup);
    scrollToFirstError();
    return false;
  }
  clearGroupError(pagamentoGroup);
  return true;
}

function markError(el) { el.classList.add("error"); el.classList.remove("valid"); }
function clearError(el) { el.classList.remove("error"); el.classList.add("valid"); }
function markGroupError(groupEl) { groupEl.classList.add("error"); }
function clearGroupError(groupEl) { groupEl.classList.remove("error"); }

function scrollToFirstError() {
  const firstError = document.querySelector(".error");
  if (!firstError) return;
  firstError.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = firstError.matches("input, select, textarea")
    ? firstError
    : firstError.querySelector("input, select, textarea");
  if (focusable) focusable.focus({ preventScroll: true });
}

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
    cep: v("resp-cep"),
    endereco: v("resp-endereco"),
    numero: v("resp-numero"),
    complemento: v("resp-complemento"),
    bairro: v("resp-bairro"),
    cidade: v("resp-cidade"),
    estado: v("resp-estado"),
  };

  const responsavel2 = {
    nome: v("resp2-nome"),
    cpf: v("resp2-cpf"),
    email: v("resp2-email"),
    telefone: v("resp2-telefone").replace(/\D/g, ""),
  };

  const blocos = document.querySelectorAll(".child-block");
  const criancasData = Array.from(blocos).map(block => ({
    nome: qv(block, ".c-nome"),
    dataNascimento: qv(block, ".c-nascimento"),
    escola: qv(block, ".c-escola"),
    anoEscolar: qv(block, ".c-ano-escolar"),
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
    responsavel2,
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

  showLoading();

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

const LOADING_MESSAGES = [
  "Criando sua inscrição…",
  "Isso pode levar alguns segundos, já já fica pronto.",
  "Estamos gerando o link de pagamento para você…",
];

let loadingInterval = null;

function showLoading() {
  let idx = 0;
  const el = document.getElementById("overlayText");
  el.textContent = LOADING_MESSAGES[0];
  document.getElementById("loadingOverlay").classList.add("visible");
  loadingInterval = setInterval(() => {
    idx = (idx + 1) % LOADING_MESSAGES.length;
    el.textContent = LOADING_MESSAGES[idx];
  }, 7000);
}

function hideLoading() {
  clearInterval(loadingInterval);
  loadingInterval = null;
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
