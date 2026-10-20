import type { MetadataRoute } from "next"

/**
 * O Vitrine instalável (PWA). Instalado no Android, ele aparece no botão
 * "Compartilhar" dos outros apps (`share_target`): o que chega abre
 * `/compartilhar` — por enquanto só texto (um link é tratado como texto).
 * Os ícones são gerados por `app/icon.tsx`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vitrine",
    short_name: "Vitrine",
    description: "Catálogo dos seus gostos: tudo o que você consome, do seu jeito.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#131315",
    theme_color: "#131315",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/compartilhar",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  }
}
