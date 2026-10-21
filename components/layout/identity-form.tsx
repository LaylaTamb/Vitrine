"use client"

import { useState } from "react"
import { toast } from "sonner"

import { updateIdentityAction } from "@/app/configuracoes/actions"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** A foto (por link) e o nome de exibição — o topo do cartão, editado no Meu perfil. */
export function IdentityForm({
  username,
  initialName,
  initialAvatarUrl,
}: {
  username: string
  initialName: string
  initialAvatarUrl: string
}) {
  const [displayName, setDisplayName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setSaved(false)
    const result = await updateIdentityAction({
      displayName,
      avatarUrl: avatarUrl.trim() || null,
    })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSaved(true)
    toast.success("Foto e nome salvos.")
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="avatar" className="plaque">
          Foto (link)
        </Label>
        <div className="flex items-center gap-3">
          <Avatar name={displayName || username} src={avatarUrl.trim() || null} size={48} />
          <Input
            id="avatar"
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value)
              setSaved(false)
            }}
            placeholder="https://…"
            inputMode="url"
          />
        </div>
        <p className="text-xs text-faint">
          Cole o endereço de uma imagem já hospedada. Nada é enviado nem copiado.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="display-name" className="plaque">
          Nome de exibição
        </Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value)
            setSaved(false)
          }}
          maxLength={80}
          placeholder="Como você quer aparecer"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-xs text-muted-foreground">Salvo.</span> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar foto e nome"}
        </Button>
      </div>
    </form>
  )
}
