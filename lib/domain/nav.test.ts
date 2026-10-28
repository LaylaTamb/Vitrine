import { describe, expect, it } from "vitest"

import { navSectionOf } from "./nav"

describe("navegação", () => {
  it("acende o lugar certo", () => {
    expect(navSectionOf("/", "marina")).toBe("perfil")
    expect(navSectionOf("/inicio", "marina")).toBe("inicio")
    expect(navSectionOf("/explorar", "marina")).toBe("descobrir")
    expect(navSectionOf("/matches", "marina")).toBe("match")
    expect(navSectionOf("/avisos", "marina")).toBe("avisos")
    expect(navSectionOf("/configuracoes", "marina")).toBe("config")
    expect(navSectionOf("/lixeira", "marina")).toBe("config")
    expect(navSectionOf("/categoria/c1/e1", "marina")).toBe("perfil")
    expect(navSectionOf("/qr", "marina")).toBe("qr")
  })

  it("o seu perfil é Perfil; o de outra pessoa, Descobrir", () => {
    expect(navSectionOf("/v/marina", "marina")).toBe("perfil")
    expect(navSectionOf("/v/Marina/seguidores", "marina")).toBe("perfil")
    expect(navSectionOf("/v/marinaa", "marina")).toBe("descobrir")
    expect(navSectionOf("/v/ana", "marina")).toBe("descobrir")
  })

  it("prefixo parecido não conta", () => {
    expect(navSectionOf("/matchesx", "marina")).toBeNull()
    expect(navSectionOf("/termos", "marina")).toBeNull()
  })
})
