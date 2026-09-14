// T-Rec Social Radar — painel de seguidores + média de views dos clientes
// (Instagram, TikTok, YouTube, Facebook). Firebase só guarda config de
// clientes + histórico; quem fala com a Apify é a function da Vercel
// (api/scrape.js), que é a única que conhece o APIFY_TOKEN.

// Senha simples compartilhada (Biel + Duda) — não é criptografia de verdade,
// é só um filtro contra quem achar a URL por acaso. Troque antes de mandar o
// link pra Duda. Fica salva no localStorage do navegador depois da 1a vez.
const SENHA_ACESSO = "Tatiane42@";
const CHAVE_LOCALSTORAGE = "trec-social-radar-acesso";

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
    tarefas: [],
  },
  rique: {
    nome: "Rique (@iairique)",
    redes: {
      instagram: { handle: "iairique", ativo: true },
      tiktok: { handle: "", ativo: false },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  marco: {
    nome: "Marco (@iaimarco_)",
    redes: {
      instagram: { handle: "iaimarco_", ativo: true },
      tiktok: { handle: "", ativo: false },
      youtube: { handle: "", ativo: false },
      facebook: { handle: "", ativo: false },
    },
    tarefas: [],
  },
  "marcella-ferreira": {
    nome: "Marcella Ferreira",
    redes: {
      instagram: { handle: "marcellaferreira", ativo: true },
      tiktok: { handle: "", ativo: false },
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
  if (!docRef) {
    alert("Não deu pra salvar: o Firebase ainda não foi configurado nesse painel (veja o README.md do projeto — falta preencher firebase-config.js).");
    throw new Error("Firebase não configurado");
  }
  try {
    await docRef.set(estado);
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

function cardCliente(clienteId, cliente) {
  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card__header";
  header.innerHTML = `<h3>${cliente.nome}</h3>`;
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
      mediaViews: data.mediaViews,
      postsNoPeriodo: data.postsNoPeriodo,
      periodoDias: data.periodoDias,
      topPosts: data.topPosts || [],
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

function abrirRelatorio(clienteId) {
  const cliente = estado.clientes[clienteId];
  const modal = $("#modal-relatorio");
  modal.hidden = false;
  $("#relatorio-titulo").textContent = `Relatório — ${cliente.nome}`;
  $("#relatorio-inicio").value = diasAtras(periodoSelecionado);
  $("#relatorio-fim").value = hoje();
  $("#relatorio-conteudo").innerHTML = `<p class="vazio">Escolha o período e clique em "Montar relatório".</p>`;
  $("#relatorio-ia").innerHTML = "";

  $("#btn-montar-relatorio").onclick = () => montarRelatorio(clienteId);
  $("#btn-gerar-ia").onclick = () => gerarResumoIA(clienteId);
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
        <div class="top-post">
          ${p.thumb ? `<img src="${p.thumb}" alt="" />` : ""}
          <div>
            <b>#${i + 1}</b> — ${fmtNum(p.views)} views, ${fmtNum(p.likes)} likes<br/>
            <span class="rede-handle">${(p.legenda || "").slice(0, 90)}</span>
            ${p.url ? `<br/><a href="${p.url}" target="_blank" rel="noopener">ver post</a>` : ""}
          </div>
        </div>`
        )
        .join("");
      return `
      <div class="relatorio-rede">
        <h4 style="color:${rede.cor}">${rede.label}</h4>
        <p><b class="mono">${fmtNum(ultimo.seguidores)}</b> seguidores · <b class="mono">${fmtNum(ultimo.mediaViews)}</b> views médias/post (${ultimo.postsNoPeriodo} posts, últimos ${ultimo.periodoDias} dias)</p>
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

  $("#relatorio-conteudo").innerHTML = `
    <p class="mono" style="color:var(--muted)">${new Date(inicio).toLocaleDateString("pt-BR")} — ${new Date(fim).toLocaleDateString("pt-BR")}</p>
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
$("#btn-imprimir-relatorio").onclick = () => window.print();
