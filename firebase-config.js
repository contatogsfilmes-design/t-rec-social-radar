// Config pública do Firebase (não é segredo — é normal isso ficar no front).
// Preencher com os valores reais do projeto Firebase depois de criá-lo em
// console.firebase.google.com > Configurações do projeto > Seus apps > Web.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDCMS72CF3rgGX3Z0bYqDd6FLsirk5zFWg",
  authDomain: "t-rec-social-media.firebaseapp.com",
  projectId: "t-rec-social-media",
  storageBucket: "t-rec-social-media.firebasestorage.app",
  messagingSenderId: "23464863696",
  appId: "1:23464863696:web:3a23fd044285e50b35fbd5",
};

// URLs das functions na Vercel (essas sim têm os tokens secretos — Apify e
// OpenAI —, guardados só nas variáveis de ambiente da Vercel, nunca aqui).
window.SCRAPE_API_URL = "https://SEU-PROJETO.vercel.app/api/scrape";
window.RELATORIO_API_URL = "https://SEU-PROJETO.vercel.app/api/relatorio";
