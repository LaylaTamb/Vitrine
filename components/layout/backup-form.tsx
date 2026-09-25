"use client"

import { Download, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { exportCollectionAction, importCollectionAction } from "@/app/configuracoes/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { plural } from "@/lib/domain/format"

/**
 * Exportar baixa um `.json` com pastas, categorias, itens e as tags que eles
 * usam. Importar cola (ou sobe) um `.json` no mesmo formato e sempre cria
 * estrutura nova — nunca mistura com o que já existe.
 */
export function BackupForm({ hideImport = false }: { hideImport?: boolean }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [json, setJson] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExporting(true)
    const result = await exportCollectionAction()
    setExporting(false)

    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Não deu para montar o arquivo." : result.error)
      return
    }

    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `vitrine-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Arquivo baixado.")
  }

  async function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setJson(await file.text())
  }

  async function handleImport() {
    if (!json.trim()) return
    setImporting(true)
    const result = await importCollectionAction({ json })
    setImporting(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    const summary = result.data
    toast.success(
      summary
        ? `Importado: ${plural(summary.categories, "categoria", "categorias")}, ${plural(summary.entries, "item", "itens")}.`
        : "Importado."
    )
    if (summary && summary.renamed.length > 0) {
      for (const rename of summary.renamed) {
        toast.info(`"${rename.from}" já existia — entrou como "${rename.to}".`)
      }
    }
    setJson("")
  }

  return (
    <div className="max-w-[34rem] space-y-6">
      <div className="space-y-1.5">
        <span className="plaque block">Exportar</span>
        <p className="text-xs leading-relaxed text-faint">
          Baixa um arquivo com todas as suas pastas, categorias e itens (e as tags que eles usam).
          Serve de backup e de ponto de partida para editar na mão.
        </p>
        <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="size-4" /> {exporting ? "Gerando…" : "Exportar acervo"}
        </Button>
      </div>

      {hideImport ? null : (
        <div className="space-y-1.5">
          <span className="plaque block">Importar</span>
          <p className="text-xs leading-relaxed text-faint">
            Cole o JSON abaixo, ou suba o arquivo. Sempre cria categorias novas — nunca mistura com
            o que você já tem. Nome repetido ganha um sufixo.
          </p>
          <Textarea
            value={json}
            onChange={(event) => setJson(event.target.value)}
            placeholder='{ "categories": [...], "entries": [...] }'
            spellCheck={false}
            rows={8}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFilePick}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="size-4" /> Escolher arquivo
            </Button>
            <Button type="button" onClick={handleImport} disabled={importing || !json.trim()}>
              {importing ? "Importando…" : "Importar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
