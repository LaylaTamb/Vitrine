"use client"

import { LogOut } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/actions"
import { updateUsernameAction } from "@/app/configuracoes/actions"
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

/**
 * O @ da conta (com o limite de trocas) e o Sair. Foto, nome, bio, redes e
 * Steam ficam no Meu perfil, no "Editar cartão".
 */
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
  const [username, setUsername] = useState(profile.username)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmUsername, setConfirmUsername] = useState(false)

  const cleanUsername = normalizeUsername(username)
  const usernameChanged = cleanUsername !== profile.username
  const problem = usernameChanged ? usernameProblem(username) : null

  async function save() {
    setPending(true)
    setSaved(false)
    const result = await updateUsernameAction({ username: cleanUsername })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setUsername(cleanUsername)
    setSaved(true)
    toast.success(`Pronto: agora você é @${cleanUsername}.`)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (problem || !usernameChanged) return
    // Trocar o @ tem limite: confirma antes, dizendo o que acontece com o antigo.
    setConfirmUsername(true)
  }

  return (
    <form onSubmit={submit} className="max-w-[34rem] space-y-5">
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
          {saved ? <span className="text-xs text-muted-foreground">@ trocado.</span> : null}
          <Button type="submit" disabled={pending || Boolean(problem) || !usernameChanged}>
            {pending ? "Salvando…" : "Trocar o @"}
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
