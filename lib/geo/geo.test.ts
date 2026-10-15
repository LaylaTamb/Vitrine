import { describe, expect, it } from "vitest"

import {
  geoErrorMessage,
  geoHttpErrorReason,
  parseGeocodeResponse,
  parsePlaceDetails,
  parseRouteMatrix,
} from "./parse"

// ---------------------------------------------------------------------------
// Respostas de exemplo da Geoapify (encurtadas)
// ---------------------------------------------------------------------------

const GEOCODE_OK = {
  results: [
    {
      lat: -23.5568,
      lon: -46.6617,
      formatted: "Rua Augusta, 1500, Consolação, São Paulo - SP, 01304-001, Brasil",
      place_id: "51abc_augusta",
      result_type: "building",
      rank: { confidence: 0.95, match_type: "full_match" },
      timezone: { name: "America/Sao_Paulo", offset_STD_seconds: -10800 },
    },
  ],
  query: { text: "Rua Augusta, 1500, São Paulo" },
}

describe("Geocoding", () => {
  it("devolve as coordenadas do primeiro resultado", () => {
    expect(parseGeocodeResponse(GEOCODE_OK)).toEqual({
      status: "ok",
      lat: -23.5568,
      lng: -46.6617,
      placeId: "51abc_augusta",
      formattedAddress: "Rua Augusta, 1500, Consolação, São Paulo - SP, 01304-001, Brasil",
    })
  })

  it("sem resultado é 'não encontrado'", () => {
    expect(parseGeocodeResponse({ results: [], query: { text: "asdfgh" } })).toEqual({
      status: "not_found",
    })
  })

  it("chute de baixa confiança, ou só o estado, também é 'não encontrado'", () => {
    const chute = { results: [{ ...GEOCODE_OK.results[0], rank: { confidence: 0.2 } }] }
    expect(parseGeocodeResponse(chute)).toEqual({ status: "not_found" })
    const estado = {
      results: [{ ...GEOCODE_OK.results[0], result_type: "state", rank: { confidence: 1 } }],
    }
    expect(parseGeocodeResponse(estado)).toEqual({ status: "not_found" })
  })

  it("resposta torta é erro, não 'não encontrado'", () => {
    expect(parseGeocodeResponse(null)).toEqual({ status: "error", reason: "unknown" })
    expect(parseGeocodeResponse("<html>502</html>")).toEqual({ status: "error", reason: "unknown" })
    expect(parseGeocodeResponse({ results: [{ lat: "x", lon: 1 }] })).toEqual({
      status: "error",
      reason: "unknown",
    })
  })

  it("aceita resultado sem place_id nem endereço formatado", () => {
    expect(parseGeocodeResponse({ results: [{ lat: 1, lon: 2 }] })).toEqual({
      status: "ok",
      lat: 1,
      lng: 2,
      placeId: null,
      formattedAddress: null,
    })
  })

  it("traduz o status HTTP de erro e explica em português", () => {
    expect(geoHttpErrorReason(429)).toBe("quota")
    expect(geoHttpErrorReason(401)).toBe("denied")
    expect(geoHttpErrorReason(400)).toBe("invalid")
    expect(geoHttpErrorReason(500)).toBe("unknown")
    expect(geoErrorMessage("no-key")).toContain("GEOAPIFY_API_KEY")
    expect(geoErrorMessage("quota")).toContain("créditos")
    expect(geoErrorMessage("denied")).toContain("recusou")
  })
})

// ---------------------------------------------------------------------------
// Place Details
// ---------------------------------------------------------------------------

const DETAILS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        feature_type: "building",
        categories: ["building"],
      },
    },
    {
      type: "Feature",
      properties: {
        feature_type: "details",
        name: "Kinoshita",
        categories: ["catering", "catering.restaurant"],
        catering: { cuisine: "japanese" },
        opening_hours: "Tu-Sa 12:00-15:00,19:00-23:30; Su 12:00-16:00",
        website: "https://www.kinoshita.com.br/",
        contact: { phone: "+55 11 3849-6940" },
        timezone: { name: "America/Sao_Paulo", offset_STD_seconds: -10800 },
      },
    },
  ],
}

describe("Place Details", () => {
  it("lê a feição de detalhes", () => {
    const details = parsePlaceDetails(DETAILS, "51abc_kinoshita")
    expect(details).toMatchObject({
      placeId: "51abc_kinoshita",
      name: "Kinoshita",
      typeLabel: "Restaurante · japonesa",
      openingHoursText: "Tu-Sa 12:00-15:00,19:00-23:30; Su 12:00-16:00",
      utcOffsetMinutes: -180,
      phone: "+55 11 3849-6940",
      website: "https://www.kinoshita.com.br/",
    })
    // terça a sábado, duas faixas; domingo, uma
    expect(details?.periods).toHaveLength(11)
  })

  it("aguenta lugar com pouca informação, e horário que não sabe ler", () => {
    const details = parsePlaceDetails(
      {
        features: [
          { properties: { feature_type: "details", name: "Praça", opening_hours: "sunrise-sunset" } },
        ],
      },
      "x"
    )
    expect(details).toMatchObject({
      name: "Praça",
      typeLabel: null,
      periods: null,
      openingHoursText: "sunrise-sunset",
      utcOffsetMinutes: null,
      phone: null,
      website: null,
    })
    expect(parsePlaceDetails({ features: [] }, "x")).toBeNull()
    expect(parsePlaceDetails(null, "x")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Route Matrix
// ---------------------------------------------------------------------------

describe("Route Matrix", () => {
  it("põe cada trajeto no destino certo", () => {
    const body = {
      sources: [{ original_location: [-46.65, -23.56] }],
      targets: [{}, {}, {}],
      sources_to_targets: [
        [
          { distance: 850, time: 640, source_index: 0, target_index: 0 },
          { distance: null, time: null, source_index: 0, target_index: 1 },
          { distance: 3200, time: 2460, source_index: 0, target_index: 2 },
        ],
      ],
    }
    expect(parseRouteMatrix(body, 3)).toEqual([
      { distanceMeters: 850, durationSeconds: 640 },
      null,
      { distanceMeters: 3200, durationSeconds: 2460 },
    ])
  })

  it("ignora resposta torta", () => {
    expect(parseRouteMatrix(null, 2)).toEqual([null, null])
    expect(parseRouteMatrix({ statusCode: 401, error: "Unauthorized" }, 2)).toEqual([null, null])
    expect(parseRouteMatrix({ sources_to_targets: [[{ distance: 1, time: 1, target_index: 9 }]] }, 2)).toEqual([
      null,
      null,
    ])
  })
})
