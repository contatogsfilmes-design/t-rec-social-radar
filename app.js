// T-Rec Social Radar — painel de seguidores + média de views dos clientes
// (Instagram, TikTok, YouTube, Facebook). Firebase só guarda config de
// clientes + histórico; quem fala com a Apify é a function da Vercel
// (api/scrape.js), que é a única que conhece o APIFY_TOKEN.

const ALLOWED_EMAILS = ["contatogsfilmes@gmail.com"];

const REDES = [
  { id: "instagram", label: "Instagram", cor: "#ED703A" },
  { id: "tiktok", label: "TikTok", cor: "#141110" },
  { id: "youtube", label: "YouTube", cor: "#E5231B" },
  { id: "facebook", label: "Facebook", cor: "#2B6F6A" },
];

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 14, label: "14 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 60, label: "60 dias" },
];

const CLIENTES_PADRAO = {
  "beto-carvalho": {
    nome: "Beto Carvalho",
    redes: {
      instagram: { handle: "betocarvalhoo", ativo: true },
      tiktok: { handle: "betocarvalhoagro", ativo: true },
      youtube: { handle: "BETOCARVALHOo", ativo: true },
      facebook: { handle: "profile.php?id=100068293766977", ativo: true },
    },
  },
  rique: {
    nome: "Rique (@iairique)",
    redes: {
      instagram: { handle: "iairique", ativo: true },
      tiktok: { handle: "", ativo: false },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
  },
  marco: {
    nome: "Marco (@iaimarco_)",
    redes: {
      instagram: { handle: "iaimarco_", ativo: true },
      tiktok: { handle: "", ativo: false },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
  },
  "marcella-ferreira": {
    nome: "Marcella Ferreira",
    redes: {
      instagram: { handle: "marcellaferreira", ativo: true },
      tiktok: { handle: "", ativo: false },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
  },
};

firebase.initializeApp(window.FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
const docRef = db.collection("trec-social-radar").doc("dados");

let estado = { clientes: {}, ultimos: {}, historico: [] };
let periodoSelecionado = 30;
let selecionados = new Set(); // chaves "clienteId::network"
let carregando = new Set();
let custoRodada = 0;

const $ = (sel) => document.querySelector(sel);
const fmtNum = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR"));
const fmtUsd = (n) => `$${n.toFixed(3)}`;
const chave = (c, r) => `${c}::${r}`;

function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((e) => alert("Falha no login: " + e.message));
}

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    $("#tela-login").hidden = false;
    $("#app").hidden = true;
    return;
  }
  if (!ALLOWED_EMAILS.includes(user.email)) {
    alert(`Esse e-mail (${user.email}) não tem acesso a esse painel.`);
    auth.signOut();
    return;
  }
  $("#tela-login").hidden = true;
  $("#app").hidden = false;
  $("#usuario-email").textContent = user.email;
  await carregarEstado();
  render();
});

async function carregarEstado() {
  const snap = await docRef.get();
  if (snap.exists) {
    estado = Object.assign({ clientes: {}, ultimos: {}, historico: [] }, snap.data());
  } else {
    estado = { clientes: CLIENTES_PADRAO, ultimos: {}, historico: [] };
    await docRef.set(estado);
  }
}

async function salvarEstado() {
  await docRef.set(estado);
}

function render() {
  renderPeriodos();
  renderClientes();
  renderResumoCusto();
}

function renderPeriodos() {
  const wrap = $("#periodos");
  wrap.innerHTML = "";
  PERIODOS.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (p.dias === periodoSelecionado ? " chip--ativo" : "");
    btn.textContent = p.label;
    btn.onclick = () => {
      periodoSelecionado = p.dias;
      render();
    };
    wrap.appendChild(btn);
  });
}

function renderResumoCusto() {
  $("#custo-rodada").textContent = custoRodada > 0 ? `Última atualização custou ${fmtUsd(custoRodada)}` : "";
}

function renderClientes() {
  const wrap = $("#clientes");
  wrap.innerHTML = "";
  const ids = Object.keys(estado.clientes);
  if (!ids.length) {
    wrap.innerHTML = `<p class="vazio">Nenhum cliente cadastrado ainda. Clique em "+ Cliente" pra adicionar.</p>`;
    return;
  }
  ids.forEach((clienteId) => {
    wrap.appendChild(cardCliente(clienteId, estado.clientes[clienteId]));
  });
}

function cardCliente(clienteId, cliente) {
  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card__header";
  header.innerHTML = `<h3>${cliente.nome}</h3>`;
  const btnEditar = document.createElement("button");
  btnEditar.className = "icon-btn";
  btnEditar.textContent = "editar";
  btnEditar.onclick = () => abrirModalCliente(clienteId);
  header.appendChild(btnEditar);
  card.appendChild(header);

  const redesWrap = document.createElement("div");
  redesWrap.className = "card__redes";

  REDES.forEach((rede) => {
    const cfg = cliente.redes?.[rede.id];
    if (!cfg || !cfg.handle) return;

    const item = document.createElement("label");
    item.className = "rede-item" + (!cfg.ativo ? " rede-item--inativa" : "");

    const k = chave(clienteId, rede.id);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selecionados.has(k);
    checkbox.disabled = !cfg.ativo;
    checkbox.onchange = () => {
      if (checkbox.checked) selecionados.add(k);
      else selecionados.delete(k);
    };

    const ultimo = estado.ultimos[k];
    const carregandoEsse = carregando.has(k);

    const info = document.createElement("div");
    info.className = "rede-info";
    info.innerHTML = `
      <span class="rede-nome" style="color:${rede.cor}">${rede.label}</span>
      <span class="rede-handle">@${cfg.handle.replace(/^profile\.php.*/, "(perfil)")}</span>
      ${
        carregandoEsse
          ? `<span class="rede-status">atualizando…</span>`
          : ultimo
          ? `<span class="rede-metricas">
              <b>${fmtNum(ultimo.seguidores)}</b> seguidores
              ${ultimo.mediaViews !== null && ultimo.mediaViews !== undefined ? ` · <b>${fmtNum(ultimo.mediaViews)}</b> views médias (${ultimo.postsNoPeriodo} posts/${ultimo.periodoDias}d)` : ""}
              <span class="rede-data">atualizado ${new Date(ultimo.atualizadoEm).toLocaleString("pt-BR")}</span>
             </span>`
          : `<span class="rede-status">ainda não atualizado</span>`
      }
    `;

    item.appendChild(checkbox);
    item.appendChild(info);
    redesWrap.appendChild(item);
  });

  card.appendChild(redesWrap);
  return card;
}

function marcarTodos(marcar) {
  Object.entries(estado.clientes).forEach(([clienteId, cliente]) => {
    REDES.forEach((rede) => {
      const cfg = cliente.redes?.[rede.id];
      if (cfg && cfg.handle && cfg.ativo) {
        const k = chave(clienteId, rede.id);
        if (marcar) selecionados.add(k);
        else selecionados.delete(k);
      }
    });
  });
  render();
}

async function atualizarSelecionados() {
  if (!selecionados.size) {
    alert("Selecione ao menos um cliente/rede pra atualizar.");
    return;
  }
  const btn = $("#btn-atualizar");
  btn.disabled = true;
  custoRodada = 0;

  const itens = Array.from(selecionados);
  carregando = new Set(itens);
  render();

  // roda 3 por vez pra não estourar limite de concorrência da Apify/Vercel
  const LOTE = 3;
  for (let i = 0; i < itens.length; i += LOTE) {
    const lote = itens.slice(i, i + LOTE);
    await Promise.all(lote.map((k) => atualizarUm(k)));
  }

  carregando = new Set();
  btn.disabled = false;
  await salvarEstado();
  render();
}

async function atualizarUm(k) {
  const [clienteId, network] = k.split("::");
  const cfg = estado.clientes[clienteId].redes[network];
  try {
    const resp = await fetch(window.SCRAPE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network, handle: cfg.handle, days: periodoSelecionado }),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Falha desconhecida");

    estado.ultimos[k] = {
      seguidores: data.seguidores,
      mediaViews: data.mediaViews,
      postsNoPeriodo: data.postsNoPeriodo,
      periodoDias: data.periodoDias,
      atualizadoEm: data.atualizadoEm,
    };
    estado.historico.push({ clienteId, network, ...estado.ultimos[k] });
    if (estado.historico.length > 500) estado.historico = estado.historico.slice(-500);
    custoRodada += data.custoEstimadoUsd || 0;
  } catch (err) {
    alert(`Erro atualizando ${clienteId} / ${network}: ${err.message}`);
  } finally {
    carregando.delete(k);
    render();
  }
}

// --- Modal de cliente (criar/editar) ---

function abrirModalCliente(clienteId) {
  const editando = !!clienteId;
  const cliente = editando ? estado.clientes[clienteId] : { nome: "", redes: {} };
  const modal = $("#modal-cliente");
  modal.hidden = false;
  $("#modal-titulo").textContent = editando ? `Editar ${cliente.nome}` : "Novo cliente";
  $("#input-nome").value = cliente.nome || "";
  REDES.forEach((rede) => {
    $(`#input-${rede.id}`).value = cliente.redes?.[rede.id]?.handle || "";
  });
  $("#btn-excluir-cliente").hidden = !editando;

  $("#form-cliente").onsubmit = async (e) => {
    e.preventDefault();
    const nome = $("#input-nome").value.trim();
    if (!nome) return;
    const id = editando ? clienteId : nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const redes = {};
    REDES.forEach((rede) => {
      const handle = $(`#input-${rede.id}`).value.trim().replace(/^@/, "");
      redes[rede.id] = { handle, ativo: !!handle };
    });
    estado.clientes[id] = { nome, redes };
    await salvarEstado();
    modal.hidden = true;
    render();
  };

  $("#btn-excluir-cliente").onclick = async () => {
    if (!confirm(`Remover ${cliente.nome}? Isso não apaga o histórico já salvo.`)) return;
    delete estado.clientes[clienteId];
    await salvarEstado();
    modal.hidden = true;
    render();
  };
}

$("#btn-login").onclick = login;
$("#btn-logout").onclick = () => auth.signOut();
$("#btn-atualizar").onclick = atualizarSelecionados;
$("#btn-marcar-todos").onclick = () => marcarTodos(true);
$("#btn-desmarcar-todos").onclick = () => marcarTodos(false);
$("#btn-novo-cliente").onclick = () => abrirModalCliente(null);
$("#btn-fechar-modal").onclick = () => ($("#modal-cliente").hidden = true);
