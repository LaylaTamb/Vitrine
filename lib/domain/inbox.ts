/**
 * "A organizar": a caixa de entrada de cada conta — uma categoria criada pelo
 * sistema (migração 17), onde caem os itens salvos às pressas (compartilhar,
 * "você está em X?", "Trazer" do Match). Toda conta tem exatamente uma.
 *
 * O nome, a estrutura e as estrelas são fixos, ela fica na raiz das Coleções
 * e não pode ser apagada; os itens dela podem ser movidos para onde for.
 */

import type { Category, Estrutura } from "./types"

export const INBOX_NAME = "A organizar"
export const INBOX_ICON = "📥"

/** Id fixo do campo Localização — o mesmo em toda conta (e no SQL 17). */
export const INBOX_LOCATION_FIELD_ID = "f_inbox_loc"

export const INBOX_ESTRUTURA: Estrutura = [
  { id: INBOX_LOCATION_FIELD_ID, nome: "Localização", tipo: "location" },
]

/** A frase de quando alguém tenta mexer no que é fixo (o banco recusa com `inbox_locked`). */
export const INBOX_LOCKED_MESSAGE =
  "“A organizar” é a sua caixa de entrada: não dá para apagar, renomear, mudar a estrutura nem tirar das Coleções. Os itens dela, sim, podem ir para qualquer categoria."

/** Ausente (antes da migração 17) = categoria comum. */
export function isInbox(category: Pick<Category, "kind"> | null | undefined): boolean {
  return category?.kind === "inbox"
}

/** A caixa de entrada da conta, se houver. */
export function inboxOf<T extends Pick<Category, "kind">>(categories: T[]): T | null {
  return categories.find(isInbox) ?? null
}

/** A caixa de entrada à parte (ela tem lugar fixo na tela) e o resto, na ordem de sempre. */
export function splitInbox<T extends Pick<Category, "kind">>(
  categories: T[]
): { inbox: T | null; others: T[] } {
  const inbox = inboxOf(categories)
  return { inbox, others: inbox ? categories.filter((category) => category !== inbox) : categories }
}
