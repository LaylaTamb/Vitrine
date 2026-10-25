"use client"

import { Ellipsis } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * O "⋯" do topo de uma pasta, categoria ou item: o que é raro (estrutura,
 * renomear, excluir…) mora aqui, para o topo ficar com uma ação só à vista.
 */
export function MoreMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    // Não modal: as opções abrem diálogos, e o menu modal deixaria a página
    // sem clique (`pointer-events: none`) depois que o diálogo fecha.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-lg" aria-label={label} title={label}>
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
