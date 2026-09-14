# T-Rec Social Radar

Painel interno pra acompanhar, sob demanda, quantos seguidores e qual a média
de views (no período escolhido) cada cliente tem em Instagram, TikTok,
YouTube e Facebook. Só atualiza quando você clica em "Atualizar" — não fica
rodando sozinho, então só gasta crédito da Apify quando você pedir.

## Arquitetura (e por quê)

- **Frontend** (`index.html` + `app.js`): estático, hospedado no GitHub Pages.
  Mesmo padrão do Financeiro T-Rec / QG Finanças.
- **Firestore**: guarda a lista de clientes (nome + handle por rede) e o
  histórico das atualizações. Plano Spark (grátis, sem cartão de crédito).
- **1 function na Vercel** (`api/scrape.js`): o único lugar que conhece o
  `APIFY_TOKEN`. Recebe `{ network, handle, days }`, chama o ator certo na
  Apify e devolve seguidores + média de views já calculados.

  **Por que não Firebase Functions**: chamar uma API externa (Apify) de
  dentro de uma Cloud Function exige o plano Blaze (cartão de crédito), que é
  o que foi decidido evitar no Financeiro T-Rec. A Vercel roda a mesma coisa
  no plano gratuito, sem pedir cartão.

## Como ficou o custo real (testado com o token da Apify em 14/09/2026)

| Rede | Custo por cliente (~12-30 posts) |
|------|-----------------------------------|
| Instagram | ~$0,003 (perfil + posts vêm juntos) |
| TikTok | ~$0,02–0,06 |
| YouTube | ~$0,02–0,06 |
| Facebook | $0 (só seguidores, sem média de views) |

Atualizar os 4 clientes nas 4 redes de uma vez fica em torno de **$0,30–0,40**.
Com $5 de saldo, dá pra muitas rodadas de uso real (o painel mostra o custo
estimado de cada atualização no topo da tela). Saldo é pré-pago — recarrega
quando quiser em apify.com, sem assinatura.

## Passo a passo pra colocar no ar

### 1. Firebase (guarda os dados — grátis, sem cartão)

1. Criar projeto em [console.firebase.google.com](https://console.firebase.google.com) → nome sugerido `trec-social-radar`.
2. **Firestore Database** → Criar banco de dados → modo produção → escolher região (ex: `southamerica-east1`).
3. **Authentication** → Sign-in method → ativar **Anônimo** (Anonymous).
4. **Configurações do projeto** → Seus apps → Web (`</>`) → registrar app → copiar o objeto de config gerado.
5. Colar esse objeto em `firebase-config.js` (campos `apiKey`, `authDomain`, etc — não é segredo, pode ficar no repo público).
6. **Firestore → Regras** → colar o conteúdo de `firestore.rules` deste projeto → Publicar.

### 2. Vercel (roda a chamada pra Apify — grátis, sem cartão)

1. Subir este projeto pro GitHub primeiro (passo 3).
2. Em [vercel.com](https://vercel.com), importar o repositório.
3. Nas configurações do projeto na Vercel → **Environment Variables** → adicionar `APIFY_TOKEN` com o seu token (o mesmo que já está no `.env` local). Se tiver mais contas Apify, adicionar também `APIFY_TOKEN_2`, `_3`, `_4` — o backend tenta na ordem e pula sozinho pra próxima quando uma ficar sem crédito no mês. Se quiser o resumo em texto gerado por IA no relatório, adicionar também `OPENAI_API_KEY`.
4. Deploy. A Vercel vai gerar uma URL tipo `https://t-rec-social-radar.vercel.app`.
5. Colar essa URL + `/api/scrape` em `firebase-config.js` → `window.SCRAPE_API_URL`.

### 3. GitHub Pages (o site em si)

1. Criar repositório no GitHub (pode ser público — não tem segredo nenhum no frontend).
2. `git remote add origin <url-do-repo>` e dar push.
3. **Settings → Pages** → Source: branch `main`, pasta `/ (root)`.
4. Site fica em `https://<seu-usuario>.github.io/<repo>/`.

Depois de preencher o `firebase-config.js` com os valores reais (passos 1.5 e
2.5), commitar e dar push de novo pra atualizar tanto o GitHub Pages quanto a
Vercel (ela também re-builda a cada push, mesmo não usando o front — sem
problema).

## Uso do dia a dia

1. Abrir o site, digitar a senha de acesso (uma vez por navegador — fica
   salva depois). Ver seção "Acesso" abaixo antes de mandar o link pra Duda.
2. Escolher o período (7/14/30/60 dias).
3. Marcar quais cliente+rede quer atualizar (ou "selecionar todos").
4. Clicar "Atualizar selecionados" — o painel mostra ao vivo o que já
   terminou e o custo estimado da rodada.
5. "+ Cliente" pra cadastrar um novo perfil a qualquer momento.
6. Em cada card: "+ nova tarefa pendente" pra registrar o que falta fazer
   pro cliente; marcar como feita quando concluir.
7. Botão "relatório" no card abre a tela de relatório: escolher data
   início/fim, "Montar relatório" (seguidores, views médias, top 3 posts do
   período, tarefas concluídas/pendentes), "Gerar resumo com IA" (opcional,
   precisa de `OPENAI_API_KEY`) e "Imprimir/Exportar PDF" pra apresentar ao
   cliente.

## Acesso

Sem conta Google, sem tela de "login" de verdade — só um campo de senha
simples (constante `SENHA_ACESSO` no topo de `app.js`), digitada uma vez por
navegador (fica salva no localStorage depois). Por baixo dos panos o app
também faz um login anônimo do Firebase (invisível, sem UI) só pra regra do
Firestore não ficar 100% pública pra qualquer bot.

**Isso não é segurança de verdade** — o repo é público, então a senha fica
visível pra quem abrir o `app.js` no GitHub. É só um filtro contra achar o
site por acaso, não contra alguém que queira mesmo entrar. Antes de mandar o
link pra Duda: trocar `SENHA_ACESSO` em `app.js` pra uma senha combinada
entre vocês (não precisa ser complexa, só não deixar a de exemplo).

## Limitações conhecidas (v1)

- Facebook só traz seguidores, não média de views (o ator gratuito não
  devolve posts, só dados da página).
- A "média de views" do Instagram usa os últimos ~12 posts retornados pelo
  ator (bundle barato); se o cliente postar muito mais que isso no período
  escolhido, a média fica baseada só nesses últimos 12, não no período
  inteiro.
