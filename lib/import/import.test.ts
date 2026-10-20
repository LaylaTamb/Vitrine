import { deflateRawSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import { csvRecords, parseCsv } from "./csv"
import {
  coordsFromMapsUrl,
  googleSourceId,
  listNameFromPath,
  mergeGoogleLists,
  parseGoogleFile,
  STARRED_LIST,
} from "./google"
import { letterboxdKind, mergeLetterboxd } from "./letterboxd"
import { listZip, readZipText } from "./zip"

/** Monta um .zip pequeno (deflate) para o teste, como o Takeout faria. */
function makeZip(files: Record<string, string>): Blob {
  const encoder = new TextEncoder()
  const locals: Uint8Array<ArrayBuffer>[] = []
  const centrals: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Uint8Array.from(encoder.encode(name))
    const raw = encoder.encode(content)
    const data = Uint8Array.from(deflateRawSync(raw))
    const local = new DataView(new ArrayBuffer(30 + nameBytes.length))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(8, 8, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, raw.length, true)
    local.setUint16(26, nameBytes.length, true)
    new Uint8Array(local.buffer).set(nameBytes, 30)
    const central = new DataView(new ArrayBuffer(46 + nameBytes.length))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(10, 8, true)
    central.setUint32(20, data.length, true)
    central.setUint32(24, raw.length, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint32(42, offset, true)
    new Uint8Array(central.buffer).set(nameBytes, 46)
    locals.push(new Uint8Array(local.buffer), data)
    centrals.push(new Uint8Array(central.buffer))
    offset += local.byteLength + data.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, centrals.length, true)
  end.setUint16(10, centrals.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)])
}

describe("CSV", () => {
  it("aspas, vírgula e quebra de linha dentro de aspas, CRLF e BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","linha 1\nlinha 2"\r\n"diz ""oi""",\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", "linha 1\nlinha 2"],
      ['diz "oi"', ""],
    ])
  })

  it("vira objetos pelo cabeçalho (sem acento, minúsculo)", () => {
    expect(csvRecords("Título,URL\nCafé,http://x\n").records).toEqual([
      { titulo: "Café", url: "http://x" },
    ])
  })
})

describe(".zip sem dependência", () => {
  it("lista e lê os arquivos", async () => {
    const zip = makeZip({
      "Takeout/Salvos/Quero ir.csv": "Title,Note,URL\nCafé,,https://maps.google.com/?q=1\n",
      "Takeout/Outro/foto.txt": "nada",
    })
    const entries = await listZip(zip)
    expect(entries.map((entry) => entry.name)).toEqual([
      "Takeout/Salvos/Quero ir.csv",
      "Takeout/Outro/foto.txt",
    ])
    expect(await readZipText(zip, entries[0])).toContain("Café")
  })

  it("recusa o que não é zip", async () => {
    await expect(listZip(new Blob(["não sou zip"]))).rejects.toThrow()
  })
})

describe("Google Takeout", () => {
  const savedPlaces = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-46.6617, -23.5568] },
        properties: {
          google_maps_url: "http://maps.google.com/?cid=1",
          location: { name: "Café do Ponto", address: "Rua Augusta, 1500" },
          Comment: "Pão de queijo bom",
        },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          "Google Maps URL": "http://maps.google.com/?cid=2",
          Location: { "Business Name": "Bar Antigo", Address: "Rua B" },
        },
      },
    ],
  })

  it("salvos com estrela (formato novo e antigo)", () => {
    const list = parseGoogleFile("Takeout/Maps (seus lugares)/Lugares salvos.json", savedPlaces)
    expect(list?.name).toBe(STARRED_LIST)
    expect(list?.places).toEqual([
      {
        title: "Café do Ponto",
        note: "Pão de queijo bom",
        url: "http://maps.google.com/?cid=1",
        address: "Rua Augusta, 1500",
        lat: -23.5568,
        lng: -46.6617,
      },
      {
        title: "Bar Antigo",
        note: null,
        url: "http://maps.google.com/?cid=2",
        address: "Rua B",
        lat: null,
        lng: null,
      },
    ])
  })

  it("uma lista em .csv, em inglês ou português, e coordenadas no link", () => {
    const csv =
      "Título,Observação,URL,Comentário\n" +
      'Padaria,"Ir cedo",https://www.google.com/maps/place/Padaria/data=!3d-23.5!4d-46.6,\n' +
      "Sem link,,,\n"
    const list = parseGoogleFile("Takeout/Salvos/Quero ir.csv", csv)
    expect(list).toEqual({
      name: "Quero ir",
      places: [
        {
          title: "Padaria",
          note: "Ir cedo",
          url: "https://www.google.com/maps/place/Padaria/data=!3d-23.5!4d-46.6",
          address: null,
          lat: -23.5,
          lng: -46.6,
        },
      ],
    })
    expect(parseGoogleFile("Takeout/Outro/qualquer.csv", "a,b\n1,2\n")).toBeNull()
    expect(parseGoogleFile("x.json", "{}")).toBeNull()
  })

  it("coordenadas no link, nome da lista e o source_id", () => {
    expect(coordsFromMapsUrl("https://maps.google.com/@-23.55,-46.66,17z")).toEqual({
      lat: -23.55,
      lng: -46.66,
    })
    expect(coordsFromMapsUrl("https://maps.google.com/?q=0,0")).toBeNull()
    expect(listNameFromPath("Takeout\\Saved\\Favoritos.csv")).toBe("Favoritos")
    expect(googleSourceId("Quero ir", "https://x")).toBe("Quero ir|https://x")
  })

  it("junta listas repetidas e tira lugares repetidos", () => {
    const place = { title: "A", note: null, url: "u1", address: null, lat: null, lng: null }
    expect(
      mergeGoogleLists([
        { name: "L", places: [place] },
        { name: "L", places: [place, { ...place, url: "u2" }] },
        { name: "Vazia", places: [] },
      ])
    ).toEqual([{ name: "L", places: [place, { ...place, url: "u2" }] }])
  })
})

describe("Letterboxd", () => {
  it("reconhece os arquivos e ignora a watchlist", () => {
    expect(letterboxdKind("letterboxd-ana/watched.csv")).toBe("watched")
    expect(letterboxdKind("diary.csv")).toBe("diary")
    expect(letterboxdKind("watchlist.csv")).toBeNull()
  })

  it("junta assistidos, notas, diário e resenhas", () => {
    const films = mergeLetterboxd({
      watched:
        "Date,Name,Year,Letterboxd URI\n" +
        "2024-01-02,Duna,2021,https://boxd.it/a\n" +
        "2024-03-01,Aftersun,2022,https://boxd.it/b\n",
      ratings: "Date,Name,Year,Letterboxd URI,Rating\n2024-01-03,Duna,2021,https://boxd.it/a,4.5\n",
      diary:
        "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n" +
        "2024-01-03,Duna,2021,https://boxd.it/x1,4,,,2024-01-02\n" +
        "2024-06-10,Aftersun,2022,https://boxd.it/x2,5,,,2024-06-09\n" +
        "2024-02-10,Aftersun,2022,https://boxd.it/x3,3,,,2024-02-09\n",
      reviews:
        "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n" +
        '2024-06-10,Aftersun,2022,https://boxd.it/x2,5,,"Chorei, de novo.",,2024-06-09\n',
    })
    expect(films).toEqual([
      {
        key: "https://boxd.it/a",
        name: "Duna",
        year: 2021,
        rating: 4.5,
        watchedDate: "2024-01-02",
        review: null,
      },
      {
        key: "https://boxd.it/b",
        name: "Aftersun",
        year: 2022,
        rating: 5,
        watchedDate: "2024-06-09",
        review: "Chorei, de novo.",
      },
    ])
  })
})
