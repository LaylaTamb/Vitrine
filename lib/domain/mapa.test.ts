import { describe, expect, it } from "vitest"

import { isMissingSchema, translateError } from "./errors"
import {
  FIELD_TYPE_LABELS,
  LOCATION_MAX_LENGTH,
  coerceFieldValue,
  convertibleTypesOf,
  diffEstrutura,
  locationFieldsOf,
  parseEstrutura,
  parseEstruturaJSON,
} from "./fields"
import { EMPTY_GLOBAL_FILTER, activeFilterCount, applyGlobalFilter, unifyFields } from "./filter"
import { formatDistance } from "./format"
import {
  buildPins,
  geolocationErrorMessage,
  hasLocationFields,
  haversine,
  nearby,
  pendingPlaces,
} from "./map"
import { mapsDirectionsUrl, mapsPlaceUrl, mapsTargetOf } from "./maps-links"
import { migrateCustomFields } from "./migrate"
import { humanizeOpeningHours, parseOpeningHours } from "./opening-hours"
import {
  formatDuration,
  myPriceOf,
  openingStatus,
  radiusThatReaches,
  sortSuggestions,
  typeLabelOf,
  type OpeningPeriod,
} from "./place-details"
import { ruleSummary } from "./place-summary"
import {
  isPlaceUsable,
  locationTargets,
  needsGeocode,
  pendingGeocodes,
  remapPlaces,
  staleFieldIds,
} from "./places"
import type { Category, CustomFields, EntryPlace, Estrutura, FieldDef } from "./types"
import { toView } from "./view"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-10-14T12:00:00Z")
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString()

const LOCAL: FieldDef = { id: "f_local", nome: "Localização", tipo: "location" }

function category(partial: Partial<Category> & { id: string; estrutura: Estrutura }): Category {
  return {
    owner_id: "u1",
    name: partial.id,
    icon: null,
    color: null,
    folder_id: null,
    display_order: 0,
    rating_enabled: true,
    default_sort: "recent",
    created_at: "2024-01-01T00:00:00Z",
    ...partial,
  }
}

function place(partial: Partial<EntryPlace> & { entry_id: string; field_id: string }): EntryPlace {
  return {
    owner_id: "u1",
    address: "Rua Augusta, 1500",
    formatted_address: "R. Augusta, 1500 - Consolação, São Paulo - SP",
    lat: -23.556,
    lng: -46.662,
    place_id: "ChIJ_augusta",
    status: "ok",
    geocoded_at: daysAgo(1),
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// o campo Localização
// ---------------------------------------------------------------------------

describe("campo Localização", () => {
  it("tem rótulo e é tratado como texto ao salvar", () => {
    expect(FIELD_TYPE_LABELS.location).toBe("Localização (mapa)")
    expect(coerceFieldValue(LOCAL, "  Rua Augusta, 1500  ")).toBe("Rua Augusta, 1500")
    expect(coerceFieldValue(LOCAL, "   ")).toBeNull()
    expect(coerceFieldValue(LOCAL, null)).toBeNull()
    expect(coerceFieldValue(LOCAL, 123)).toBe("123")
  })

  it("corta o endereço em 300 caracteres", () => {
    const long = "a".repeat(LOCATION_MAX_LENGTH + 50)
    expect(coerceFieldValue(LOCAL, long)).toHaveLength(LOCATION_MAX_LENGTH)
  })

  it("é aceito pela estrutura vinda do banco e pelo modo JSON", () => {
    expect(parseEstrutura([{ id: "f_local", nome: "Localização", tipo: "location" }])).toEqual([LOCAL])
    const parsed = parseEstruturaJSON('[{ "id": "f_local", "nome": "Onde", "tipo": "location" }]', [
      LOCAL,
    ])
    expect(parsed).toEqual({
      ok: true,
      estrutura: [{ id: "f_local", nome: "Onde", tipo: "location" }],
    })
  })

  it("acha os campos de Localização — pode haver mais de um", () => {
    const estrutura: Estrutura = [
      LOCAL,
      { id: "f_obs", nome: "Observações", tipo: "str" },
      { id: "f_filial", nome: "Filial", tipo: "location" },
    ]
    expect(locationFieldsOf(estrutura).map((field) => field.id)).toEqual(["f_local", "f_filial"])
  })

  it("só deixa Texto virar Localização", () => {
    expect(convertibleTypesOf("str")).toEqual(["str", "location"])
    expect(convertibleTypesOf("location")).toEqual(["location"])
    expect(convertibleTypesOf("int")).toEqual(["int"])
  })

  it("aponta a troca de tipo no diff da estrutura", () => {
    const antes: Estrutura = [{ id: "f_local", nome: "Localização", tipo: "str" }]
    const diff = diffEstrutura(antes, [LOCAL])
    expect(diff.retyped).toEqual([{ field: LOCAL, from: "str", to: "location" }])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diffEstrutura([LOCAL], [LOCAL]).retyped).toEqual([])
  })

  it("vira um filtro só no Filtro geral, com busca por 'contém'", () => {
    const restaurantes = category({ id: "c1", name: "Restaurantes", estrutura: [LOCAL] })
    const bares = category({
      id: "c2",
      name: "Bares",
      estrutura: [{ id: "f_onde", nome: "localização", tipo: "location" }],
    })
    const unified = unifyFields([restaurantes, bares])
    expect(unified).toHaveLength(1)
    expect(unified[0]).toMatchObject({ tipo: "location", label: "Localização" })
    expect(unified[0].categories.map((item) => item.fieldId)).toEqual(["f_local", "f_onde"])

    const views = [
      toView(
        {
          id: "e1",
          category_id: "c1",
          owner_id: "u1",
          folder_id: null,
          name: "Mocotó",
          rating: 4,
          image_url: null,
          image_display: {},
          custom_fields: { f_local: "Vila Medeiros, São Paulo" },
          display_order: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        restaurantes.estrutura,
        new Map(),
        "Restaurantes"
      ),
      toView(
        {
          id: "e2",
          category_id: "c2",
          owner_id: "u1",
          folder_id: null,
          name: "Bar Brahma",
          rating: 3,
          image_url: null,
          image_display: {},
          custom_fields: { f_onde: "Av. São João, 677" },
          display_order: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        bares.estrutura,
        new Map(),
        "Bares"
      ),
    ]
    const filtered = applyGlobalFilter(
      views,
      { ...EMPTY_GLOBAL_FILTER, fields: { [unified[0].key]: { min: "", max: "", value: "sao" } } },
      unified
    )
    expect(filtered.map((view) => view.id)).toEqual(["e1", "e2"])
  })

  it("acompanha o item na mudança de categoria quando nome e tipo batem", () => {
    const result = migrateCustomFields(
      [LOCAL, { id: "f_obs", nome: "Obs", tipo: "str" }],
      [{ id: "d_local", nome: "localização", tipo: "location" }],
      { f_local: "Rua Augusta, 1500", f_obs: "boa" }
    )
    expect(result.values).toEqual({ d_local: "Rua Augusta, 1500" })
    expect(result.fieldMap).toEqual({ f_local: "d_local" })
  })
})

// ---------------------------------------------------------------------------
// entry_places
// ---------------------------------------------------------------------------

describe("localização dos itens", () => {
  it("lista os campos de Localização preenchidos", () => {
    const estrutura: Estrutura = [LOCAL, { id: "f_filial", nome: "Filial", tipo: "location" }]
    expect(locationTargets(estrutura, { f_local: "  Rua Augusta, 1500 ", f_filial: "" })).toEqual([
      { fieldId: "f_local", fieldLabel: "Localização", address: "Rua Augusta, 1500" },
    ])
  })

  it("só usa a linha localizada e com o endereço de agora — sem prazo de validade", () => {
    const ok = place({ entry_id: "e1", field_id: "f" })
    expect(isPlaceUsable(ok, "Rua Augusta, 1500")).toBe(true)
    // dado do OpenStreetMap não vence: a linha de um ano atrás continua valendo
    expect(isPlaceUsable({ ...ok, geocoded_at: daysAgo(400) }, "Rua Augusta, 1500")).toBe(true)
    expect(isPlaceUsable(ok, "Rua Augusta, 2000")).toBe(false)
    expect(isPlaceUsable({ ...ok, status: "error" }, "Rua Augusta, 1500")).toBe(false)
    expect(isPlaceUsable({ ...ok, lat: null }, "Rua Augusta, 1500")).toBe(false)
    expect(isPlaceUsable(undefined, "Rua Augusta, 1500")).toBe(false)
  })

  it("decide o que vai à busca em cada modo", () => {
    const address = "Rua Augusta, 1500"
    const ok = place({ entry_id: "e1", field_id: "f" })
    const antigo = { ...ok, geocoded_at: daysAgo(400) }
    const naoAchou = { ...ok, status: "not_found" as const, lat: null, lng: null, geocoded_at: daysAgo(2) }
    const pendente = { ...ok, status: "pending" as const }
    const pending = { now: NOW, mode: "pending" as const }
    const retry = { now: NOW, mode: "retry" as const, retryBefore: NOW }

    // pending: novo, mudou ou pendente — não insiste no que falhou, não refaz o que achou
    expect(needsGeocode(address, undefined, pending)).toBe(true)
    expect(needsGeocode("Outra rua", ok, pending)).toBe(true)
    expect(needsGeocode(address, pendente, pending)).toBe(true)
    expect(needsGeocode(address, ok, pending)).toBe(false)
    expect(needsGeocode(address, antigo, pending)).toBe(false)
    expect(needsGeocode(address, naoAchou, pending)).toBe(false)

    // retry: tenta de novo a falha registrada antes do lote começar
    expect(needsGeocode(address, naoAchou, retry)).toBe(true)
    expect(needsGeocode(address, naoAchou, { ...retry, retryBefore: NOW - 3 * DAY })).toBe(false)
    expect(needsGeocode(address, ok, retry)).toBe(false)
  })

  it("monta a fila do acervo inteiro", () => {
    const categories = [{ id: "c1", estrutura: [LOCAL] }]
    const entries: { id: string; category_id: string; custom_fields: CustomFields }[] = [
      { id: "e1", category_id: "c1", custom_fields: { f_local: "Rua Augusta, 1500" } },
      { id: "e2", category_id: "c1", custom_fields: { f_local: "Av. Paulista, 1000" } },
      { id: "e3", category_id: "c1", custom_fields: {} },
      { id: "e4", category_id: "outra", custom_fields: { f_local: "Rua X" } },
    ]
    const places = [place({ entry_id: "e1", field_id: "f_local" })]
    expect(pendingGeocodes(categories, entries, places, { now: NOW, mode: "pending" })).toEqual([
      { entryId: "e2", fieldId: "f_local", address: "Av. Paulista, 1000" },
    ])
  })

  it("aponta as linhas sem campo preenchido por trás", () => {
    const targets = [{ fieldId: "f_local", fieldLabel: "Localização", address: "Rua Augusta" }]
    expect(staleFieldIds([{ field_id: "f_local" }, { field_id: "f_velho" }], targets)).toEqual([
      "f_velho",
    ])
  })

  it("leva a linha para o campo do destino ao mover — e solta a que perdeu o valor", () => {
    const places = [
      place({ entry_id: "e1", field_id: "f_local" }),
      place({ entry_id: "e2", field_id: "f_local" }),
    ]
    const maps = new Map<string, Record<string, string>>([
      ["e1", { f_local: "d_local" }],
      ["e2", {}],
    ])
    const moved = remapPlaces(places, maps)
    expect(moved).toHaveLength(1)
    expect(moved[0]).toMatchObject({ entry_id: "e1", field_id: "d_local", place_id: "ChIJ_augusta" })
  })
})

// ---------------------------------------------------------------------------
// links do Google Maps
// ---------------------------------------------------------------------------

describe("links do Google Maps", () => {
  it("abre pelas coordenadas quando há", () => {
    expect(mapsPlaceUrl({ address: "Rua Augusta, 1500", lat: -23.5, lng: -46.6 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=-23.5%2C-46.6"
    )
  })

  it("sem coordenadas, procura o texto — com acento e espaço escapados", () => {
    expect(mapsPlaceUrl({ address: "Rua São Bento, 100 - Centro" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Rua%20S%C3%A3o%20Bento%2C%20100%20-%20Centro"
    )
  })

  it("monta a rota com origem, destino e modo", () => {
    expect(
      mapsDirectionsUrl({
        destination: { address: "Av. Paulista, 1000", lat: -23.5614, lng: -46.6559 },
        origin: { lat: -23.55, lng: -46.63 },
        travelMode: "walking",
      })
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=-23.55%2C-46.63&destination=-23.5614%2C-46.6559&travelmode=walking"
    )
    expect(mapsDirectionsUrl({ destination: { address: "Café & Cia" } })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Caf%C3%A9%20%26%20Cia"
    )
  })

  it("usa do cache as coordenadas do endereço de agora — o place_id da Geoapify não vai", () => {
    const ok = place({ entry_id: "e1", field_id: "f" })
    expect(mapsTargetOf("Rua Augusta, 1500", ok)).toEqual({
      address: "Rua Augusta, 1500",
      lat: -23.556,
      lng: -46.662,
    })
    // endereço mudou, ou não foi encontrado: só o texto
    expect(mapsTargetOf("Rua Nova, 1", ok)).toEqual({ address: "Rua Nova, 1" })
    expect(mapsTargetOf("Rua Augusta, 1500", { ...ok, status: "not_found" })).toEqual({
      address: "Rua Augusta, 1500",
    })
    expect(mapsTargetOf("Rua Nova, 1", undefined)).toEqual({ address: "Rua Nova, 1" })
  })
})

// ---------------------------------------------------------------------------
// banco desatualizado
// ---------------------------------------------------------------------------

describe("migração ainda não rodada", () => {
  it("reconhece tabela e função que não existem", () => {
    expect(isMissingSchema({ code: "42P01", message: 'relation "public.entry_places" does not exist' })).toBe(true)
    expect(isMissingSchema({ code: "PGRST202", message: "Could not find the function public.prune_entry_places" })).toBe(true)
    expect(isMissingSchema({ code: "PGRST205", message: "Could not find the table 'public.entry_places'" })).toBe(true)
    expect(isMissingSchema({ code: "23505", message: "duplicate key" })).toBe(false)
    expect(isMissingSchema(null)).toBe(false)
  })

  it("explica em português o que fazer", () => {
    expect(translateError({ code: "42P01", message: "relation does not exist" })).toContain(
      "migrações novas"
    )
  })
})

// ---------------------------------------------------------------------------
// pinos e distância
// ---------------------------------------------------------------------------

describe("pinos do mapa", () => {
  const restaurantes = category({
    id: "c1",
    name: "Restaurantes",
    estrutura: [LOCAL, { id: "f_filial", nome: "Filial", tipo: "location" }],
  })
  const filmes = category({ id: "c2", name: "Filmes", estrutura: [{ id: "f_dir", nome: "Diretor", tipo: "str" }] })

  function view(id: string, custom: Record<string, string>, categoryId = "c1") {
    const cat = categoryId === "c1" ? restaurantes : filmes
    return toView(
      {
        id,
        category_id: categoryId,
        owner_id: "u1",
        folder_id: null,
        name: id,
        rating: null,
        image_url: null,
        image_display: {},
        custom_fields: custom,
        display_order: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      cat.estrutura,
      new Map(),
      cat.name
    )
  }

  const views = [
    view("ok", { f_local: "Rua Augusta, 1500", f_filial: "Av. Paulista, 1000" }),
    view("editado", { f_local: "Rua Nova, 1" }),
    view("antigo", { f_local: "Rua Augusta, 1500" }),
    view("naoAchou", { f_local: "asdfgh" }),
    view("semLinha", { f_local: "Rua Sem Linha, 5" }),
    view("vazio", {}),
    view("filme", { f_dir: "Fernando Meirelles" }, "c2"),
  ]
  const places = [
    place({ entry_id: "ok", field_id: "f_local" }),
    place({ entry_id: "ok", field_id: "f_filial", address: "Av. Paulista, 1000", lat: -23.5614, lng: -46.6559, place_id: null }),
    place({ entry_id: "editado", field_id: "f_local", address: "Rua Velha, 9" }),
    place({ entry_id: "antigo", field_id: "f_local", geocoded_at: daysAgo(400) }),
    place({ entry_id: "naoAchou", field_id: "f_local", address: "asdfgh", status: "not_found", lat: null, lng: null }),
  ]

  it("vira pino só o endereço localizado e atual — um por campo, sem prazo", () => {
    const pins = buildPins(views, [restaurantes, filmes], places)
    expect(pins.map((pin) => pin.key)).toEqual(["ok|f_local", "ok|f_filial", "antigo|f_local"])
    expect(pins[1]).toMatchObject({ fieldLabel: "Filial", lat: -23.5614, lng: -46.6559, placeId: null })
    expect(pins[0].category.id).toBe("c1")
  })

  it("lista o resto com o motivo", () => {
    const unplaced = pendingPlaces(views, [restaurantes, filmes], places)
    expect(unplaced.map((item) => [item.entryId, item.reason])).toEqual([
      ["editado", "pending"],
      ["naoAchou", "not_found"],
      ["semLinha", "pending"],
    ])
  })

  it("sabe se alguma categoria tem Localização", () => {
    expect(hasLocationFields([restaurantes, filmes])).toBe(true)
    expect(hasLocationFields([filmes])).toBe(false)
  })

  it("mede a distância em linha reta", () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111_195, -1)
    expect(haversine({ lat: -23.55, lng: -46.63 }, { lat: -23.55, lng: -46.63 })).toBe(0)
    const a = { lat: -23.5505, lng: -46.6333 }
    const b = { lat: -23.5614, lng: -46.6559 }
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6)
    // Praça da Sé → MASP: uns 2,6 km
    expect(haversine(a, b)).toBeGreaterThan(2400)
    expect(haversine(a, b)).toBeLessThan(2800)
  })

  it("corta pelo raio e ordena do mais perto", () => {
    const pins = buildPins(views, [restaurantes, filmes], places)
    const origin = { lat: -23.5614, lng: -46.6559 } // em cima da filial
    // "antigo" e "ok" estão no mesmo ponto: o empate vai pelo nome
    expect(nearby(pins, origin).map((item) => item.pin.key)).toEqual([
      "ok|f_filial",
      "antigo|f_local",
      "ok|f_local",
    ])
    expect(nearby(pins, origin, 500).map((item) => item.pin.key)).toEqual(["ok|f_filial"])
    expect(nearby(pins, origin, 500)[0].distance).toBe(0)
  })

  it("conta as regras ligadas do filtro", () => {
    const unified = unifyFields([restaurantes])
    expect(activeFilterCount(EMPTY_GLOBAL_FILTER, unified)).toBe(0)
    expect(
      activeFilterCount(
        {
          ...EMPTY_GLOBAL_FILTER,
          query: "bar",
          minRating: "3",
          maxRating: "5",
          tagIds: ["t1", "t2"],
          categoryIds: ["c1"],
          fields: {
            [unified[0].key]: { min: "", max: "", value: "augusta" },
            "campo-fora-do-escopo": { min: "", max: "", value: "x" },
          },
        },
        unified
      )
    ).toBe(6)
  })
})

describe("distância e localização do aparelho", () => {
  it("formata a distância", () => {
    expect(formatDistance(0)).toBe("0 m")
    expect(formatDistance(847)).toBe("850 m")
    expect(formatDistance(1234)).toBe("1,2 km")
    expect(formatDistance(2000)).toBe("2 km")
    expect(formatDistance(25_400)).toBe("25 km")
    expect(formatDistance(Number.NaN)).toBe("")
  })

  it("explica cada falha da localização", () => {
    expect(geolocationErrorMessage(1)).toContain("permissões")
    expect(geolocationErrorMessage(2)).toContain("localização do aparelho")
    expect(geolocationErrorMessage(3)).toContain("Demorou")
  })
})

// ---------------------------------------------------------------------------
// Sugestões: horário, preço, resumo e ordem
// ---------------------------------------------------------------------------

describe("sugestões", () => {
  // Kinoshita: terça 12h–15h e 19h–23h30, domingo 12h–16h. Hora de Brasília (-3h).
  const KINOSHITA: OpeningPeriod[] = [
    { open: { day: 2, hour: 12, minute: 0 }, close: { day: 2, hour: 15, minute: 0 } },
    { open: { day: 2, hour: 19, minute: 0 }, close: { day: 2, hour: 23, minute: 30 } },
    { open: { day: 0, hour: 12, minute: 0 }, close: { day: 0, hour: 16, minute: 0 } },
  ]
  const at = (iso: string) => Date.parse(iso)

  it("diz se está aberto agora, na hora local do lugar", () => {
    // terça 13h em Brasília = 16h UTC
    expect(openingStatus(KINOSHITA, -180, at("2026-10-13T16:00:00Z"))).toEqual({
      open: true,
      label: "Aberto agora · fecha às 15:00",
    })
    expect(openingStatus(KINOSHITA, -180, at("2026-10-13T19:30:00Z"))).toEqual({
      open: false,
      label: "Fechado agora · abre às 19:00",
    })
    // terça 23h45: já abriu hoje, só volta domingo
    expect(openingStatus(KINOSHITA, -180, at("2026-10-14T02:45:00Z"))?.label).toBe(
      "Fechado agora · abre dom às 12:00"
    )
    // quarta: não abre
    expect(openingStatus(KINOSHITA, -180, at("2026-10-14T13:00:00Z"))?.label).toBe(
      "Fechado hoje · abre dom às 12:00"
    )
    // sábado à noite: abre amanhã
    expect(openingStatus(KINOSHITA, -180, at("2026-10-17T23:00:00Z"))?.label).toBe(
      "Fechado hoje · abre amanhã às 12:00"
    )
  })

  it("atravessa a meia-noite e a virada da semana", () => {
    const bar: OpeningPeriod[] = [
      { open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
      { open: { day: 6, hour: 22, minute: 0 }, close: { day: 0, hour: 3, minute: 0 } },
    ]
    // sábado 1h: ainda é a noite de sexta
    expect(openingStatus(bar, -180, at("2026-10-17T04:00:00Z"))?.label).toBe(
      "Aberto agora · fecha às 02:00"
    )
    // domingo 1h: ainda é a noite de sábado
    expect(openingStatus(bar, -180, at("2026-10-18T04:00:00Z"))?.label).toBe(
      "Aberto agora · fecha às 03:00"
    )
  })

  it("entende 24 horas e falta de horário", () => {
    const always: OpeningPeriod[] = [{ open: { day: 0, hour: 0, minute: 0 }, close: null }]
    expect(openingStatus(always, -180, NOW)).toEqual({ open: true, label: "Aberto 24 horas" })
    expect(openingStatus(null, -180, NOW)).toBeNull()
  })

  it("sem fuso informado, usa o de Brasília", () => {
    // terça 13h em Brasília
    expect(openingStatus(KINOSHITA, null, at("2026-10-13T16:00:00Z"))?.label).toBe(
      "Aberto agora · fecha às 15:00"
    )
  })

  it("formata o tempo de trajeto", () => {
    expect(formatDuration(30)).toBe("1 min")
    expect(formatDuration(640)).toBe("11 min")
    expect(formatDuration(5400)).toBe("1h 30min")
  })

  it("acha o meu registro de preço", () => {
    expect(
      myPriceOf({
        extras: [
          { id: "a", label: "Pedido", value: "Omakase", tipo: "str", isStar: false, percent: 0 },
          { id: "b", label: "Conta", value: "R$ 45,00", tipo: "currency", isStar: false, percent: 0 },
        ],
      })
    ).toBe("R$ 45,00")
    expect(myPriceOf({ extras: [] })).toBeNull()
  })

  it("monta o resumo sem IA", () => {
    expect(
      ruleSummary({
        typeLabel: "Restaurante · japonesa",
        distance: 847,
        myRating: 4.5,
        tags: ["rodízio", "japonês"],
        notes: "",
      })
    ).toBe("Restaurante (japonesa) a 850 m. Sua nota: 4,5. Tags: rodízio, japonês.")
    expect(
      ruleSummary({ typeLabel: null, distance: 1234, myRating: null, tags: [], notes: "Omakase" })
    ).toBe("A 1,2 km daqui. Você anotou: Omakase.")
    expect(
      ruleSummary({ typeLabel: "pizza", distance: 300, myRating: null, tags: [], notes: "" })
    ).toBe("Pizza a 300 m.")
  })

  it("ordena por distância ou pela minha nota", () => {
    const items = [
      { id: "longe-otimo", distance: 900, myRating: 3 },
      { id: "perto-sem-nota", distance: 100, myRating: null },
      { id: "meio", distance: 500, myRating: 5 },
    ]
    expect(sortSuggestions(items, "distance").map((item) => item.id)).toEqual([
      "perto-sem-nota",
      "meio",
      "longe-otimo",
    ])
    expect(sortSuggestions(items, "mine").map((item) => item.id)).toEqual([
      "meio",
      "longe-otimo",
      "perto-sem-nota",
    ])
  })

  it("sugere o raio que alcança o lugar mais perto", () => {
    expect(radiusThatReaches(1500)).toBe(2000)
    expect(radiusThatReaches(400)).toBe(500)
    expect(radiusThatReaches(30_000)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// horário do OpenStreetMap e o que é o lugar
// ---------------------------------------------------------------------------

describe("horário do OpenStreetMap", () => {
  const at = (iso: string) => Date.parse(iso)

  it("lê dias, várias faixas e 'off'", () => {
    const periods = parseOpeningHours("Mo-Fr 12:00-15:00,19:00-23:30; Sa 12:00-16:00; Su off")
    expect(periods).toHaveLength(11)
    expect(periods?.[0]).toEqual({
      open: { day: 1, hour: 12, minute: 0 },
      close: { day: 1, hour: 15, minute: 0 },
    })
    // terça 13h em Brasília: aberto; domingo: fechado o dia todo
    expect(openingStatus(periods, -180, at("2026-10-13T16:00:00Z"))?.label).toBe(
      "Aberto agora · fecha às 15:00"
    )
    expect(openingStatus(periods, -180, at("2026-10-18T15:00:00Z"))?.label).toBe(
      "Fechado hoje · abre amanhã às 12:00"
    )
  })

  it("entende 24/7 e madrugada", () => {
    expect(openingStatus(parseOpeningHours("24/7"), -180, NOW)?.label).toBe("Aberto 24 horas")
    const noite = parseOpeningHours("Mo-Su 18:00-02:00")
    // sábado 18h → domingo 2h
    expect(noite?.find((period) => period.open.day === 6)).toEqual({
      open: { day: 6, hour: 18, minute: 0 },
      close: { day: 0, hour: 2, minute: 0 },
    })
    // domingo 1h em Brasília: ainda é a noite de sábado
    expect(openingStatus(noite, -180, at("2026-10-18T04:00:00Z"))?.label).toBe(
      "Aberto agora · fecha às 02:00"
    )
  })

  it("junta o período que emenda no seguinte", () => {
    // 00:00-24:00 todo dia é o mesmo que 24/7
    expect(openingStatus(parseOpeningHours("Mo-Su 00:00-24:00"), -180, NOW)?.label).toBe(
      "Aberto 24 horas"
    )
    // sexta até meia-noite, e sábado desde a meia-noite: fecha só às 02:00 de sábado
    const emenda = parseOpeningHours("Fr 18:00-24:00; Sa 00:00-02:00")
    expect(openingStatus(emenda, -180, at("2026-10-17T01:00:00Z"))?.label).toBe(
      "Aberto agora · fecha às 02:00"
    )
  })

  it("deixa a regra de depois valer nos dias que ela cita, e ignora feriado", () => {
    const periods = parseOpeningHours("Mo-Su 10:00-22:00; Su 12:00-18:00; PH off")
    const domingo = periods?.filter((period) => period.open.day === 0)
    expect(domingo).toEqual([
      { open: { day: 0, hour: 12, minute: 0 }, close: { day: 0, hour: 18, minute: 0 } },
    ])
    expect(periods).toHaveLength(7)
  })

  it("aceita faixa de dias que atravessa o fim de semana", () => {
    const days = parseOpeningHours("Fr-Mo 20:00-23:00")?.map((period) => period.open.day)
    expect(days).toEqual([0, 1, 5, 6])
  })

  it("devolve null para o que não sabe ler", () => {
    expect(parseOpeningHours("Jan-Mar Mo-Fr 08:00-12:00")).toBeNull()
    expect(parseOpeningHours("sunrise-sunset")).toBeNull()
    expect(parseOpeningHours("Mo-Fr 08:00+")).toBeNull()
    expect(parseOpeningHours("")).toBeNull()
    expect(parseOpeningHours(null)).toBeNull()
  })

  it("deixa o texto legível em português quando não dá para ler", () => {
    expect(humanizeOpeningHours("Mo-Fr 12:00-15:00; Su off")).toBe("seg-sex 12:00-15:00 · dom fechado")
    expect(humanizeOpeningHours("sunrise-sunset")).toBe("nascer do sol-pôr do sol")
  })
})

describe("o que é o lugar", () => {
  it("usa a categoria mais específica e a cozinha", () => {
    expect(typeLabelOf(["catering", "catering.restaurant"], "japanese;sushi")).toBe(
      "Restaurante · japonesa, sushi"
    )
    expect(typeLabelOf(["catering.cafe"], null)).toBe("Café")
    expect(typeLabelOf(["leisure", "leisure.park"])).toBe("Parque")
    expect(typeLabelOf(["catering.restaurant"], "fusion_asian")).toBe("Restaurante · fusion asian")
  })

  it("sem nada conhecido, não inventa", () => {
    expect(typeLabelOf([], "pizza")).toBe("pizza")
    expect(typeLabelOf(["building"], null)).toBeNull()
    expect(typeLabelOf([], null)).toBeNull()
  })
})
