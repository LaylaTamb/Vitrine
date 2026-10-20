import { describe, expect, it } from "vitest"

import { translateError } from "./errors"
import { parseEstrutura } from "./fields"
import {
  INBOX_ESTRUTURA,
  INBOX_LOCATION_FIELD_ID,
  INBOX_LOCKED_MESSAGE,
  inboxOf,
  isInbox,
  newInboxCategory,
  splitInbox,
} from "./inbox"

describe("A organizar", () => {
  type Row = { id: string; kind?: "normal" | "inbox" }
  const comum: Row = { id: "a", kind: "normal" }
  const antiga: Row = { id: "b" } // antes da migração 17: sem `kind`
  const caixa: Row = { id: "c", kind: "inbox" }

  it("reconhece a caixa de entrada; sem a coluna, tudo é comum", () => {
    expect(isInbox(caixa)).toBe(true)
    expect(isInbox(comum)).toBe(false)
    expect(isInbox(antiga)).toBe(false)
    expect(isInbox(null)).toBe(false)
  })

  it("separa a caixa de entrada sem mexer na ordem do resto", () => {
    expect(inboxOf([comum, caixa, antiga])).toBe(caixa)
    expect(inboxOf([comum, antiga])).toBeNull()
    expect(splitInbox([comum, caixa, antiga])).toEqual({ inbox: caixa, others: [comum, antiga] })
    expect(splitInbox([comum])).toEqual({ inbox: null, others: [comum] })
  })

  it("tem Nome, Estrelas e um campo Localização de id fixo", () => {
    expect(parseEstrutura(INBOX_ESTRUTURA)).toEqual(INBOX_ESTRUTURA)
    expect(INBOX_ESTRUTURA).toEqual([
      { id: INBOX_LOCATION_FIELD_ID, nome: "Localização", tipo: "location" },
    ])
    const linha = newInboxCategory("id", "dono", "2026-10-19T00:00:00Z")
    expect(linha).toMatchObject({
      name: "A organizar",
      icon: "📥",
      kind: "inbox",
      rating_enabled: true,
      folder_id: null,
      visibility: "private",
    })
  })

  it("a trava do banco vira frase", () => {
    expect(translateError({ code: "P0001", message: "inbox_locked" })).toBe(INBOX_LOCKED_MESSAGE)
  })
})
