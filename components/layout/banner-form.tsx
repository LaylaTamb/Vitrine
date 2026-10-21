"use client"

import { useState } from "react"
import { toast } from "sonner"

import { updateBannerAction } from "@/app/configuracoes/actions"
import { ProfileBanner } from "@/components/social/profile-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizeBannerUrl } from "@/lib/domain/card"

/**
 * Meu perfil → Editar cartão → Banner (migração 36): o link da imagem e que
 * parte dela aparece na faixa (0 = topo, 100 = pé), com a prévia ao vivo.
 * Campo vazio e salvar = sem banner.
 */
export function BannerForm({
  initialUrl,
  initialPosition,
}: {
  initialUrl: string
  initialPosition: number
}) {
  const [url, setUrl] = useState(initialUrl)
  const [position, setPosition] = useState(initialPosition)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  const checked = normalizeBannerUrl(url)
  const preview = checked.ok && checked.value ? { url: checked.value, position } : null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!checked.ok) return
    setPending(true)
    setSaved(false)
    const result = await updateBannerAction({ url, position })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSaved(true)
    toast.success(checked.value ? "Banner salvo." : "Banner tirado.")
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ProfileBanner banner={preview} className="rounded-lg border border-line" />

      <div className="space-y-1.5">
        <Label htmlFor="banner-url" className="plaque">
          Link da imagem
        </Label>
        <Input
          id="banner-url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            setSaved(false)
          }}
          placeholder="https://…"
          inputMode="url"
          aria-invalid={!checked.ok}
          aria-describedby="banner-url-hint"
        />
        <p id="banner-url-hint" className="text-xs leading-relaxed">
          {checked.ok ? (
            <span className="text-faint">
              Cole o endereço de uma imagem já hospedada; larga fica melhor (1500×500, como no
              Twitter). Nada é enviado nem copiado. Vazio = sem banner.
            </span>
          ) : (
            <span className="text-danger">{checked.error}</span>
          )}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="banner-position" className="plaque">
          Posição
        </Label>
        <input
          id="banner-position"
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          disabled={!preview}
          onChange={(event) => {
            setPosition(Number(event.target.value))
            setSaved(false)
          }}
          aria-valuetext={`${position}% (0 = topo da imagem, 100 = pé)`}
          className="w-full accent-brand disabled:opacity-40"
        />
        <div className="flex justify-between text-xs text-faint">
          <span>Topo da imagem</span>
          <span>Pé da imagem</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved ? <span className="text-xs text-muted-foreground">Salvo.</span> : null}
        {url ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setUrl("")
              setSaved(false)
            }}
          >
            Tirar o banner
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || !checked.ok}>
          {pending ? "Salvando…" : "Salvar banner"}
        </Button>
      </div>
    </form>
  )
}
