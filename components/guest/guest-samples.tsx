"use client"

import { useGuestInvite } from "@/components/guest/guest-invite"
import { Button } from "@/components/ui/button"

/**
 * As amostras do visitante (modo visitante): o que o Match e o Mapa fazem,
 * com dados de exemplo fixos — nada do banco — e o convite no fim.
 */

function SampleTag() {
  return (
    <span className="inline-flex w-fit rounded-full border border-dashed border-line-hi px-2.5 py-0.5 text-xs text-faint">
      Exemplo
    </span>
  )
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-2 pt-6">
      <SampleTag />
      <h1 className="display text-[2rem] leading-tight">{title}</h1>
      <p className="max-w-xl text-muted-foreground">{text}</p>
    </div>
  )
}

/** Duas pessoas de exemplo: a cor do anel e a letra. */
const PEOPLE = [
  { letter: "A", color: "#c9879b", fill: "#9c6a7a" },
  { letter: "B", color: "#7fb39f", fill: "#5f8a7a" },
]

const PICKS = [
  { icon: "☕", name: "Sofá Café", why: "em comum" },
  { icon: "🎬", name: "Hereditário", why: "sugestão de @ana" },
  { icon: "📚", name: "Torto Arado", why: "descoberta" },
]

/** `/matches` sem conta: como um match funciona, com um exemplo. */
export function MatchSample() {
  const invite = useGuestInvite()
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-10">
      <Intro
        title="Match: o que vocês têm em comum"
        text="Chame até 7 amigos. O Vitrine junta as listas de vocês, mostra a % de compatibilidade e uma lista nova por dia."
      />
      <div className="space-y-4 rounded-2xl border border-line bg-gradient-to-b from-brand-wash to-surface p-5">
        <div className="flex justify-center">
          {PEOPLE.map((person, index) => (
            <span
              key={person.letter}
              aria-hidden
              className="flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{
                background: person.fill,
                border: `3px solid ${person.color}`,
                marginLeft: index === 0 ? 0 : -14,
              }}
            >
              {person.letter}
            </span>
          ))}
        </div>
        <p className="text-center text-5xl leading-none font-semibold text-brand">78%</p>
        <p className="text-center text-sm text-muted-foreground">
          Vocês dois dão 5 estrelas para cafés de coado e filmes de terror.
        </p>
        <ul className="divide-y divide-line border-t border-line">
          {PICKS.map((pick) => (
            <li key={pick.name} className="flex items-center gap-2.5 py-2.5 text-sm">
              <span aria-hidden>{pick.icon}</span>
              <span className="min-w-0 flex-1 truncate">{pick.name}</span>
              <span className="shrink-0 text-xs text-faint">{pick.why}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button size="lg" className="w-full" onClick={() => invite?.({ kind: "match" })}>
        Criar conta para fazer um match
      </Button>
    </div>
  )
}

/** Os alfinetes do mapa de exemplo: onde ficam (em %) e o ícone. */
const PINS = [
  { left: "22%", top: "30%", icon: "☕" },
  { left: "55%", top: "45%", icon: "🍜" },
  { left: "38%", top: "62%", icon: "🍕" },
  { left: "70%", top: "22%", icon: "🍷" },
]

/** `/mapa` sem conta: o mapa das listas, com um exemplo (sem mapa de verdade). */
export function MapSample() {
  const invite = useGuestInvite()
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-10">
      <Intro
        title="Tudo o que você guardou, no mapa"
        text="Restaurantes, cafés e viagens das suas listas aparecem no mapa, com o que está perto de você agora."
      />
      <div
        aria-hidden
        className="relative h-72 overflow-hidden rounded-2xl border border-line"
        style={{
          background:
            "linear-gradient(90deg, transparent 49%, rgb(255 255 255 / 0.04) 50%, transparent 51%) 0 0 / 60px 60px, linear-gradient(0deg, transparent 49%, rgb(255 255 255 / 0.04) 50%, transparent 51%) 0 0 / 60px 60px, radial-gradient(circle at 30% 40%, #22303a, #17191d 70%)",
        }}
      >
        {PINS.map((pin) => (
          <span
            key={pin.icon}
            className="absolute flex size-9 -rotate-45 items-center justify-center rounded-[999px_999px_999px_4px] border-2 border-bg bg-brand"
            style={{ left: pin.left, top: pin.top }}
          >
            <span className="rotate-45 text-base">{pin.icon}</span>
          </span>
        ))}
      </div>
      <Button size="lg" className="w-full" onClick={() => invite?.({ kind: "map" })}>
        Criar conta para montar o seu mapa
      </Button>
    </div>
  )
}
