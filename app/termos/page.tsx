import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { DATA_CONTROLLER, MINIMUM_AGE } from "@/lib/domain/terms"

export const metadata: Metadata = { title: "Termos de uso · Vitrine" }

/**
 * `/termos` — os Termos de uso. Abre sem login (middleware).
 *
 * Mudou o texto? Troque `TERMS_VERSION` e `TERMS_EFFECTIVE_DATE` em
 * `lib/domain/terms.ts`: todo mundo passa a aceitar de novo. Antes de lançar,
 * vale a revisão de um advogado.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de uso"
      intro={
        <p>
          Este é o combinado entre você e o Vitrine, em linguagem simples. Ao criar a conta, ou
          continuar usando o app, você concorda com estes termos e com a{" "}
          <Link href="/privacidade" className="text-foreground underline underline-offset-2">
            Política de privacidade
          </Link>
          .
        </p>
      }
    >
      <LegalSection title="1. Quem oferece o Vitrine">
        <p>
          O Vitrine é mantido por <strong>{DATA_CONTROLLER.name}</strong>, pessoa física, no
          Brasil. Para qualquer assunto, escreva para{" "}
          <a href={`mailto:${DATA_CONTROLLER.email}`}>{DATA_CONTROLLER.email}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Quem pode usar">
        <ul>
          <li>
            Só quem tem <strong>{MINIMUM_AGE} anos ou mais</strong>. Ao criar a conta, você
            confirma isso. Conta de menor de idade é excluída assim que a gente souber.
          </li>
          <li>
            Uma pessoa por conta. Você cuida da sua senha e responde pelo que é feito na sua
            conta. Desconfiou de acesso indevido? Troque a senha nas Configurações (as outras
            sessões caem na hora) e avise a gente.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. O que o Vitrine faz">
        <p>
          É um catálogo do que você consome — restaurantes, filmes, livros, o que for —, com a
          estrutura que você define, notas, pastas e mapa. Cada pasta e cada categoria tem um
          nível de visibilidade, que você escolhe e muda quando quiser:
        </p>
        <ul>
          <li>
            <strong>Pública</strong>: qualquer pessoa na internet vê, mesmo sem conta — inclusive
            pelo seu perfil (<code>/v/seu-@</code>).
          </li>
          <li>
            <strong>Amigos</strong>: só quem você segue e segue você de volta (quando o recurso
            de seguir estiver disponível).
          </li>
          <li>
            <strong>Privada</strong>: só você.
          </li>
        </ul>
        <p>
          Quando uma pasta está dentro de outra, vale o nível mais fechado do caminho. O padrão
          do que você criar fica nas Configurações.
        </p>
      </LegalSection>

      <LegalSection title="4. O seu conteúdo é seu">
        <ul>
          <li>Tudo o que você cadastra continua sendo seu.</li>
          <li>
            Para o app funcionar, você nos autoriza a guardar, organizar e mostrar esse conteúdo
            do jeito que você escolheu, enquanto ele estiver no Vitrine.
          </li>
          <li>
            Você também nos autoriza a usar o conteúdo <strong>público</strong> para gerar
            estatísticas e informações <strong>agregadas e anonimizadas</strong> (por exemplo,
            &ldquo;os cafés mais bem avaliados de um bairro&rdquo;), que podem ser compartilhadas
            ou vendidas — <strong>sem identificar você</strong>. O que é de Amigos ou Privado
            não entra nisso.
          </li>
          <li>
            Quando o recurso existir, outras pessoas poderão usar uma categoria pública sua como
            modelo (a estrutura e, se você deixar pública, os itens), com o seu @ aparecendo como
            autor.
          </li>
          <li>
            As imagens são links para outros sites: use só imagens que você tem o direito de
            usar.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Regras de convivência">
        <p>Não é permitido:</p>
        <ul>
          <li>
            publicar conteúdo ilegal, de ódio, assédio, violência ou que viole direitos de outras
            pessoas (autoria, imagem, privacidade);
          </li>
          <li>colocar dados pessoais de outras pessoas sem a autorização delas;</li>
          <li>se passar por outra pessoa ou marca, inclusive no @;</li>
          <li>
            tentar entrar em contas ou ver dados que não são seus, ou burlar limites e proteções
            do app;
          </li>
          <li>
            copiar o conteúdo do Vitrine de forma automatizada (robôs, raspagem) ou sobrecarregar
            o serviço;
          </li>
          <li>usar o app para spam ou propaganda enganosa.</li>
        </ul>
        <p>
          As <strong>tags</strong> são um vocabulário compartilhado: qualquer pessoa usa, cria e
          edita. Não coloque informação pessoal no nome de uma tag.
        </p>
      </LegalSection>

      <LegalSection title="6. O serviço">
        <ul>
          <li>
            O Vitrine é gratuito e está em fase inicial. Ele é oferecido como está: pode ter
            falhas, ficar fora do ar, mudar ou deixar de existir. Faça um backup de vez em quando
            (Configurações → Backup).
          </li>
          <li>
            Ele depende de serviços de terceiros (banco de dados, hospedagem, mapa, endereços),
            listados na Política de privacidade. Se um deles falhar, partes do app podem parar.
          </li>
          <li>
            Notas e informações publicadas por outras pessoas são opinião delas. Na medida
            permitida pela lei, o Vitrine não responde por decisões tomadas com base nelas.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Encerrar a conta">
        <ul>
          <li>
            Você pode excluir a sua conta quando quiser, em Configurações → Excluir minha conta.
            Tudo o que é seu é apagado.
          </li>
          <li>
            Podemos suspender ou excluir contas que descumpram estes termos, avisando antes
            sempre que for possível.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Mudanças nestes termos">
        <p>
          Quando estes termos ou a Política de privacidade mudarem, a versão no topo muda, e você
          precisa aceitar de novo para continuar usando o app.
        </p>
      </LegalSection>

      <LegalSection title="9. Lei aplicável">
        <p>
          Valem as leis do Brasil, entre elas o Código de Defesa do Consumidor e a Lei Geral de
          Proteção de Dados (LGPD). Dúvida ou problema? Escreva para{" "}
          <a href={`mailto:${DATA_CONTROLLER.email}`}>{DATA_CONTROLLER.email}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
