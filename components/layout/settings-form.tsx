"use client"

import { LogOut } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/actions"
import { updateProfileAction } from "@/app/configuracoes/actions"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Profile } from "@/lib/domain/types"

export function SettingsForm({ profile }: { profile: Profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "")
  const [username, setUsername] = useState(profile.username)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "")
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setSaved(false)
    const result = await updateProfileAction({
      displayName,
      username,
      avatarUrl: avatarUrl.trim() || null,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSaved(true)
    toast.success("Perfil salvo.")
  }

  const cleanUsername = username.trim().toLowerCase()

  return (
    <form onSubmit={submit} className="max-w-[34rem] space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="avatar" className="plaque">
          Avatar (link)
        </Label>
        <div className="flex items-center gap-3">
          <Avatar name={displayName || cleanUsername} src={avatarUrl.trim() || null} size={48} />
          <Input
            id="avatar"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
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
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
          placeholder="Como você quer aparecer"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username" className="plaque">
          Nome de usuário
        </Label>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={30}
          placeholder="seunome"
        />
        <p className="text-xs text-faint">
          Seu acervo fica em <span className="text-muted-foreground">/u/{cleanUsername || "…"}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => signOutAction()}
        >
          <LogOut className="size-4" /> Sair da conta
        </Button>

        <div className="flex items-center gap-3">
          {saved ? <span className="text-xs text-muted-foreground">Perfil salvo.</span> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  )
}
