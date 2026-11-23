import Link from "next/link"

import { CoverMosaic } from "@/components/collection/collection-card"
import { Navbar } from "@/components/layout/navbar"
import { buttonVariants } from "@/components/ui/button"
import { authHref } from "@/lib/domain/auth"
import type { ExploreCategory } from "@/lib/domain/explore"
import { itemCount } from "@/lib/domain/format"
import { cn } from "@/lib/utils"

/** Para onde o "Explorar sem conta" leva: as Sugestões do Início. */
export const GUEST_EXPLORE_HREF = "/inicio?aba=sugestoes"

const HOW = [
  {
    icon: "🗂️",
    title: "Catalogue",
    text: "Pastas, categorias com os campos que você quiser e uma nota para cada item.",
  },
  {
    icon: "📲",
    title: "Mostre",
    text: "Pública, só para amigos ou privada. E a lista vira imagem para o story.",
  },
  {
    icon: "💞",
    title: "Compare",
    text: "Faça um match com amigos e descubra o que vocês têm em comum.",
  },
]

/**
 * `/` sem conta: as boas-vindas. O que é o Vitrine, listas Públicas de verdade
 * como exemplo (as mais copiadas, pela `explore_public_categories` — sem o 50,
 * a seção some) e os botões Criar conta e Explorar sem conta.
 */
export function Welcome({
  examples,
  covers,
}: {
  examples: ExploreCategory[]
  /** category_id → até 3 fotos. */
  covers: Record<string, string[]>
}) {
  const signUp = authHref("/cadastro", GUEST_EXPLORE_HREF)
  return (
    <div className="min-h-dvh bg-[radial-gradient(700px_420px_at_80%_-10%,var(--brand-wash),transparent_70%)]">
      <Navbar visitor={{ next: "/" }} />
      <main className="mx-auto max-w-4xl space-y-12 px-4 pt-10 pb-20 sm:px-6">
        <section className="space-y-5">
          <p className="plaque">A sua rede de gostos</p>
          <h1 className="display max-w-2xl text-[2.6rem] leading-[1.05] sm:text-6xl">
            Guarde o que você ama. Mostre para quem quiser.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Restaurantes, filmes, livros, jogos, viagens: catalogue do seu jeito, com as suas notas,
            e compartilhe em um toque.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Link href={signUp} className={buttonVariants({ size: "lg" })}>
              Criar conta grátis
            </Link>
            <Link
              href={GUEST_EXPLORE_HREF}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Explorar sem conta
            </Link>
          </div>
          <p className="text-xs text-faint">
            Sem cadastro, você vê as listas públicas de quem já está aqui.
          </p>
        </section>

        <section aria-label="Como funciona" className="grid gap-3 sm:grid-cols-3">
          {HOW.map((item) => (
            <div key={item.title} className="rounded-2xl border border-line bg-surface p-4">
              <span aria-hidden className="text-2xl">
                {item.icon}
              </span>
              <h2 className="mt-2 text-[0.95rem] font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </section>

        {examples.length > 0 ? (
          <section aria-labelledby="exemplos" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="exemplos" className="display text-2xl">
                Listas de quem já está aqui
              </h2>
              <Link
                href={GUEST_EXPLORE_HREF}
                className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
              >
                Ver mais
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {examples.map((category) => {
                const photos = covers[category.id] ?? []
                return (
                  <li key={category.id} className="min-w-0">
                    <Link
                      href={`/categoria/${category.id}`}
                      className="block overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-hi"
                    >
                      {photos.length > 0 ? (
                        <CoverMosaic photos={photos} />
                      ) : (
                        <span className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-surface-hi to-bg-soft text-4xl leading-none">
                          {category.icon || "📁"}
                        </span>
                      )}
                      <span className="block px-3 py-2.5">
                        <span className="display block truncate text-base">
                          {category.icon && photos.length > 0 ? `${category.icon} ` : ""}
                          {category.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{category.owner.username} · {itemCount(category.total)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <section
          className={cn(
            "rounded-2xl border border-brand-dim bg-brand-wash px-5 py-7 text-center",
            examples.length === 0 && "mt-4"
          )}
        >
          <h2 className="display text-[1.7rem]">Monte a sua vitrine em um minuto</h2>
          <p className="mt-1 mb-4 text-muted-foreground">
            É grátis. Você escolhe o que fica público.
          </p>
          <Link href={signUp} className={buttonVariants({ size: "lg" })}>
            Criar conta
          </Link>
        </section>

        <nav aria-label="Textos legais" className="flex justify-center gap-5 text-xs text-faint">
          <Link href="/termos" className="hover:text-foreground">
            Termos
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Já tenho conta
          </Link>
        </nav>
      </main>
    </div>
  )
}
