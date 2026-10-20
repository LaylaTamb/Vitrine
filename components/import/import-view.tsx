"use client"

import { ExternalLink, Film, FolderOpen, MapPin, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, type ReactNode } from "react"
import { toast } from "sonner"

import {
  finishImportAction,
  importGoogleRowsAction,
  importLetterboxdRowsAction,
  prepareImportAction,
} from "@/app/importar/actions"
import { runPendingGeocode } from "@/components/map/geocode-runner"
import { useVitrine } from "@/components/providers/vitrine-context"
import { Button } from "@/components/ui/button"
import { plural } from "@/lib/domain/format"
import { mergeGoogleLists, parseGoogleFile, type GoogleList } from "@/lib/import/google"
import {
  LETTERBOXD_CATEGORY,
  letterboxdKind,
  mergeLetterboxd,
  type LetterboxdFilm,
  type LetterboxdKind,
} from "@/lib/import/letterboxd"
import { readImportFiles } from "@/lib/import/read-files"

const GOOGLE_BATCH = 200
const LETTERBOXD_BATCH = 100

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}

/** A tela Importar: Google Maps (Takeout) e Letterboxd. */
export function ImportView() {
  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-2">
      <GoogleImport />
      <LetterboxdImport />
    </div>
  )
}

function Card({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-wash text-brand">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="display text-xl leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

/** O passo a passo, numerado. */
function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="space-y-2 text-sm leading-relaxed text-muted-foreground [counter-reset:passo] [&>li]:relative [&>li]:pl-8 [&>li]:[counter-increment:passo] [&>li]:before:absolute [&>li]:before:top-0 [&>li]:before:left-0 [&>li]:before:flex [&>li]:before:size-6 [&>li]:before:items-center [&>li]:before:justify-center [&>li]:before:rounded-full [&>li]:before:bg-surface-hi [&>li]:before:text-xs [&>li]:before:text-foreground [&>li]:before:content-[counter(passo)]">
      {children}
    </ol>
  )
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-foreground underline underline-offset-2"
    >
      {children}
      <ExternalLink aria-hidden className="size-3" />
    </a>
  )
}

/** O botão de escolher arquivos (o input fica escondido, o rótulo é o botão). */
function FilePicker({
  onFiles,
  disabled,
  label,
}: {
  onFiles: (files: File[]) => void
  disabled: boolean
  label: string
}) {
  const id = useId()
  return (
    <div>
      <input
        id={id}
        type="file"
        multiple
        accept=".zip,.json,.csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (files.length > 0) onFiles(files)
        }}
      />
      <label
        htmlFor={id}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-hi px-3 text-sm text-foreground transition-colors hover:border-brand-dim has-[:disabled]:opacity-50"
      >
        <FolderOpen aria-hidden className="size-4" /> {label}
      </label>
    </div>
  )
}

function Status({ children, good = false }: { children: ReactNode; good?: boolean }) {
  return (
    <p
      role="status"
      className={
        good
          ? "rounded-lg border border-brand-dim bg-brand-wash px-3 py-2.5 text-sm text-foreground"
          : "rounded-lg border border-line bg-surface-hi px-3 py-2.5 text-sm text-muted-foreground"
      }
    >
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Google Maps
// ---------------------------------------------------------------------------

function GoogleImport() {
  const router = useRouter()
  const { actions } = useVitrine()
  const [lists, setLists] = useState<GoogleList[] | null>(null)
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ added: number; skipped: number; pending: number } | null>(null)

  const total = lists?.reduce((sum, list) => sum + list.places.length, 0) ?? 0
  const located =
    lists?.reduce((sum, list) => sum + list.places.filter((place) => place.lat !== null).length, 0) ??
    0

  async function read(files: File[]) {
    setBusy("reading")
    setError(null)
    setDone(null)
    try {
      const read = await readImportFiles(files, (path) => /\.(json|csv)$/i.test(path))
      const found = mergeGoogleLists(
        read.flatMap((file) => {
          const list = parseGoogleFile(file.path, file.text)
          return list ? [list] : []
        })
      )
      setLists(found)
      if (found.length === 0) {
        setError(
          "Não achei listas do Google Maps nesses arquivos. Confira se marcou “Salvos” e “Maps (seus lugares)” no Takeout."
        )
      }
    } catch (failure) {
      setLists(null)
      setError(failure instanceof Error ? failure.message : "Não deu para ler os arquivos.")
    } finally {
      setBusy(null)
    }
  }

  async function run() {
    if (!lists) return
    setBusy("importing")
    setProgress(0)
    setError(null)
    const totals = { added: 0, skipped: 0, pending: 0 }
    try {
      const prepared = await prepareImportAction({
        source: "google",
        names: lists.map((list) => list.name),
      })
      if (!prepared.ok || !prepared.data) throw new Error(prepared.ok ? "" : prepared.error)
      let count = 0
      for (const list of lists) {
        for (const rows of chunks(list.places, GOOGLE_BATCH)) {
          const result = await importGoogleRowsAction({
            categoryId: prepared.data[list.name],
            listName: list.name,
            rows,
          })
          if (!result.ok || !result.data) throw new Error(result.ok ? "" : result.error)
          totals.added += result.data.added
          totals.skipped += result.data.skipped
          totals.pending += result.data.pending
          count += rows.length
          setProgress(count)
        }
      }
      await finishImportAction({ source: "google", ...totals })
      setDone(totals)
      setLists(null)
      router.refresh()
      // Os lugares sem coordenadas: a fila de busca de endereços do Mapa.
      if (totals.pending > 0) void runPendingGeocode(actions, { mode: "pending" })
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : "A importação parou no meio. Tente de novo: o que já entrou não duplica."
      )
      toast.error("A importação parou no meio.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card
      icon={MapPin}
      title="Google Maps"
      subtitle="As suas listas salvas e os lugares com estrela, pelo Google Takeout."
    >
      <Steps>
        <li>
          Abra o <ExternalAnchor href="https://takeout.google.com">Google Takeout</ExternalAnchor> com
          a sua conta do Google.
        </li>
        <li>
          Toque em <strong className="text-foreground">Desmarcar todos</strong> e marque só{" "}
          <strong className="text-foreground">Salvos</strong> (as listas) e{" "}
          <strong className="text-foreground">Maps (seus lugares)</strong> (os salvos com estrela).
        </li>
        <li>
          Em <strong className="text-foreground">Próxima etapa</strong>: “Exportar uma vez”, arquivo{" "}
          <strong className="text-foreground">.zip</strong> → Criar exportação.
        </li>
        <li>
          Quando o e-mail do Google chegar (de minutos a horas), baixe o .zip e escolha aqui — ou só
          os arquivos de dentro: o .json dos lugares salvos e os .csv da pasta Salvos.
        </li>
      </Steps>

      <p className="text-xs leading-relaxed text-faint">
        Vira uma categoria por lista (e “Salvos com estrela”) na pasta “Google Maps”, com Nome,
        Localização e Sua anotação. Importar de novo não duplica. Os arquivos são lidos aqui no
        aparelho.
      </p>

      <FilePicker onFiles={read} disabled={busy !== null} label="Escolher o .zip ou os arquivos" />

      {busy === "reading" ? <Status>Lendo os arquivos…</Status> : null}
      {error ? <Status>{error}</Status> : null}

      {lists && lists.length > 0 ? (
        <div className="space-y-3">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {lists.map((list) => (
              <li key={list.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">{list.name}</span>
                <span className="shrink-0 text-xs text-faint">
                  {plural(list.places.length, "lugar", "lugares")}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-faint">
            {plural(total, "lugar", "lugares")} — {plural(located, "já vem", "já vêm")} com
            coordenadas. Os outros entram na fila de busca de endereços: a Geoapify grátis localiza
            até 3.000 por dia, e o que passar disso fica para o dia seguinte (o Mapa continua).
          </p>
          <Button onClick={run} disabled={busy !== null}>
            {busy === "importing"
              ? `Importando… ${progress} de ${total}`
              : `Importar ${plural(total, "lugar", "lugares")}`}
          </Button>
        </div>
      ) : null}

      {done ? (
        <Status good>
          {done.added === 0
            ? "Nada novo: tudo isso já estava no seu Vitrine."
            : `${plural(done.added, "lugar importado", "lugares importados")}`}
          {done.skipped > 0 ? ` · ${plural(done.skipped, "já estava", "já estavam")} lá` : ""}
          {done.pending > 0
            ? ` · ${plural(done.pending, "sendo localizado", "sendo localizados")} no mapa agora`
            : ""}
          .
        </Status>
      ) : null}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Letterboxd
// ---------------------------------------------------------------------------

function LetterboxdImport() {
  const router = useRouter()
  const [films, setFilms] = useState<LetterboxdFilm[] | null>(null)
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ added: number; updated: number; skipped: number } | null>(
    null
  )

  async function read(files: File[]) {
    setBusy("reading")
    setError(null)
    setDone(null)
    try {
      const read = await readImportFiles(files, (path) => letterboxdKind(path) !== null)
      const byKind: Partial<Record<LetterboxdKind, string>> = {}
      for (const file of read) {
        const kind = letterboxdKind(file.path)
        if (kind) byKind[kind] = file.text
      }
      const found = mergeLetterboxd(byKind)
      setFilms(found)
      if (found.length === 0) {
        setError(
          "Não achei filmes nesses arquivos. Escolha o .zip da exportação do Letterboxd (ou o watched.csv)."
        )
      }
    } catch (failure) {
      setFilms(null)
      setError(failure instanceof Error ? failure.message : "Não deu para ler os arquivos.")
    } finally {
      setBusy(null)
    }
  }

  async function run() {
    if (!films) return
    setBusy("importing")
    setProgress(0)
    setError(null)
    const totals = { added: 0, updated: 0, skipped: 0 }
    try {
      const prepared = await prepareImportAction({
        source: "letterboxd",
        names: [LETTERBOXD_CATEGORY],
      })
      if (!prepared.ok || !prepared.data) throw new Error(prepared.ok ? "" : prepared.error)
      let count = 0
      for (const rows of chunks(films, LETTERBOXD_BATCH)) {
        const result = await importLetterboxdRowsAction({
          categoryId: prepared.data[LETTERBOXD_CATEGORY],
          rows,
        })
        if (!result.ok || !result.data) throw new Error(result.ok ? "" : result.error)
        totals.added += result.data.added
        totals.updated += result.data.updated
        totals.skipped += result.data.skipped
        count += rows.length
        setProgress(count)
      }
      await finishImportAction({ source: "letterboxd", added: totals.added, pending: 0 })
      setDone(totals)
      setFilms(null)
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : "A importação parou no meio. Tente de novo: o que já entrou não duplica."
      )
      toast.error("A importação parou no meio.")
    } finally {
      setBusy(null)
    }
  }

  const rated = films?.filter((film) => film.rating !== null).length ?? 0
  const reviewed = films?.filter((film) => film.review).length ?? 0

  return (
    <Card
      icon={Film}
      title="Letterboxd"
      subtitle="Os filmes que você já assistiu, com nota, data e resenha. A watchlist não entra."
    >
      <Steps>
        <li>
          Entre no <ExternalAnchor href="https://letterboxd.com/settings/data/">Letterboxd</ExternalAnchor>{" "}
          (no navegador) e vá em <strong className="text-foreground">Settings → Data</strong>.
        </li>
        <li>
          Toque em <strong className="text-foreground">Export your data</strong> e baixe o .zip.
        </li>
        <li>
          Escolha o .zip aqui — ou os arquivos de dentro: watched.csv, ratings.csv, diary.csv e
          reviews.csv.
        </li>
      </Steps>

      <p className="text-xs leading-relaxed text-faint">
        Vira a categoria “Filmes” na pasta “Letterboxd”, com Nome, Ano, Nota, Data em que assistiu e
        Resenha. Importar de novo acrescenta os filmes novos e atualiza as notas que mudaram.
      </p>

      <FilePicker onFiles={read} disabled={busy !== null} label="Escolher o .zip ou os arquivos" />

      {busy === "reading" ? <Status>Lendo os arquivos…</Status> : null}
      {error ? <Status>{error}</Status> : null}

      {films && films.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {plural(films.length, "filme", "filmes")}
            <span className="text-muted-foreground">
              {" "}
              · {plural(rated, "com nota", "com nota")} · {plural(reviewed, "com resenha", "com resenha")}
            </span>
          </p>
          <Button onClick={run} disabled={busy !== null}>
            {busy === "importing"
              ? `Importando… ${progress} de ${films.length}`
              : `Importar ${plural(films.length, "filme", "filmes")}`}
          </Button>
        </div>
      ) : null}

      {done ? (
        <Status good>
          {done.added === 0 && done.updated === 0
            ? "Nada novo: tudo isso já estava no seu Vitrine."
            : [
                done.added > 0 ? plural(done.added, "filme novo", "filmes novos") : "",
                done.updated > 0 ? plural(done.updated, "nota atualizada", "notas atualizadas") : "",
              ]
                .filter(Boolean)
                .join(" · ")}
          .
        </Status>
      ) : null}
    </Card>
  )
}
