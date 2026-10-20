"use client"

import { LogOut } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/actions"
import { updateProfileAction } from "@/app/configuracoes/actions"
import { Avatar } from "@/components/ui/avatar-image"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Profile } from "@/lib/domain/types"
import {
  normalizeUsername,
  profilePath,
  USERNAME_WINDOW_DAYS,
  usernameProblem,
} from "@/lib/domain/username"

export function SettingsForm({
  profile,
  usernameRule,
  usernameChangesLeft,
}: {
  profile: Profile
  /** A regra das trocas de @ em palavras ("você pode trocar mais 1 vez até…"). */
  usernameRule: string
  /** Quantas trocas de @ ainda cabem agora (0 = campo travado). */
  usernameChangesLeft: number
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "")
  const [username, setUsername] = useState(profile.username)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "")
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmUsername, setConfirmUsername] = useState(false)

  const cleanUsername = normalizeUsername(username)
  const usernameChanged = cleanUsername !== profile.username
  const problem = usernameChanged ? usernameProblem(username) : null

  async function save() {
    setPending(true)
    setSaved(false)
    const result = await updateProfileAction({
      displayName,
      username: cleanUsername,
      avatarUrl: avatarUrl.trim() || null,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setUsername(cleanUsername)
    setSaved(true)
    toast.success(usernameChanged ? `Perfil salvo. Agora você é @${cleanUsername}.` : "Perfil salvo.")
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (problem) return
    // Trocar o @ tem limite: confirma antes, dizendo o que acontece com o antigo.
    if (usernameChanged) {
      setConfirmUsername(true)
      return
    }
    void save()
  }

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
          Nome de usuário (@)
        </Label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-faint"
          >
            @
          </span>
          <Input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={31}
            placeholder="seunome"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={usernameChangesLeft === 0}
            aria-invalid={Boolean(problem)}
            aria-describedby="username-hint"
            className="pl-7"
          />
        </div>
        <div id="username-hint" className="space-y-1 text-xs leading-relaxed">
          {problem ? <p className="text-danger">{problem}</p> : null}
          <p className="text-faint">
            Seu perfil fica em{" "}
            <span className="text-muted-foreground">{profilePath(cleanUsername || "…")}</span>.{" "}
            {usernameRule}
          </p>
        </div>
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
          <Button type="submit" disabled={pending || Boolean(problem)}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmUsername}
        onOpenChange={setConfirmUsername}
        title="Trocar o @"
        description={
          <>
            <p>
              <span className="text-foreground">@{profile.username}</span> passa a ser{" "}
              <span className="text-foreground">@{cleanUsername}</span>.
            </p>
            <p>
              O endereço antigo continua levando ao seu perfil por {USERNAME_WINDOW_DAYS} dias, e
              ninguém mais pega esse @ nesse tempo.{" "}
              {usernameChangesLeft <= 1
                ? `Depois desta, só dá para trocar de novo quando a troca mais antiga completar ${USERNAME_WINDOW_DAYS} dias.`
                : `Depois desta, ainda cabe mais 1 troca nos próximos ${USERNAME_WINDOW_DAYS} dias.`}
            </p>
          </>
        }
        confirmLabel="Trocar e salvar"
        pendingLabel="Salvando…"
        destructive={false}
        onConfirm={save}
      />
    </form>
  )
}
