"use client"

import { Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import { deleteAccountAction } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteConfirmationMatches } from "@/lib/domain/terms"

/**
 * "Excluir minha conta" (direito da LGPD). Para não apagar por engano, a
 * pessoa digita o próprio @ antes; o servidor confere de novo. Deu certo: o
 * servidor leva ao login com o aviso.
 */
export function DeleteAccountForm({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const matches = deleteConfirmationMatches(typed, username)

  function changeOpen(next: boolean) {
    if (pending) return
    setOpen(next)
    if (!next) {
      setTyped("")
      setError(null)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!matches || pending) return
    setPending(true)
    setError(null)
    // Redirecionou: o `await` volta vazio e a tela troca sozinha.
    const result = await deleteAccountAction({ confirm: typed })
    if (result && !result.ok) {
      setPending(false)
      setError(result.error)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Apaga para sempre o seu perfil, todas as pastas, categorias e itens, e quem você segue e
        quem segue você. O seu @ fica livre. Não dá para desfazer — se quiser guardar uma cópia,
        exporte o backup antes.
      </p>
      <Button
        type="button"
        variant="destructive"
        onClick={() => changeOpen(true)}
        className="gap-2"
      >
        <Trash2 className="size-4" /> Excluir minha conta
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="display text-xl">Excluir minha conta</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Tudo o que é seu some na hora e não volta: perfil, acervo, seguidores. As tags
                que você criou continuam no vocabulário compartilhado, sem ligação com você.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 py-4">
              <Label htmlFor="delete-confirm" className="text-sm font-normal text-muted-foreground">
                Para confirmar, digite <span className="text-foreground">@{username}</span>
              </Label>
              <Input
                id="delete-confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={`@${username}`}
              />
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => changeOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" variant="destructive" disabled={!matches || pending}>
                {pending ? "Excluindo…" : "Excluir para sempre"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
