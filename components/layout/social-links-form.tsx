"use client"

import { useState } from "react"
import { toast } from "sonner"

import { updateSocialLinksAction } from "@/app/configuracoes/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  normalizeSocialLink,
  SOCIAL_LABELS,
  SOCIAL_PLACEHOLDERS,
  SOCIAL_PROVIDERS,
  type SocialProvider,
} from "@/lib/domain/card"

type LinkValues = Record<SocialProvider, string>

/**
 * Os links das redes (Instagram, X, Discord, Spotify, YouTube) — só link: eles
 * aparecem no cartão do perfil. Aceita o @ ou o link; avisa ao sair do campo
 * e o servidor normaliza de novo ao salvar.
 */
export function SocialLinksForm({ initialLinks }: { initialLinks: LinkValues }) {
  const [links, setLinks] = useState(initialLinks)
  const [errors, setErrors] = useState<Partial<Record<SocialProvider, string>>>({})
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  function checkLink(provider: SocialProvider): boolean {
    const result = normalizeSocialLink(provider, links[provider])
    setErrors((current) => ({ ...current, [provider]: result.ok ? undefined : result.error }))
    return result.ok
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const allValid = SOCIAL_PROVIDERS.map(checkLink).every(Boolean)
    if (!allValid) return
    setPending(true)
    const result = await updateSocialLinksAction({ links })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSaved(true)
    toast.success("Redes salvas.")
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-0.5">
        <p className="plaque">Redes</p>
        <p className="text-xs leading-relaxed text-faint">
          Só o link: aparecem no seu cartão, para quem quiser te achar lá.
        </p>
      </div>
      {SOCIAL_PROVIDERS.map((provider) => (
        <div key={provider} className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:items-center">
          <Label htmlFor={`social-${provider}`} className="text-sm text-muted-foreground">
            {SOCIAL_LABELS[provider]}
          </Label>
          <div className="space-y-1">
            <Input
              id={`social-${provider}`}
              value={links[provider]}
              onChange={(event) => {
                const value = event.target.value
                setLinks((current) => ({ ...current, [provider]: value }))
                setSaved(false)
              }}
              onBlur={() => checkLink(provider)}
              placeholder={SOCIAL_PLACEHOLDERS[provider]}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={Boolean(errors[provider])}
            />
            {errors[provider] ? <p className="text-xs text-danger">{errors[provider]}</p> : null}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-3 pt-1">
        {saved ? <span className="text-xs text-muted-foreground">Redes salvas.</span> : null}
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando…" : "Salvar redes"}
        </Button>
      </div>
    </form>
  )
}
