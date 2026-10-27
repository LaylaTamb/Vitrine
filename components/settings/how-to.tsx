import Link from "next/link"
import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

const LINK = "text-foreground underline underline-offset-2 transition-colors hover:text-brand"

/**
 * Configurações → Como usar: o Vitrine explicado por assunto, em blocos que
 * abrem com um toque (`<details>`, sem JavaScript). Texto de uso — o técnico
 * mora no GUIA-LOCAL.
 */
export function HowTo() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      <Topic title="Os lugares do app" open>
        <p>Embaixo (no celular) ou na lateral (no computador) ficam os cinco lugares:</p>
        <ul>
          <li>
            <b>Início</b>: o que as pessoas que você segue acabaram de catalogar.
          </li>
          <li>
            <b>Descobrir</b>: achar pessoas e categorias de outras pessoas, numa busca só.
          </li>
          <li>
            <b>Match</b>: comparar gostos com amigos.
          </li>
          <li>
            <b>Avisos</b> (o sininho): novos seguidores, convites de match, importações.
          </li>
          <li>
            <b>Perfil</b> (a sua foto): o seu cartão e, embaixo, as suas Coleções, Favoritas e Mapa.
          </li>
        </ul>
        <p>
          O <b>＋ Adicionar</b> cria um item, uma categoria ou uma pasta, e traz coisas de fora
          (Google Maps, Letterboxd, Steam, backup). O ícone de <b>QR</b> faz amizade na hora.
        </p>
      </Topic>

      <Topic title="Organizar: pastas, categorias e itens">
        <p>
          <b>Categorias</b> guardam os itens (Restaurantes, Filmes…) e cada uma tem os <b>campos</b>{" "}
          que você quiser: Bairro, Preço, Diretor, uma lista de opções, uma Localização.{" "}
          <b>Pastas</b> agrupam categorias, e dentro de uma categoria dá para criar <b>subpastas</b>{" "}
          para os itens.
        </p>
        <ul>
          <li>
            Para mudar a ordem ou levar algo para dentro de uma pasta, <b>arraste pela alça</b> (no
            celular, segure um instante as subpastas).
          </li>
          <li>
            Editar, renomear e excluir ficam no <b>⋯</b> do topo de cada pasta, categoria e item.
          </li>
          <li>
            Apagou sem querer? O aviso tem <b>Desfazer</b>, e a <b>Lixeira</b> guarda pastas e
            categorias por 30 dias.
          </li>
          <li>
            A <b>A organizar</b> é a caixa de entrada: o que você salva às pressas cai nela, e
            depois você move para o lugar certo.
          </li>
        </ul>
      </Topic>

      <Topic title="Adicionar itens">
        <ul>
          <li>
            Dentro de uma categoria, toque em <b>＋ Item</b>: nome, imagem (cole o link), nota,
            campos e tags.
          </li>
          <li>
            De qualquer lugar: <b>＋ Adicionar → Item</b>, digite o nome e escolha a categoria num
            toque.
          </li>
          <li>
            No celular, com o app instalado, use o <b>Compartilhar</b> de outro app (no Android)
            para salvar um link ou um texto.
          </li>
        </ul>
      </Topic>

      <Topic title="Quem vê o quê">
        <p>
          Cada pasta e cada categoria tem um selo ao lado do nome: <b>Pública</b> (todo mundo, até
          sem conta), <b>Amigos</b> (quem você segue e segue você de volta) ou <b>Privada</b> (só
          você). Uma pasta privada esconde tudo o que está dentro dela.
        </p>
        <p>
          O padrão para as próximas fica em{" "}
          <Link href="/configuracoes?secao=privacidade" className={LINK}>
            Quem vê o que você cria
          </Link>
          .
        </p>
      </Topic>

      <Topic title="Achar e ver do seu jeito">
        <ul>
          <li>
            A <b>busca das Coleções</b> acha pastas, categorias e itens — pelo nome, pelas tags ou
            pelo que está nos campos.
          </li>
          <li>
            O botão <b>Filtros</b> das Coleções cruza todas as categorias de uma vez (nota, tags,
            campos). Dentro de uma categoria, o <b>Filtros</b> olha só ela.
          </li>
          <li>
            Veja os itens em grade, lista ou <b>tier list</b> (pelas notas). A aba <b>Números</b>{" "}
            resume a categoria.
          </li>
          <li>
            A <b>estrela</b> de uma categoria a leva para a aba <b>Favoritas</b> do perfil, sem
            tirar da pasta.
          </li>
          <li>
            Tudo o que tem Localização vira pino no <b>Mapa</b>. Com a localização liberada, o
            Vitrine pergunta “Você está em…?” quando você chega num lugar.
          </li>
        </ul>
      </Topic>

      <Topic title="Amigos, QR e bloqueio">
        <ul>
          <li>
            Siga quem quiser. Quando os dois se seguem, vocês viram <b>amigos</b> e veem o que o
            outro deixou para Amigos.
          </li>
          <li>
            No <b>QR de amizade</b>, mostre o seu QR ou leia o de alguém: escaneou, viraram amigos
            na hora.
          </li>
          <li>
            No <b>⋯</b> do perfil de alguém dá para <b>bloquear</b>: some tudo de um para o outro.
          </li>
        </ul>
      </Topic>

      <Topic title="Descobrir e Match">
        <ul>
          <li>
            No <b>Descobrir</b>, toque em <b>Pegar com os itens</b> numa categoria de outra pessoa:
            você ganha uma cópia que continua recebendo as novidades dela.
          </li>
          <li>
            No <b>Match</b>, chame até 7 amigos. Quando todos aceitam, cada um ganha uma cópia só
            com as categorias em comum, a % de compatibilidade, o que vocês têm em comum e as
            sugestões — com <b>Trazer</b> para levar um item para o seu acervo.
          </li>
        </ul>
      </Topic>

      <Topic title="Seu perfil e compartilhar">
        <ul>
          <li>
            Em <b>Editar perfil</b>: banner, foto, nome, bio, até 6 categorias em destaque e as suas
            redes. A bio aceita <b>negrito</b>, <i>itálico</i>, <u>sublinhado</u>, <s>riscado</s> e
            links: selecione um trecho e toque num dos botões acima da caixa.
          </li>
          <li>
            <b>Compartilhar</b> (no perfil) copia o link, gera a imagem para o story e mostra o seu
            QR. No <b>⋯</b> de uma categoria, <b>Compartilhar</b> mostra o QR e o link dela.
          </li>
        </ul>
      </Topic>

      <Topic title="Trazer o que você já tem">
        <ul>
          <li>
            <b>Google Maps</b>: as listas de lugares salvos, pelo arquivo que o Google exporta (no{" "}
            <Link href="/importar" className={LINK}>
              Importar
            </Link>
            ).
          </li>
          <li>
            <b>Letterboxd</b>: pelo seu @, os filmes novos do diário chegam sozinhos — com a resenha
            e, aos poucos, diretor, gênero, duração, país e sinopse (em{" "}
            <Link href="/configuracoes?secao=letterboxd" className={LINK}>
              Letterboxd
            </Link>
            ); o histórico inteiro vem pelo arquivo, no Importar.
          </li>
          <li>
            <b>Steam</b>: conecte e seus jogos chegam com as horas jogadas — e, aos poucos, o
            gênero, a desenvolvedora, o ano e as suas conquistas (em{" "}
            <Link href="/configuracoes?secao=steam" className={LINK}>
              Steam
            </Link>
            ). Os dois se atualizam todo dia e quando você abre a categoria deles.
          </li>
          <li>
            <b>Backup</b>: exporte o acervo inteiro num arquivo e importe quando quiser (em{" "}
            <Link href="/configuracoes?secao=backup" className={LINK}>
              Backup
            </Link>
            ).
          </li>
        </ul>
      </Topic>
    </div>
  )
}

function Topic({
  title,
  open = false,
  children,
}: {
  title: string
  open?: boolean
  children: ReactNode
}) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hi [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-sm font-medium">{title}</span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </details>
  )
}
