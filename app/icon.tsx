import { ImageResponse } from "next/og"

import { BrandIcon } from "@/components/pwa/brand-icon"

/** Os ícones do app instalável (192 e 512), gerados no build: `/icon/192` e `/icon/512`. */
export function generateImageMetadata() {
  return [
    { id: "192", contentType: "image/png", size: { width: 192, height: 192 } },
    { id: "512", contentType: "image/png", size: { width: 512, height: 512 } },
  ]
}

export default function Icon({ id }: { id: string }) {
  const size = id === "192" ? 192 : 512
  return new ImageResponse(<BrandIcon size={size} />, { width: size, height: size })
}
