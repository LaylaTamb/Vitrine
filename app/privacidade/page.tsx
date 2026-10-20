import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { DATA_CONTROLLER, MINIMUM_AGE } from "@/lib/domain/terms"

export const metadata: Metadata = { title: "Política de privacidade · Vitrine" }

/**
 * `/privacidade` — a Política de privacidade (LGPD). Abre sem login.
 *
 * Mudou o texto? Troque `TERMS_VERSION` e `TERMS_EFFECTIVE_DATE` em
 * `lib/domain/terms.ts`: todo mundo passa a aceitar de novo. Serviço novo que
 * recebe dados (ex.: o Gemini, o Steam) entra na lista da seção 4 antes de
 * ir ao ar. Antes de lançar, vale a revisão de um advogado.
 */
export default function PrivacyPage() {
  const email = (
    <a href={`mailto:${DATA_CONTROLLER.email}`}>{DATA_CONTROLLER.email}</a>
  )

  return (
    <LegalPage
      title="Política de privacidade"
      intro={
        <p>
          O que o Vitrine guarda sobre você, para quê, com quem divide e como você controla
          tudo isso — de acordo com a Lei Geral de Proteção de Dados (LGPD). Vale junto com os{" "}
          <Link href="/termos" className="text-foreground underline underline-offset-2">
            Termos de uso
          </Link>
          .
        </p>
      }
    >
      <LegalSection title="1. Quem cuida dos seus dados">
        <p>
          A controladora dos dados é <strong>{DATA_CONTROLLER.name}</strong>, pessoa física, no
          Brasil, que também atende como encarregada (o &ldquo;DPO&rdquo; da LGPD). Contato:{" "}
          {email}.
        </p>
      </LegalSection>

      <LegalSection title="2. O que guardamos">
        <ul>
          <li>
            <strong>Conta</strong>: e-mail; a senha, guardada só como código embaralhado (hash)
            pelo serviço de login — ninguém do Vitrine consegue ver; o seu @, o nome de exibição
            e o link da foto; a data em que você aceitou estes textos e confirmou ter{" "}
            {MINIMUM_AGE} anos ou mais.
          </li>
          <li>
            <strong>Acervo</strong>: pastas, categorias, itens, notas, campos, tags, links de
            imagens, a visibilidade de cada coisa e os endereços que você escreve em campos de
            Localização — com as coordenadas encontradas para eles.
          </li>
          <li>
            <strong>Relações</strong>: quem você segue, quem segue você e quem você bloqueou; e
            as trocas de @ dos últimos tempos (o @ antigo fica reservado e redirecionando por 14
            dias).
          </li>
          <li>
            <strong>Localização do aparelho</strong>: só quando você autoriza no navegador, e só
            na hora — para centralizar o mapa e mostrar o que fica perto. Ela{" "}
            <strong>não é guardada</strong>. Quando você pede o tempo de trajeto, ela é enviada
            ao nosso servidor e à Geoapify só para esse cálculo.
          </li>
          <li>
            <strong>Aplicativos conectados</strong> (só se você conectar): da Steam, a sua
            identificação (SteamID), o nome de exibição e a lista dos seus jogos com as horas
            jogadas.
          </li>
          <li>
            <strong>Registros técnicos</strong>: os provedores de hospedagem e de banco de dados
            registram dados como endereço IP e horário dos acessos, por segurança.
          </li>
        </ul>
        <p>
          Não pedimos CPF, telefone nem dados sensíveis (saúde, religião, política…). Evite
          colocar esse tipo de informação em categorias públicas.
        </p>
      </LegalSection>

      <LegalSection title="3. Para que usamos">
        <ul>
          <li>
            <strong>Fazer o app funcionar</strong>: guardar e mostrar o seu acervo, do jeito que
            você escolheu (base legal: execução do contrato — os Termos de uso).
          </li>
          <li>
            <strong>Mostrar para os outros o que você abriu</strong>: o que é Público, para
            qualquer pessoa; o que é de Amigos, para os seus amigos (mesma base).
          </li>
          <li>
            <strong>Mandar os e-mails da conta</strong>: confirmação de cadastro e troca de
            senha (mesma base).
          </li>
          <li>
            <strong>Segurança</strong>: evitar abuso, fraude e acesso indevido (base legal:
            legítimo interesse).
          </li>
          <li>
            <strong>Estatísticas agregadas e anonimizadas</strong>, feitas{" "}
            <strong>só com conteúdo público</strong> — por exemplo, os lugares mais bem avaliados
            de uma região. Elas podem ser compartilhadas ou vendidas a outras empresas, sempre
            sem identificar ninguém: dado anonimizado deixa de ser dado pessoal (LGPD, art. 12).
            O que é de Amigos ou Privado nunca entra (base legal: legítimo interesse).
          </li>
        </ul>
        <p>
          <strong>Não vendemos os seus dados pessoais</strong>, nem usamos para publicidade.
        </p>
      </LegalSection>

      <LegalSection title="4. Com quem dividimos">
        <p>
          Com os serviços que fazem o Vitrine funcionar, cada um só com o necessário para a sua
          parte:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — banco de dados, login e o envio dos e-mails da conta.
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do site.
          </li>
          <li>
            <strong>Geoapify</strong> — transforma endereços em coordenadas e traz dados dos
            lugares e tempos de trajeto. Recebe o texto do endereço ou as coordenadas, não quem
            você é.
          </li>
          <li>
            <strong>OpenFreeMap</strong> — o desenho do mapa. O seu navegador pede as imagens do
            mapa direto a eles (e eles veem o seu IP).
          </li>
          <li>
            <strong>Google Gemini</strong> — quando você cria uma categoria, ninguém tem uma
            parecida e você toca em &ldquo;Sugerir campos com IA&rdquo;, enviamos{" "}
            <strong>só o nome da categoria</strong> (nada sobre você). No plano gratuito, o Google
            pode usar o que recebe para treinar e melhorar os produtos dele.
          </li>
          <li>
            <strong>Steam (Valve)</strong> — só se você conectar a sua conta: o login é feito na
            própria Steam (a senha não passa pelo Vitrine), e a Steam nos envia os dados acima.
          </li>
        </ul>
        <p>
          Além disso: os botões &ldquo;Abrir no Maps&rdquo; e &ldquo;Como chegar&rdquo; abrem o
          Google Maps com o endereço; e as imagens por link são carregadas direto do site onde
          estão (que vê o IP de quem olha). Dados também podem ser entregues a autoridades,
          quando a lei exigir.
        </p>
        <p>
          Alguns desses serviços guardam dados fora do Brasil. Eles seguem regras próprias de
          proteção, como as cláusulas contratuais previstas na LGPD (art. 33).
        </p>
      </LegalSection>

      <LegalSection title="5. Por quanto tempo">
        <ul>
          <li>Enquanto a sua conta existir.</li>
          <li>
            Ao <strong>excluir a conta</strong> (Configurações → Excluir minha conta), o seu
            perfil, o acervo e as suas relações são apagados na hora. As tags que você criou
            continuam no vocabulário compartilhado, sem ligação com você.
          </li>
          <li>
            Cópias de segurança e registros técnicos dos provedores, quando existem, podem durar
            mais um tempo limitado, pelas regras de cada um.
          </li>
          <li>Estatísticas já anonimizadas continuam existindo — elas não identificam ninguém.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Os seus direitos">
        <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
        <ul>
          <li>saber se tratamos dados seus e ter acesso a eles;</li>
          <li>corrigir o que estiver errado — quase tudo dá para editar direto no app;</li>
          <li>
            levar os seus dados com você (portabilidade): Configurações → Backup exporta o acervo
            inteiro em um arquivo;
          </li>
          <li>pedir a exclusão: Configurações → Excluir minha conta;</li>
          <li>saber com quem dividimos (a seção 4) e revogar consentimentos;</li>
          <li>se opor a um uso que você considere indevido.</li>
        </ul>
        <p>
          O que não der para fazer pelo app, peça por {email}: respondemos em até 15 dias. Você
          também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </LegalSection>

      <LegalSection title={`7. Só para maiores de ${MINIMUM_AGE}`}>
        <p>
          O Vitrine não é para menores de {MINIMUM_AGE} anos. Se soubermos de uma conta de menor,
          ela é excluída.
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <p>
          Usamos <strong>só os cookies da sessão</strong>, que mantêm você logado. Preferências
          de tela (grade ou lista, tamanho dos cards) ficam guardadas no próprio navegador e não
          são enviadas. Não há cookies de publicidade nem de rastreamento.
        </p>
      </LegalSection>

      <LegalSection title="9. Segurança">
        <p>
          As conexões são cifradas (HTTPS), a senha fica só como hash, e o próprio banco de
          dados confere quem pode ver cada coisa (o que é privado não sai dele para mais
          ninguém). Nenhum sistema é infalível: se acontecer um incidente que possa trazer risco
          a você, avisamos você e a ANPD.
        </p>
      </LegalSection>

      <LegalSection title="10. Mudanças">
        <p>
          Quando esta política mudar, a versão no topo muda, e você precisa aceitar de novo para
          continuar usando o app.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
