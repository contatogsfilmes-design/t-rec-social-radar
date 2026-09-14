// Config pública do Firebase (não é segredo — é normal isso ficar no front).
// Preencher com os valores reais do projeto Firebase depois de criá-lo em
// console.firebase.google.com > Configurações do projeto > Seus apps > Web.
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// URL da function na Vercel que fala com a Apify (essa sim tem o token secreto,
// guardado só nas variáveis de ambiente da Vercel — nunca aqui).
window.SCRAPE_API_URL = "https://SEU-PROJETO.vercel.app/api/scrape";
