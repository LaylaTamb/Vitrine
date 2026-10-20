import { describe, expect, it } from "vitest"

import {
  distanceLabel,
  isValidPoint,
  nearbyCacheCenter,
  parsePlaceRatings,
  placeAddressText,
  placeTargets,
} from "./nearby"

describe("lugares por perto", () => {
  it("arredonda o centro numa grade de ~55 m", () => {
    expect(nearbyCacheCenter({ lat: -23.55712, lng: -46.66038 })).toEqual({
      lat: -23.557,
      lng: -46.6605,
    })
  })

  it("confere o ponto e escreve a distância", () => {
    expect(isValidPoint({ lat: -23.5, lng: -46.6 })).toBe(true)
    expect(isValidPoint({ lat: 120, lng: 0 })).toBe(false)
    expect(isValidPoint({ lat: Number.NaN, lng: 0 })).toBe(false)
    expect(distanceLabel(8)).toBe("aqui")
    expect(distanceLabel(43)).toBe("a 40 m")
    expect(distanceLabel(1234)).toBe("a 1,2 km")
  })

  it("o endereço do item: o da Geoapify, senão o nome", () => {
    expect(placeAddressText({ name: "Café", address: "Rua A, 1" })).toBe("Rua A, 1")
    expect(placeAddressText({ name: "Café", address: null })).toBe("Café")
  })
})

describe("No Vitrine", () => {
  it("lê as avaliações e onde já está no seu acervo", () => {
    expect(
      parsePlaceRatings({
        count: 2,
        average: 4.5,
        ratings: [
          { username: "ana", rating: 5, is_me: false },
          { username: "eu", rating: "4", is_me: true },
          { username: "", rating: 3 },
        ],
        mine: [{ entry_id: "e1", category_id: "c1", category_name: "Cafés" }, { entry_id: "x" }],
      })
    ).toEqual({
      count: 2,
      average: 4.5,
      ratings: [
        { username: "ana", rating: 5, isMe: false },
        { username: "eu", rating: 4, isMe: true },
      ],
      mine: [{ entryId: "e1", categoryId: "c1", categoryName: "Cafés" }],
    })
    expect(parsePlaceRatings(null)).toEqual({ count: 0, average: null, ratings: [], mine: [] })
  })
})

describe("para onde vai o lugar", () => {
  it("com Localização primeiro, depois a A organizar, depois as outras", () => {
    const location = [{ id: "f_loc", nome: "Endereço", tipo: "location" as const }]
    const targets = placeTargets([
      { id: "a", name: "Livros", icon: null, estrutura: [], kind: undefined, rating_enabled: true, display_order: 0 },
      { id: "b", name: "A organizar", icon: "📥", estrutura: location, kind: "inbox", rating_enabled: true, display_order: 1 },
      { id: "c", name: "Restaurantes", icon: "🍽️", estrutura: location, kind: undefined, rating_enabled: true, display_order: 2 },
      { id: "d", name: "Bares", icon: "🍺", estrutura: location, kind: undefined, rating_enabled: false, display_order: 3 },
    ])
    expect(targets.map((target) => target.id)).toEqual(["c", "d", "b", "a"])
    expect(targets[0]).toMatchObject({ hasLocation: true, inbox: false })
  })
})
