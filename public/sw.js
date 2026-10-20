// Service worker mínimo do Vitrine: só o necessário para o app poder ser
// instalado (e aparecer no "Compartilhar" do Android). Não guarda nada em
// cache e não intercepta requisição nenhuma — o app continua sempre online,
// igual ao site.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
