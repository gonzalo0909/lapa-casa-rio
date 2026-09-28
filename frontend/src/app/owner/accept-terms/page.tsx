/* eslint-disable react/no-unescaped-entities */
'use client';

//
// Página de aceite do Termo de Adesão — Administrador.
// Exibida automaticamente pelo useOwnerAuth quando termAcceptedAt === null.
// O botão "Aceitar" só é habilitado após:
//   1. O administrador rolar até o fim do contrato (scroll detection).
//   2. Marcar o checkbox de confirmação.
//
// Ao clicar, chama POST /owner/accept-terms com a versão atual do termo.
// Em caso de sucesso, redireciona para /owner (dashboard).

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ownerAuthAPI, CURRENT_TERM_VERSION } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';

export default function OwnerAcceptTermsPage() {
  const router = useRouter();
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);

  // Detecta quando o administrador chegou ao fim do contrato
  const handleScroll = useCallback(() => {
    const el = contractRef.current;
    if (!el) {return;}
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (atBottom) {setScrolledToBottom(true);}
  }, []);

  const canAccept = scrolledToBottom && checked;

  const handleAccept = async () => {
    if (!canAccept) {return;}
    setError(null);
    setLoading(true);
    try {
      await ownerAuthAPI.acceptTerms(CURRENT_TERM_VERSION);
      router.replace('/owner');
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">Termo de Adesão — Administrador</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Leia o contrato na íntegra antes de aceitar. Role até o final para habilitar o botão.
          </p>
        </div>

        {/* Contract scroll box */}
        <Card className="mb-6">
          <CardContent className="p-0">
            <div
              ref={contractRef}
              onScroll={handleScroll}
              className="h-[60vh] overflow-y-auto p-6 text-sm text-neutral-800 leading-relaxed"
            >
              <ContractText />
            </div>
          </CardContent>
        </Card>

        {/* Scroll hint */}
        {!scrolledToBottom && (
          <p className="mb-4 text-center text-xs text-amber-600">
            ↓ Role até o final do documento para continuar
          </p>
        )}

        {/* Acceptance card */}
        <Card>
          <CardHeader>
            <CardTitle size="sm">Confirmação de leitura e aceite</CardTitle>
            <CardDescription>
              Versão do documento: {CURRENT_TERM_VERSION}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className={`flex items-start gap-3 cursor-pointer ${!scrolledToBottom ? 'opacity-40 pointer-events-none' : ''}`}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={!scrolledToBottom}
              />
              <span className="text-sm text-neutral-700">
                Li e compreendi o Termo de Adesão na íntegra, incluindo as obrigações, comissões,
                regras de pagamento e penalidades previstas, e aceito todas as cláusulas na
                versão&nbsp;<strong>{CURRENT_TERM_VERSION}</strong>.
              </span>
            </label>

            {error && (
              <Alert variant="danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              disabled={!canAccept || loading}
              onClick={handleAccept}
              className="w-full justify-center"
            >
              {loading ? 'Registrando aceite...' : 'Aceitar e entrar no painel'}
            </Button>

            <p className="text-center text-xs text-neutral-400">
              Ao aceitar, seu endereço IP e a data/hora serão registrados como prova de aceite,
              conforme a Lei 14.063/2020 e o Marco Civil da Internet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Conteúdo do contrato ─────────────────────────────────────────────────────

function ContractText() {
  return (
    <article className="prose prose-sm max-w-none prose-neutral">
      <h2 className="text-center text-base font-semibold">
        TERMO DE ADESÃO — ADMINISTRADOR DE APARTAMENTO<br />
        Lapa Casa Rio — Plataforma de Hospedagem<br />
        Versão {CURRENT_TERM_VERSION}
      </h2>

      <p className="text-center text-xs text-neutral-500 mt-1 mb-6">
        Data de entrada em vigor: conforme carimbo de aceite eletrônico registrado pelo sistema.
      </p>

      <Section title="CLÁUSULA 1 — PARTES E NATUREZA DO ACORDO">
        <p>
          <strong>1.1</strong> O presente Termo de Adesão ("Termo") é celebrado entre
          <strong> Lapa Casa Rio</strong> ("Plataforma"), operada por pessoa física/jurídica brasileira
          responsável pelo domínio digital e pela infraestrutura de reservas, e o <strong>Administrador</strong>,
          pessoa física ou jurídica proprietária ou gestora do imóvel cadastrado na Plataforma
          ("Apartamento"), identificado pelos dados fornecidos no momento do cadastro.
        </p>
        <p>
          <strong>1.2</strong> A Plataforma atua exclusivamente como <strong>marketplace de hospedagem</strong>:
          aproxima hóspedes e administradores, processa o sinal confirmatório de reserva por
          meio de processadores de pagamento licenciados pelo Banco Central do Brasil (Stripe
          Payments Brazil Ltda. e/ou Mercado Pago), e oferece ferramentas de gestão. A Plataforma
          não é parte do contrato de hospedagem entre hóspede e Administrador, não presta serviço
          de hospedagem diretamente e não é instituição de pagamento.
        </p>
        <p>
          <strong>1.3</strong> A adesão ocorre no momento em que o Administrador conclui o
          cadastro e aceita eletronicamente este Termo, ficando registrado o carimbo de data/hora
          e o endereço IP como prova de aceite, nos termos da Lei 14.063/2020 e do Marco Civil
          da Internet (Lei 12.965/2014).
        </p>
      </Section>

      <Section title="CLÁUSULA 2 — OBJETO">
        <p>
          <strong>2.1</strong> A Plataforma concede ao Administrador acesso ao painel de gestão
          para cadastrar, divulgar e administrar reservas do Apartamento junto a hóspedes
          captados pela Plataforma.
        </p>
        <p>
          <strong>2.2</strong> O Administrador compromete-se a manter o Apartamento disponível,
          em condições adequadas de habitabilidade, e a honrar todas as reservas confirmadas
          pela Plataforma.
        </p>
      </Section>

      <Section title="CLÁUSULA 3 — MODELO DE PAGAMENTO">
        <p>
          <strong>3.1 Antecedência mínima.</strong> A Plataforma não aceita reservas para o
          mesmo dia. Toda reserva deve ser realizada com antecedência mínima de{' '}
          <strong>24 (vinte e quatro) horas</strong> em relação ao horário de check-in.
        </p>
        <p>
          <strong>3.2 Reservas com 48 h ou mais de antecedência — pagamento em duas etapas.</strong>{' '}
          Quando a reserva for realizada com 48 horas ou mais de antecedência:
        </p>
        <ul>
          <li>
            <strong>Etapa 1 — Sinal (30%):</strong> no ato da reserva, o hóspede paga{' '}
            <strong>30%</strong> do valor total à Plataforma, via processador licenciado, a título
            de arras confirmatórias.
          </li>
          <li>
            <strong>Etapa 2 — Saldo (70%):</strong> na manhã do dia do check-in, a Plataforma
            envia ao hóspede um link de pagamento seguro para o saldo de{' '}
            <strong>70%</strong> restante. O pagamento deve ser concluído antes do horário de
            check-in.
          </li>
        </ul>
        <p>
          <strong>3.3 Reservas com 24 h a 48 h de antecedência — pagamento integral.</strong>{' '}
          Quando a reserva for realizada entre 24 e 48 horas antes do check-in, o hóspede paga{' '}
          <strong>100%</strong> do valor total no ato da reserva, via processador licenciado.
        </p>
        <p>
          <strong>3.4 Cancelamento automático por falta de pagamento do saldo.</strong>{' '}
          Se o hóspede não efetuar o pagamento do saldo de 70% (Cláusula 3.2, Etapa 2) antes
          do horário de check-in, a reserva será <strong>cancelada automaticamente</strong> pela
          Plataforma. Nesse caso, o sinal de 30% já pago é retido como compensação ao
          Administrador, após dedução das taxas previstas na Cláusula 4.
        </p>
        <p>
          <strong>3.5 Repasse ao Administrador.</strong> Após a confirmação de check-in pelo
          Administrador no painel, a Plataforma repassa ao Administrador o valor total
          arrecadado (30% + 70%, conforme o caso), já descontadas as taxas previstas na
          Cláusula 4.
        </p>
        <p>
          <strong>3.6 Pagamento via cartão — sobretaxa.</strong> Quando o hóspede optar por
          pagar com cartão de crédito ou débito, será cobrada uma sobretaxa de{' '}
          <strong>10%</strong> sobre o valor processado, destinada a cobrir os custos de
          processamento de cartão (taxa do gateway + proteção contra estornos). Essa sobretaxa
          é arcada pelo hóspede e informada de forma transparente no checkout.
        </p>
      </Section>

      <Section title="CLÁUSULA 4 — COMISSÃO E TAXAS">
        <p>
          <strong>4.1 Comissão da Plataforma.</strong> Sobre o valor total da estadia (100%), a
          Plataforma retém uma comissão de <strong>5% (cinco por cento)</strong>, descontada do sinal
          de 30% antes do repasse.
        </p>
        <p>
          <strong>4.2 Taxa operacional.</strong> Adicionalmente, a Plataforma retém <strong>1,39%</strong> a
          título de taxa operacional, composta por:
        </p>
        <ul>
          <li><strong>0,99%</strong> — taxa do gateway de pagamento (Stripe/Mercado Pago);</li>
          <li><strong>0,40%</strong> — proteção contra contestações (Stripe Chargeback Protection
              ou equivalente), que cobre integralmente o risco de estorno em disputas de cartão.</li>
        </ul>
        <p>
          <strong>4.3 Total retido pela Plataforma.</strong> A retenção total sobre o valor da
          estadia é de <strong>6,39%</strong> (5% comissão + 1,39% operacional), descontada
          integralmente do sinal de 30%.
        </p>
        <p>
          <strong>4.4 Alteração de taxas.</strong> A Plataforma poderá reajustar as taxas com
          aviso prévio de <strong>30 dias</strong> por e-mail. O Administrador que não concordar
          poderá rescindir o contrato sem multa no prazo de aviso.
        </p>
      </Section>

      <Section title="CLÁUSULA 5 — CANCELAMENTOS E REEMBOLSOS">
        <p>
          <strong>5.1</strong> A política de cancelamento é definida pela Plataforma e informada
          ao hóspede no momento da reserva. Cabe ao Administrador respeitar a política vigente.
        </p>
        <p>
          <strong>5.2</strong> Em caso de cancelamento pelo hóspede com direito a reembolso, a
          Plataforma devolverá ao hóspede o valor retido (sinal de 30% ou parte dele) e deduzirá
          o repasse ao Administrador proporcionalmente.
        </p>
        <p>
          <strong>5.3 Cancelamento pelo Administrador.</strong> O cancelamento de reserva confirmada
          pelo Administrador, salvo força maior comprovada (Cláusula 9), sujeita-o ao pagamento
          de multa equivalente à comissão que seria devida, além de suspensão temporária ou
          definitiva do perfil na Plataforma.
        </p>
        <p>
          <strong>5.4 No-show do hóspede.</strong> Em caso de não comparecimento do hóspede sem
          cancelamento prévio, o sinal de 30% é retido pelo Administrador como compensação, após
          dedução das taxas previstas na Cláusula 4.
        </p>
      </Section>

      <Section title="CLÁUSULA 6 — RESPONSABILIDADE DO ADMINISTRADOR">
        <p>
          <strong>6.1</strong> O Administrador é integralmente responsável pela hospedagem,
          pelo estado do imóvel e pelo atendimento ao hóspede, incluindo:
        </p>
        <ul>
          <li>Manutenção do imóvel em condições adequadas de habitabilidade, limpeza e segurança;</li>
          <li>Cumprimento das normas municipais, estaduais e federais de hospedagem;</li>
          <li>Tratamento digno e não discriminatório dos hóspedes;</li>
          <li>Resolução de conflitos relativos à hospedagem diretamente com o hóspede.</li>
        </ul>
        <p>
          <strong>6.2</strong> A Plataforma não responde por danos materiais, morais ou físicos
          sofridos pelo hóspede durante a estadia, salvo nos limites do valor do sinal processado
          (30%), conforme o Código de Defesa do Consumidor.
        </p>
      </Section>

      <Section title="CLÁUSULA 7 — OBRIGAÇÕES DA PLATAFORMA">
        <p>
          <strong>7.1</strong> A Plataforma compromete-se a:
        </p>
        <ul>
          <li>Disponibilizar o painel de gestão com disponibilidade mínima de 99% ao mês;</li>
          <li>Processar reservas e comunicar confirmações em até 24 horas;</li>
          <li>Realizar o repasse do sinal em até 3 dias úteis após a confirmação de check-in;</li>
          <li>Manter suporte por e-mail com tempo de resposta de até 48 horas úteis;</li>
          <li>Notificar com 30 dias de antecedência qualquer alteração de taxas ou condições.</li>
        </ul>
      </Section>

      <Section title="CLÁUSULA 8 — NÃO CIRCUNVENÇÃO">
        <p>
          <strong>8.1</strong> É vedado ao Administrador realizar, facilitar ou aceitar reservas
          de hóspedes captados pela Plataforma por fora do sistema ("circunvenção"), durante a
          vigência deste Termo e por <strong>12 (doze) meses</strong> após o último contato do
          hóspede com a Plataforma.
        </p>
        <p>
          <strong>8.2 Presunção.</strong> Todo hóspede que tenha consultado a Plataforma nos
          12 meses anteriores à reserva direta é presumivelmente captado pela Plataforma para
          fins desta cláusula, salvo prova em contrário.
        </p>
        <p>
          <strong>8.3 Penalidade.</strong> Em caso de circunvenção comprovada, o Administrador
          pagará multa equivalente a <strong>3 (três) vezes</strong> a comissão que seria devida
          pela reserva circunvencionada, além de poder sofrer suspensão ou exclusão da Plataforma.
        </p>
      </Section>

      <Section title="CLÁUSULA 9 — FORÇA MAIOR">
        <p>
          <strong>9.1</strong> Eventos de força maior (desastres naturais, interdições governamentais,
          pandemias declaradas por autoridade competente) que impeçam a disponibilidade do
          Apartamento isentam o Administrador de multa por cancelamento, desde que:
        </p>
        <ul>
          <li>(a) O evento seja comprovado por documento oficial;</li>
          <li>(b) O Administrador notifique a Plataforma em até <strong>7 dias</strong> após o evento;</li>
          <li>(c) O Administrador não tenha aceitado novas reservas nos <strong>30 dias</strong> anteriores
              ao evento com ciência da situação de risco.</li>
        </ul>
        <p>
          <strong>9.2</strong> A Plataforma poderá solicitar documentação comprobatória antes de
          aplicar a isenção de penalidade.
        </p>
      </Section>

      <Section title="CLÁUSULA 10 — PROTEÇÃO DE DADOS (LGPD)">
        <p>
          <strong>10.1</strong> O Administrador autoriza a Plataforma a tratar seus dados pessoais
          (nome, CPF/CNPJ, e-mail, telefone, dados bancários/Stripe) para fins de gestão
          contratual, processamento de pagamentos e comunicações operacionais, nos termos da
          Lei 13.709/2018 (LGPD).
        </p>
        <p>
          <strong>10.2</strong> Os dados poderão ser compartilhados com processadores de pagamento
          (Stripe, Mercado Pago) e autoridades fiscais, quando exigido por lei.
        </p>
        <p>
          <strong>10.3</strong> O Administrador poderá exercer seus direitos de acesso, correção
          e eliminação de dados conforme a LGPD mediante solicitação ao suporte da Plataforma.
        </p>
      </Section>

      <Section title="CLÁUSULA 11 — PROGRAMA DE RECONHECIMENTO">
        <p>
          <strong>11.1</strong> A Plataforma mantém um programa voluntário de reconhecimento para
          Administradores com bom histórico, organizado nos seguintes níveis:
        </p>
        <ul>
          <li>
            <strong>Verificado</strong> — documentação completa e perfil aprovado. Benefícios:
            selo de verificação visível ao hóspede, acesso prioritário ao suporte.
          </li>
          <li>
            <strong>Destaque</strong> — mínimo de 10 reservas concluídas sem cancelamentos não
            justificados. Benefícios: posicionamento prioritário nos resultados de busca,
            relatórios de ocupação avançados.
          </li>
          <li>
            <strong>Elite</strong> — mínimo de 30 reservas concluídas e zero cancelamentos
            injustificados nos últimos 12 meses. Benefícios: repasse acelerado (1 dia útil),
            acesso a painel de precificação dinâmica, gerente de conta dedicado.
          </li>
        </ul>
        <p>
          <strong>11.2</strong> O Administrador <strong>Elite</strong> que indicar novo administrador
          receberá crédito de <strong>R$ 100,00</strong> em sua conta na Plataforma após a primeira
          reserva concluída do indicado.
        </p>
        <p>
          <strong>11.3</strong> Os critérios e benefícios do programa podem ser ajustados pela
          Plataforma com aviso prévio de 15 dias, sem constituir alteração das condições
          comerciais deste Termo.
        </p>
      </Section>

      <Section title="CLÁUSULA 12 — PRAZO E RESCISÃO">
        <p>
          <strong>12.1</strong> O presente Termo vigora por prazo indeterminado a partir do aceite.
        </p>
        <p>
          <strong>12.2 Rescisão pelo Administrador.</strong> O Administrador pode solicitar o
          encerramento da conta a qualquer momento, respeitando as reservas já confirmadas e em
          vigor. Reservas em andamento devem ser concluídas antes do encerramento efetivo.
        </p>
        <p>
          <strong>12.3 Rescisão pela Plataforma.</strong> A Plataforma pode encerrar a conta do
          Administrador mediante aviso prévio de 30 dias, ou imediatamente em caso de:
        </p>
        <ul>
          <li>Violação das cláusulas de não circunvenção (Cláusula 8);</li>
          <li>Fraude, discriminação ou comportamento contrário às normas da Plataforma;</li>
          <li>Descumprimento reiterado das reservas confirmadas.</li>
        </ul>
      </Section>

      <Section title="CLÁUSULA 13 — FORO E LEGISLAÇÃO APLICÁVEL">
        <p>
          <strong>13.1</strong> O presente Termo é regido pela legislação brasileira, em especial
          o Código Civil (Lei 10.406/2002), o Código de Defesa do Consumidor (Lei 8.078/1990),
          a LGPD (Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).
        </p>
        <p>
          <strong>13.2</strong> Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir
          quaisquer controvérsias oriundas deste Termo, renunciando as partes a qualquer outro,
          por mais privilegiado que seja.
        </p>
      </Section>

      <Section title="CLÁUSULA 14 — DISPOSIÇÕES GERAIS">
        <p>
          <strong>14.1</strong> Este Termo substitui quaisquer acordos anteriores entre as partes
          relativos ao objeto aqui descrito.
        </p>
        <p>
          <strong>14.2</strong> A tolerância de uma parte em relação ao descumprimento de qualquer
          cláusula não implica novação ou renúncia de direito.
        </p>
        <p>
          <strong>14.3</strong> Se qualquer cláusula for declarada inválida, as demais
          permanecem em plena vigência.
        </p>
        <p>
          <strong>14.4</strong> Versões anteriores deste Termo ficam arquivadas e acessíveis
          mediante solicitação ao suporte.
        </p>
      </Section>

      <p className="mt-8 text-center text-xs text-neutral-500 border-t pt-4">
        Ao rolar até aqui e aceitar eletronicamente, o Administrador confirma ter lido e
        compreendido integralmente o presente Termo de Adesão — Versão {CURRENT_TERM_VERSION}.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="text-sm font-semibold text-neutral-900 mb-2 uppercase tracking-wide">{title}</h3>
      <div className="space-y-2 text-neutral-700">{children}</div>
    </section>
  );
}
