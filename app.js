// T-Rec Social Radar — painel de seguidores + média de views dos clientes
// (Instagram, TikTok, YouTube, Facebook). Firebase só guarda config de
// clientes + histórico; quem fala com a Apify é a function da Vercel
// (api/scrape.js), que é a única que conhece o APIFY_TOKEN.

// Senha simples compartilhada (Biel + Duda) — não é criptografia de verdade,
// é só um filtro contra quem achar a URL por acaso. Troque antes de mandar o
// link pra Duda. Fica salva no localStorage do navegador depois da 1a vez.
const SENHA_ACESSO = "Tatiane42@";
const CHAVE_LOCALSTORAGE = "trec-social-radar-acesso";

// Cores escolhidas pra ficarem legíveis em cima de fundo escuro (a marca
// de cada rede, mas ajustada pro contraste — TikTok era quase preto sobre
// preto, por exemplo).
const REDES = [
  { id: "instagram", label: "Instagram", cor: "#ED703A" },
  { id: "tiktok", label: "TikTok", cor: "#25F4EE" },
  { id: "youtube", label: "YouTube", cor: "#FF4B4B" },
  { id: "facebook", label: "Facebook", cor: "#4E9AF1" },
];

const COR_ALTA = "#3ECF6E";
const COR_BAIXA = "#F14E4E";

function setaVariacao(variacao) {
  if (variacao === null || variacao === undefined) return "";
  const cor = variacao >= 0 ? COR_ALTA : COR_BAIXA;
  const seta = variacao >= 0 ? "▲" : "▼";
  return ` <span style="color:${cor}; font-weight:700;">${seta} ${Math.abs(variacao)}%</span>`;
}

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 14, label: "14 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 60, label: "60 dias" },
];

// Identidade visual de cada marca, pra tela do cliente ficar com a cara dele
// (paletas achadas no cérebro — cada uma vem de um doc/HTML já existente).
const TEMAS = {
  beto: {
    bg: "#0B1F33", fg: "#F5F8FA", accent: "#5DBB46", accent2: "#E8B84B",
    fontDisplay: "Anton", fontBody: "Poppins",
  },
  pique: {
    bg: "#0B2028", fg: "#F5F8FA", accent: "#EFA54D", accent2: "#ED703A",
    fontDisplay: "Anton", fontBody: "Archivo Narrow",
  },
  yabadoo: {
    bg: "#080614", fg: "#F4F0FF", accent: "#FFC107", accent2: "#5A33C9",
    fontDisplay: "Baloo 2", fontBody: "DM Sans",
  },
  marcella: {
    bg: "#FDFCFA", fg: "#211318", accent: "#ED4093", accent2: "#5C1F4E",
    fontDisplay: "Playfair Display", fontBody: "Poppins",
  },
  trec: {
    bg: "#141110", fg: "#F2E6C9", accent: "#ED703A", accent2: "#2B6F6A",
    fontDisplay: "Anton", fontBody: "Archivo Narrow",
  },
};

const CLIENTES_PADRAO = {
  "beto-carvalho": {
    nome: "Beto Carvalho",
    temaId: "beto",
    redes: {
      instagram: { handle: "betocarvalhoo", ativo: true },
      tiktok: { handle: "betocarvalhoagro", ativo: true },
      youtube: { handle: "BETOCARVALHOo", ativo: true },
      facebook: { handle: "profile.php?id=100068293766977", ativo: true },
    },
    tarefas: [],
  },
  rique: {
    nome: "Rique (@iairique)",
    temaId: "pique",
    redes: {
      instagram: { handle: "iairique", ativo: true },
      tiktok: { handle: "iairique", ativo: true },
      youtube: { handle: "iairique", ativo: true },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  marco: {
    nome: "Marco (@iaimarco_)",
    temaId: "pique",
    redes: {
      instagram: { handle: "iaimarco_", ativo: true },
      tiktok: { handle: "iaimarco", ativo: true },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  "marcella-ferreira": {
    nome: "Marcella Ferreira",
    temaId: "marcella",
    redes: {
      instagram: { handle: "marcellaferreira", ativo: true },
      tiktok: { handle: "marcelladobeco", ativo: true },
      youtube: { handle: "marcellaferreira", ativo: true },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  yabadoo: {
    nome: "Yabadoo (@yabadoo.io)",
    temaId: "yabadoo",
    redes: {
      instagram: { handle: "yabadoo.io", ativo: true },
      tiktok: { handle: "yabadoo", ativo: true },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  pique: {
    nome: "Pique (@iaipique)",
    temaId: "pique",
    redes: {
      instagram: { handle: "iaipique", ativo: true },
      tiktok: { handle: "", ativo: false },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  "trec-studio": {
    nome: "T-Rec Studio (@t_recstudio)",
    temaId: "trec",
    redes: {
      instagram: { handle: "t_recstudio", ativo: true },
      tiktok: { handle: "", ativo: false }, // ainda vai gravar, adicionar handle quando tiver
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
};

let estado = { clientes: {}, ultimos: {}, historico: [] };
let periodoSelecionado = 30;
let selecionados = new Set(); // chaves "clienteId::network"
let carregando = new Set();
let custoRodada = 0;

const $ = (sel) => document.querySelector(sel);
const fmtNum = (n) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR"));
const fmtUsd = (n) => `$${n.toFixed(3)}`;
const chave = (c, r) => `${c}::${r}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function liberarAcesso() {
  $("#tela-login").hidden = true;
  $("#app").hidden = false;
}

function checarSenha() {
  if (localStorage.getItem(CHAVE_LOCALSTORAGE) === "ok") {
    liberarAcesso();
    return true;
  }
  return false;
}

// A senha funciona mesmo se o Firebase abaixo estiver mal configurado ainda
// (o form é vinculado antes de qualquer chamada ao Firebase, de propósito).
$("#form-senha").onsubmit = (e) => {
  e.preventDefault();
  const valor = $("#input-senha").value;
  if (valor === SENHA_ACESSO) {
    localStorage.setItem(CHAVE_LOCALSTORAGE, "ok");
    localStorage.removeItem(CHAVE_LOCALSTORAGE + "-motivo");
    liberarAcesso();
  } else {
    $("#erro-senha").hidden = false;
  }
};
checarSenha();

// --- Firebase (config + auth anônimo) ---
// Tudo isolado num try/catch: se o Firebase ainda não foi configurado
// (firebase-config.js com valores vazios) ou a chave for inválida, isso NÃO
// pode travar o resto do script — senão nem a senha funciona.
let auth, db, docRef;
try {
  firebase.initializeApp(window.FIREBASE_CONFIG);
  auth = firebase.auth();
  db = firebase.firestore();
  docRef = db.collection("trec-social-radar").doc("dados");

  // Login invisível: sem tela, sem conta Google — só pra regra do Firestore
  // não ficar 100% aberta pra qualquer bot que ache a URL.
  auth.signInAnonymously().catch((e) => {
    console.error("Falha no login anônimo (Firebase configurado?):", e);
    mostrarAvisoFirebase();
  });

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    await carregarEstado();
    render();
    checarSenha();
  });
} catch (e) {
  console.error("Firebase não inicializou (config ainda vazia em firebase-config.js?):", e);
  mostrarAvisoFirebase();
}

function mostrarAvisoFirebase() {
  if ($("#aviso-firebase")) return;
  const aviso = document.createElement("p");
  aviso.id = "aviso-firebase";
  aviso.style.cssText = "color: var(--vermelho); font-size: 12px; margin-top: 16px; max-width: 320px;";
  aviso.textContent = "Firebase ainda não configurado (firebase-config.js) — a senha funciona, mas os dados não vão carregar/salvar até isso ser preenchido.";
  $("#tela-login").appendChild(aviso);
}

// "ultimos" (que carrega fotos em base64) NÃO fica dentro do documento
// único — um documento do Firestore tem limite de 1MB, e só as fotos de
// todos os clientes juntos já estouram isso fácil. Cada rede de cada
// cliente vira um documento próprio (bem pequeno) na coleção
// trec-social-radar-ultimos, então o crescimento é "pra fora" (mais
// documentos), não "pra cima" (um documento cada vez maior).
const ultimosCollRef = () => db.collection("trec-social-radar-ultimos");

async function carregarEstado() {
  const snap = await docRef.get();
  if (snap.exists) {
    estado = Object.assign({ clientes: {}, historico: [] }, snap.data());
  } else {
    estado = { clientes: CLIENTES_PADRAO, historico: [] };
    await docRef.set(estado);
  }
  estado.ultimos = {};
  const ultimosSnap = await ultimosCollRef().get();
  ultimosSnap.forEach((doc) => {
    estado.ultimos[doc.id] = doc.data();
  });
}

async function salvarUltimo(k, dados) {
  await ultimosCollRef().doc(k).set(dados);
}

async function salvarEstado() {
  if (!docRef) {
    alert("Não deu pra salvar: o Firebase ainda não foi configurado nesse painel (veja o README.md do projeto — falta preencher firebase-config.js).");
    throw new Error("Firebase não configurado");
  }
  try {
    await docRef.set({ clientes: estado.clientes, historico: estado.historico });
  } catch (e) {
    alert("Não deu pra salvar: " + e.message);
    throw e;
  }
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

function avatarDoCliente(clienteId) {
  for (const rede of REDES) {
    const foto = estado.ultimos[chave(clienteId, rede.id)]?.fotoPerfil;
    if (foto) return foto;
  }
  return null;
}

function resumoViewsCliente(clienteId) {
  const cliente = estado.clientes[clienteId];
  let total = 0;
  let totalAnterior = 0;
  let temDado = false;
  REDES.forEach((rede) => {
    const u = estado.ultimos[chave(clienteId, rede.id)];
    if (!u || u.totalViewsPeriodo === null || u.totalViewsPeriodo === undefined) return;
    temDado = true;
    total += u.totalViewsPeriodo;
    if (u.variacaoViews !== null && u.variacaoViews !== undefined) {
      totalAnterior += u.totalViewsPeriodo / (1 + u.variacaoViews / 100);
    }
  });
  if (!temDado) return null;
  const variacao = totalAnterior > 0 ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : null;
  return { total, variacao };
}

function cardCliente(clienteId, cliente) {
  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card__header";
  const avatar = avatarDoCliente(clienteId);
  const resumo = resumoViewsCliente(clienteId);
  header.innerHTML = `
    <div class="card__identidade" style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Ver dashboard completo">
      ${avatar ? `<img src="${avatar}" class="avatar-cliente" referrerpolicy="no-referrer" alt="" />` : `<div class="avatar-cliente avatar-cliente--vazio"></div>`}
      <div>
        <h3 style="margin:0;">${cliente.nome}</h3>
        ${resumo ? `<span class="card__resumo-views"><b>${fmtNum(resumo.total)}</b> views no período${setaVariacao(resumo.variacao)}</span>` : ""}
      </div>
    </div>
  `;
  header.querySelector(".card__identidade").onclick = () => abrirRelatorio(clienteId);
  const acoes = document.createElement("div");
  acoes.style.display = "flex";
  acoes.style.gap = "10px";
  const btnRelatorio = document.createElement("button");
  btnRelatorio.className = "icon-btn";
  btnRelatorio.textContent = "relatório";
  btnRelatorio.onclick = () => abrirRelatorio(clienteId);
  const btnEditar = document.createElement("button");
  btnEditar.className = "icon-btn";
  btnEditar.textContent = "editar";
  btnEditar.onclick = () => abrirModalCliente(clienteId);
  acoes.appendChild(btnRelatorio);
  acoes.appendChild(btnEditar);
  header.appendChild(acoes);
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
              ${ultimo.seguindo !== null && ultimo.seguindo !== undefined ? ` · <b>${fmtNum(ultimo.seguindo)}</b> seguindo` : ""}
              ${
                ultimo.totalViewsPeriodo !== null && ultimo.totalViewsPeriodo !== undefined
                  ? ` · <b>${fmtNum(ultimo.totalViewsPeriodo)}</b> views no período${setaVariacao(ultimo.variacaoViews)}`
                  : ""
              }
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
  card.appendChild(blocoTarefas(clienteId, cliente));
  return card;
}

// --- Tarefas pendentes por cliente ---

function blocoTarefas(clienteId, cliente) {
  const wrap = document.createElement("div");
  wrap.className = "tarefas";

  const tarefas = cliente.tarefas || [];
  const lista = document.createElement("div");
  lista.className = "tarefas__lista";
  tarefas
    .slice()
    .sort((a, b) => Number(a.feita) - Number(b.feita))
    .forEach((t) => {
      const linha = document.createElement("label");
      linha.className = "tarefa-item" + (t.feita ? " tarefa-item--feita" : "");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!t.feita;
      chk.onchange = async () => {
        t.feita = chk.checked;
        await salvarEstado();
        render();
      };
      const texto = document.createElement("span");
      texto.textContent = t.texto;
      const del = document.createElement("button");
      del.className = "icon-btn";
      del.textContent = "×";
      del.onclick = async (e) => {
        e.preventDefault();
        cliente.tarefas = tarefas.filter((x) => x.id !== t.id);
        await salvarEstado();
        render();
      };
      linha.appendChild(chk);
      linha.appendChild(texto);
      linha.appendChild(del);
      lista.appendChild(linha);
    });

  const form = document.createElement("form");
  form.className = "tarefas__form";
  form.innerHTML = `<input type="text" placeholder="+ nova tarefa pendente..." />`;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const texto = input.value.trim();
    if (!texto) return;
    if (!cliente.tarefas) cliente.tarefas = [];
    cliente.tarefas.push({ id: Date.now().toString(36), texto, feita: false, criadoEm: new Date().toISOString() });
    input.value = "";
    await salvarEstado();
    render();
  };

  wrap.appendChild(lista);
  wrap.appendChild(form);
  return wrap;
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
      seguindo: data.seguindo,
      fotoPerfil: data.fotoPerfil,
      mediaViews: data.mediaViews,
      totalViewsPeriodo: data.totalViewsPeriodo,
      variacaoViews: data.variacaoViews,
      postsNoPeriodo: data.postsNoPeriodo,
      periodoDias: data.periodoDias,
      topPosts: data.topPosts || [],
      atualizadoEm: data.atualizadoEm,
    };
    // salva na hora, num documento so dessa rede — nao espera o fim do lote
    // (cada documento fica pequeno assim, mesmo com muitos clientes juntos)
    await salvarUltimo(k, estado.ultimos[k]);
    // guarda so os numeros no historico (nao a foto/topPosts) pra nao inchar o documento
    estado.historico.push({
      clienteId,
      network,
      seguidores: data.seguidores,
      seguindo: data.seguindo,
      mediaViews: data.mediaViews,
      totalViewsPeriodo: data.totalViewsPeriodo,
      variacaoViews: data.variacaoViews,
      postsNoPeriodo: data.postsNoPeriodo,
      periodoDias: data.periodoDias,
      atualizadoEm: data.atualizadoEm,
    });
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
    estado.clientes[id] = { nome, redes, tarefas: cliente.tarefas || [] };
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

// --- Relatório de performance (pra apresentar ao cliente) ---

function aplicarTema(clienteId) {
  const el = $("#modal-relatorio");
  const tema = TEMAS[estado.clientes[clienteId]?.temaId];
  if (!tema) {
    el.style.cssText = "";
    return;
  }
  el.style.setProperty("--tema-bg", tema.bg);
  el.style.setProperty("--tema-fg", tema.fg);
  el.style.setProperty("--tema-accent", tema.accent);
  el.style.setProperty("--tema-accent2", tema.accent2);
  el.style.setProperty("--tema-font-display", `'${tema.fontDisplay}'`);
  el.style.setProperty("--tema-font-body", `'${tema.fontBody}'`);
}

function abrirRelatorio(clienteId) {
  const cliente = estado.clientes[clienteId];
  const modal = $("#modal-relatorio");
  modal.hidden = false;
  aplicarTema(clienteId);
  const avatar = avatarDoCliente(clienteId);
  $("#relatorio-titulo").innerHTML = `${avatar ? `<img src="${avatar}" referrerpolicy="no-referrer" class="avatar-cliente" style="width:32px;height:32px;vertical-align:middle;margin-right:8px;" alt="" />` : ""}${cliente.nome}`;
  $("#relatorio-inicio").value = diasAtras(periodoSelecionado);
  $("#relatorio-fim").value = hoje();
  $("#relatorio-ia").innerHTML = "";

  $("#btn-montar-relatorio").onclick = () => montarRelatorio(clienteId);
  $("#btn-gerar-ia").onclick = () => gerarResumoIA(clienteId);

  montarRelatorio(clienteId); // já mostra o dashboard direto, sem precisar clicar em nada
}

function montarRelatorio(clienteId) {
  const cliente = estado.clientes[clienteId];
  const inicio = $("#relatorio-inicio").value;
  const fim = $("#relatorio-fim").value;
  const inicioMs = new Date(inicio).getTime();
  const fimMs = new Date(fim).getTime() + 86400000;

  const redesAtivas = REDES.filter((r) => cliente.redes?.[r.id]?.ativo);
  const blocosRede = redesAtivas
    .map((rede) => {
      const ultimo = estado.ultimos[chave(clienteId, rede.id)];
      if (!ultimo) return `<div class="relatorio-rede"><h4 style="color:${rede.cor}">${rede.label}</h4><p class="vazio">Sem dado atualizado. Clique em "Atualizar" no painel antes de gerar o relatório.</p></div>`;
      const top = (ultimo.topPosts || [])
        .map(
          (p, i) => `
        <div class="top-post${i === 0 ? " top-post--melhor" : ""}">
          ${p.thumb ? `<img src="${p.thumb}" referrerpolicy="no-referrer" alt="" />` : ""}
          <div>
            <b>${i === 0 ? "🏆 Melhor do período" : `#${i + 1}`}</b> — ${fmtNum(p.views)} views, ${fmtNum(p.likes)} likes<br/>
            <span class="rede-handle">${(p.legenda || "").slice(0, 90)}</span>
            ${p.url ? `<br/><a href="${p.url}" target="_blank" rel="noopener">ver post</a>` : ""}
          </div>
        </div>`
        )
        .join("");
      return `
      <div class="relatorio-rede">
        <h4 style="color:${rede.cor}">
          ${ultimo.fotoPerfil ? `<img src="${ultimo.fotoPerfil}" referrerpolicy="no-referrer" class="avatar-inline" alt="" />` : ""}
          ${rede.label}
        </h4>
        <p><b class="mono">${fmtNum(ultimo.seguidores)}</b> seguidores${ultimo.seguindo !== null && ultimo.seguindo !== undefined ? ` · <b class="mono">${fmtNum(ultimo.seguindo)}</b> seguindo` : ""} · <b class="mono">${fmtNum(ultimo.mediaViews)}</b> views médias/post (${ultimo.postsNoPeriodo} posts, últimos ${ultimo.periodoDias} dias)</p>
        ${top ? `<div class="top-posts">${top}</div>` : ""}
      </div>`;
    })
    .join("");

  const tarefas = cliente.tarefas || [];
  const noRange = (t) => {
    const d = new Date(t.criadoEm).getTime();
    return d >= inicioMs && d <= fimMs;
  };
  const feitas = tarefas.filter((t) => t.feita && noRange(t));
  const pendentes = tarefas.filter((t) => !t.feita);

  // resumo em destaque: soma de seguidores + o post que mais performou entre TODAS as redes
  const todosOsUltimos = redesAtivas.map((r) => estado.ultimos[chave(clienteId, r.id)]).filter(Boolean);
  const somaSeguidores = todosOsUltimos.reduce((acc, u) => acc + (u.seguidores || 0), 0);
  let melhorGeral = null;
  todosOsUltimos.forEach((u, i) => {
    const top1 = (u.topPosts || [])[0];
    if (top1 && (!melhorGeral || top1.views > melhorGeral.post.views)) {
      melhorGeral = { post: top1, rede: redesAtivas[i] };
    }
  });

  const resumo = `
    <div class="resumo-numeros">
      <div class="resumo-numero"><span class="resumo-valor">${fmtNum(somaSeguidores)}</span><span class="resumo-label">seguidores (todas as redes)</span></div>
      ${
        melhorGeral
          ? `<div class="resumo-numero"><span class="resumo-valor" style="color:var(--mostarda)">${fmtNum(melhorGeral.post.views)}</span><span class="resumo-label">views no melhor vídeo (${melhorGeral.rede.label})</span></div>`
          : ""
      }
    </div>
  `;

  $("#relatorio-conteudo").innerHTML = `
    <p class="mono" style="color:var(--muted)">${new Date(inicio).toLocaleDateString("pt-BR")} — ${new Date(fim).toLocaleDateString("pt-BR")}</p>
    ${resumo}
    ${blocosRede}
    <div class="relatorio-tarefas">
      <h4>Tarefas concluídas no período</h4>
      ${feitas.length ? `<ul>${feitas.map((t) => `<li>${t.texto}</li>`).join("")}</ul>` : `<p class="vazio">Nenhuma no período.</p>`}
      <h4>Pendentes (todas)</h4>
      ${pendentes.length ? `<ul>${pendentes.map((t) => `<li>${t.texto}</li>`).join("")}</ul>` : `<p class="vazio">Nenhuma pendente.</p>`}
    </div>
  `;
}

async function gerarResumoIA(clienteId) {
  const cliente = estado.clientes[clienteId];
  const inicio = $("#relatorio-inicio").value;
  const fim = $("#relatorio-fim").value;
  const redesAtivas = REDES.filter((r) => cliente.redes?.[r.id]?.ativo);

  const redes = {};
  redesAtivas.forEach((r) => {
    const ultimo = estado.ultimos[chave(clienteId, r.id)];
    if (ultimo) redes[r.id] = ultimo;
  });

  const tarefas = cliente.tarefas || [];
  const inicioMs = new Date(inicio).getTime();
  const fimMs = new Date(fim).getTime() + 86400000;
  const feitas = tarefas.filter((t) => t.feita && new Date(t.criadoEm).getTime() >= inicioMs && new Date(t.criadoEm).getTime() <= fimMs);
  const pendentes = tarefas.filter((t) => !t.feita);

  $("#relatorio-ia").innerHTML = `<p class="vazio">Gerando resumo com IA…</p>`;
  try {
    const resp = await fetch(window.RELATORIO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente: { nome: cliente.nome },
        periodo: { inicio, fim },
        redes,
        tarefas: { feitas, pendentes },
      }),
    });
    const data = await resp.json();
    if (!data.ok) {
      $("#relatorio-ia").innerHTML = `<p class="vazio">IA indisponível: ${data.error}</p>`;
      return;
    }
    $("#relatorio-ia").innerHTML = `<h4>Resumo</h4><div class="resumo-ia">${data.resumo.replace(/\n/g, "<br/>")}</div>`;
  } catch (err) {
    $("#relatorio-ia").innerHTML = `<p class="vazio">Erro chamando a IA: ${err.message}</p>`;
  }
}

// --- Dino, o assistente ---

let dinoHistorico = [];

function contextoParaDino() {
  const resumo = {};
  Object.entries(estado.clientes).forEach(([id, cliente]) => {
    resumo[cliente.nome] = {};
    REDES.forEach((rede) => {
      const ultimo = estado.ultimos[chave(id, rede.id)];
      if (!ultimo) return;
      resumo[cliente.nome][rede.label] = {
        seguidores: ultimo.seguidores,
        seguindo: ultimo.seguindo,
        mediaViews: ultimo.mediaViews,
        atualizadoEm: ultimo.atualizadoEm,
        melhorPost: ultimo.topPosts?.[0]
          ? { views: ultimo.topPosts[0].views, likes: ultimo.topPosts[0].likes, legenda: ultimo.topPosts[0].legenda, url: ultimo.topPosts[0].url }
          : null,
      };
    });
  });
  return resumo;
}

function addMensagemDino(texto, autor) {
  const div = document.createElement("div");
  div.className = "dino-msg " + (autor === "usuario" ? "dino-msg--usuario" : "dino-msg--dino");
  div.textContent = texto;
  $("#dino-mensagens").appendChild(div);
  $("#dino-mensagens").scrollTop = $("#dino-mensagens").scrollHeight;
}

async function perguntarDino(pergunta) {
  addMensagemDino(pergunta, "usuario");
  dinoHistorico.push({ role: "user", content: pergunta });
  addMensagemDino("pensando…", "dino");
  const bolhaCarregando = $("#dino-mensagens").lastChild;

  try {
    const resp = await fetch(window.DINO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta, contexto: contextoParaDino(), historico: dinoHistorico.slice(0, -1) }),
    });
    const data = await resp.json();
    bolhaCarregando.remove();
    if (!data.ok) {
      addMensagemDino(`Não consegui responder: ${data.error}`, "dino");
      return;
    }
    addMensagemDino(data.resposta, "dino");
    dinoHistorico.push({ role: "assistant", content: data.resposta });
  } catch (err) {
    bolhaCarregando.remove();
    addMensagemDino(`Erro: ${err.message}`, "dino");
  }
}

$("#btn-dino").onclick = () => {
  $("#painel-dino").hidden = !$("#painel-dino").hidden;
  if (!$("#painel-dino").hidden && !$("#dino-mensagens").children.length) {
    addMensagemDino("Oi! Eu sou o Dino 🦖 Pergunta algo tipo \"qual o melhor vídeo do Beto Carvalho\" ou \"quantos seguidores a Marcella tem no TikTok\".", "dino");
  }
};
$("#btn-fechar-dino").onclick = () => ($("#painel-dino").hidden = true);
$("#form-dino").onsubmit = (e) => {
  e.preventDefault();
  const input = $("#input-dino");
  const pergunta = input.value.trim();
  if (!pergunta) return;
  input.value = "";
  perguntarDino(pergunta);
};

$("#btn-logout").onclick = () => {
  localStorage.removeItem(CHAVE_LOCALSTORAGE);
  location.reload();
};
$("#btn-atualizar").onclick = atualizarSelecionados;
$("#btn-marcar-todos").onclick = () => marcarTodos(true);
$("#btn-desmarcar-todos").onclick = () => marcarTodos(false);
$("#btn-novo-cliente").onclick = () => abrirModalCliente(null);
$("#btn-fechar-modal").onclick = () => ($("#modal-cliente").hidden = true);
$("#btn-fechar-relatorio").onclick = () => ($("#modal-relatorio").hidden = true);
$("#btn-voltar-cliente").onclick = () => ($("#modal-relatorio").hidden = true);
$("#btn-imprimir-relatorio").onclick = () => window.print();

// --- Configurações (chaves de API) ---
// Escreve num documento que a regra do Firestore deixa só GRAVAR, nunca ler
// de volta pelo cliente — assim a chave não fica exposta pra quem abrir o
// devtools ou olhar esse app.js (que é público). Quem lê de verdade é a
// function da Vercel, usando Admin SDK server-side.
const configDocRef = () => db.collection("trec-social-radar-config").doc("chaves");

// Se colar a URL inteira da Apify (jeito que já rolou antes: "https://api.
// apify.com/v2/actors?token=apify_api_...") em vez de só o token, extrai só
// o token — evita salvar lixo sem querer.
function limparValorChave(valor) {
  const v = valor.trim();
  const match = v.match(/token=([^&\s]+)/);
  return match ? match[1] : v;
}

// Confere se um valor "parece" ser o tipo certo de chave antes de salvar —
// pega o caso (já aconteceu) do navegador autopreencher com a senha do
// site em vez do token de verdade.
function pareceChaveValida(nomeCampo, valor) {
  if (nomeCampo.startsWith("APIFY_TOKEN")) return valor.startsWith("apify_api_");
  if (nomeCampo === "OPENAI_API_KEY") return valor.startsWith("sk-");
  if (nomeCampo === "ANTHROPIC_API_KEY") return valor.startsWith("sk-ant-");
  return true;
}

async function atualizarStatusConfig() {
  const nomes = ["APIFY_TOKEN", "APIFY_TOKEN_2", "APIFY_TOKEN_3", "APIFY_TOKEN_4", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
  nomes.forEach((n) => {
    const el = $(`#badge-${n}`);
    el.textContent = "checando…";
    el.className = "badge-config badge-config--vazio";
  });
  try {
    const resp = await fetch(window.CONFIG_STATUS_API_URL);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "falha");
    nomes.forEach((n) => {
      const el = $(`#badge-${n}`);
      if (data.status[n]) {
        el.textContent = "✓ já configurada";
        el.className = "badge-config badge-config--ok";
      } else {
        el.textContent = "não configurada";
        el.className = "badge-config badge-config--vazio";
      }
    });
  } catch (err) {
    nomes.forEach((n) => {
      const el = $(`#badge-${n}`);
      el.textContent = "";
    });
    $("#status-config").textContent = "Não consegui checar o status agora (a function precisa do FIREBASE_SERVICE_ACCOUNT configurado na Vercel pra isso funcionar).";
  }
}

$("#btn-config").onclick = () => {
  $("#modal-config").hidden = false;
  $("#aviso-config").hidden = true;
  $("#status-config").textContent = "";
  atualizarStatusConfig();
};
$("#btn-fechar-config").onclick = () => ($("#modal-config").hidden = true);
$("#form-config").onsubmit = async (e) => {
  e.preventDefault();
  const campos = {
    APIFY_TOKEN: limparValorChave($("#input-apify-1").value),
    APIFY_TOKEN_2: limparValorChave($("#input-apify-2").value),
    APIFY_TOKEN_3: limparValorChave($("#input-apify-3").value),
    APIFY_TOKEN_4: limparValorChave($("#input-apify-4").value),
    OPENAI_API_KEY: limparValorChave($("#input-openai").value),
    ANTHROPIC_API_KEY: limparValorChave($("#input-anthropic").value),
  };
  const preencher = Object.fromEntries(Object.entries(campos).filter(([, v]) => v));
  if (!Object.keys(preencher).length) {
    $("#modal-config").hidden = true;
    return;
  }

  const suspeitos = Object.entries(preencher).filter(([nome, valor]) => !pareceChaveValida(nome, valor));
  const avisoEl = $("#aviso-config");
  if (suspeitos.length) {
    avisoEl.hidden = false;
    avisoEl.textContent = `Isso não parece um valor válido pra ${suspeitos.map(([n]) => n).join(", ")} (confere se não colou a coisa errada por engano). Nada foi salvo ainda — corrige e manda de novo.`;
    return;
  }
  avisoEl.hidden = true;

  try {
    await configDocRef().set(preencher, { merge: true });
    alert("Chaves salvas.");
    $("#form-config").reset();
    $("#modal-config").hidden = true;
  } catch (err) {
    alert("Não deu pra salvar: " + err.message);
  }
};
