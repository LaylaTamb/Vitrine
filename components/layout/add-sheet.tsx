"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Clapperboard,
  FileUp,
  FolderPlus,
  Gamepad2,
  LayoutGrid,
  MapIcon,
  ScanLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"

import { CategoryEditor, NEW_CATEGORY } from "@/components/category/category-editor"
import { FolderDialog } from "@/components/collection/folder-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Visibility } from "@/lib/domain/privacy"
import { cn } from "@/lib/utils"

const BRING: { href: string; icon: LucideIcon; label: string; hint: string }[] = [
  { href: "/importar", icon: MapIcon, label: "Google Maps", hint: "lugares salvos" },
  {
    href: "/configuracoes?secao=letterboxd",
    icon: Clapperboard,
    label: "Letterboxd",
    hint: "filmes que você viu",
  },
  { href: "/configuracoes?secao=steam", icon: Gamepad2, label: "Steam", hint: "jogos e horas" },
  { href: "/configuracoes?secao=backup", icon: FileUp, label: "Arquivo de backup", hint: ".json" },
]

/**
 * O "＋ Adicionar": tudo o que cria ou traz coisas, num lugar só — item,
 * categoria, pasta, ler um QR e as importações. No celular, sobe de baixo.
 */
export function AddSheet({
  open,
  onOpenChange,
  defaultVisibility,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** O padrão do perfil para pasta e categoria novas. */
  defaultVisibility: Visibility
}) {
  const router = useRouter()
  const [creating, setCreating] = useState<"categoria" | "pasta" | null>(null)

  // Fecha a folha e abre o diálogo no lugar dela.
  function create(kind: "categoria" | "pasta") {
    onOpenChange(false)
    setCreating(kind)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] gap-5 overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-2xl">Adicionar</DialogTitle>
            <DialogDescription>Tudo o que cria ou traz coisas, num lugar só.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <Tile
              href="/compartilhar"
              onNavigate={() => onOpenChange(false)}
              icon={Sparkles}
              label="Item"
              hint="Algo que você comeu, viu, leu…"
              main
            />
            <Tile
              onClick={() => create("categoria")}
              icon={LayoutGrid}
              label="Categoria"
              hint="Restaurantes, Filmes…"
            />
            <Tile
              onClick={() => create("pasta")}
              icon={FolderPlus}
              label="Pasta"
              hint="Para agrupar categorias"
            />
            <Tile
              href="/qr?modo=ler"
              onNavigate={() => onOpenChange(false)}
              icon={ScanLine}
              label="Ler QR"
              hint="Virar amigo na hora"
            />
          </div>

          <section className="space-y-2">
            <p className="plaque">Trazer de outro lugar</p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {BRING.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hi"
                  >
                    <item.icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-sm">
                      {item.label} <span className="text-muted-foreground">· {item.hint}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </DialogContent>
      </Dialog>

      <CategoryEditor
        open={creating === "categoria"}
        onOpenChange={(next) => setCreating(next ? "categoria" : null)}
        initial={NEW_CATEGORY}
        defaultVisibility={defaultVisibility}
        onSaved={(id) => {
          if (id) router.push(`/categoria/${id}`)
        }}
      />
      <FolderDialog
        open={creating === "pasta"}
        onOpenChange={(next) => setCreating(next ? "pasta" : null)}
        scope={{ kind: "collection", parentFolderId: null, defaultVisibility }}
      />
    </>
  )
}

function Tile({
  href,
  onClick,
  onNavigate,
  icon: Icon,
  label,
  hint,
  main = false,
}: {
  href?: string
  onClick?: () => void
  onNavigate?: () => void
  icon: LucideIcon
  label: string
  hint: string
  main?: boolean
}) {
  const className = cn(
    "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors hover:border-brand-dim",
    main ? "border-brand-dim bg-brand-wash" : "border-line bg-surface"
  )
  const body = (
    <>
      <Icon aria-hidden className="size-6 text-brand" />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </>
  )
  return href ? (
    <Link href={href} onClick={onNavigate} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}
