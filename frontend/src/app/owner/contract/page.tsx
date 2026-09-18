/* eslint-disable react/no-unescaped-entities */
'use client';

//
// Visualização do Termo de Adesão aceito pelo administrador.
// Mostra a data/hora do aceite e permite ler o contrato completo em PT-BR, ES ou FR.
// Página só acessível após o aceite (useOwnerAuth redireciona se termAcceptedAt===null).

import { useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { OwnerNav } from '@/components/owner/owner-nav';
import { CURRENT_TERM_VERSION } from '@/lib/owner-api';

type Lang = 'pt' | 'es' | 'fr';

const LANG_LABELS: Record<Lang, string> = {
  pt: 'Português (BR)',
  es: 'Español',
  fr: 'Français',
};

export default function OwnerContractPage() {
  const { profile, loading } = useOwnerAuth();
  const [lang, setLang] = useState<Lang>('pt');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  if (!profile) {return null;}

  const acceptedAt = profile.termAcceptedAt
    ? new Date(profile.termAcceptedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <OwnerNav fullName={profile.fullName} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Termo de Adesão</h1>
        {acceptedAt && (
          <p className="mt-1 text-sm text-green-700 font-medium">
            ✓ Aceito em {acceptedAt} · Versão {profile.termVersion ?? CURRENT_TERM_VERSION}
          </p>
        )}
      </div>

      {/* Seletor de idioma */}
      <div className="mb-4 flex gap-2">
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              lang === l
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Texto do contrato */}
      <div className="rounded-lg border border-border bg-card p-6 text-sm leading-relaxed text-neutral-800 overflow-y-auto max-h-[70vh]">
        {lang === 'pt' && <ContractPT />}
        {lang === 'es' && <ContractES />}
        {lang === 'fr' && <ContractFR />}
      </div>
    </div>
  );
}

// ─── Versão PT-BR ─────────────────────────────────────────────────────────────

function ContractPT() {
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
        <p><strong>1.1</strong> O presente Termo de Adesão ("Termo") é celebrado entre <strong>Lapa Casa Rio</strong> ("Plataforma"), operada por pessoa física/jurídica brasileira responsável pelo domínio digital e pela infraestrutura de reservas, e o <strong>Administrador</strong>, pessoa física ou jurídica proprietária ou gestora do imóvel cadastrado na Plataforma ("Apartamento"), identificado pelos dados fornecidos no momento do cadastro.</p>
        <p><strong>1.2</strong> A Plataforma atua exclusivamente como <strong>marketplace de hospedagem</strong>: aproxima hóspedes e administradores, processa o sinal confirmatório de reserva por meio de processadores de pagamento licenciados pelo Banco Central do Brasil (Stripe Payments Brazil Ltda. e/ou Mercado Pago), e oferece ferramentas de gestão. A Plataforma não é parte do contrato de hospedagem entre hóspede e Administrador, não presta serviço de hospedagem diretamente e não é instituição de pagamento.</p>
        <p><strong>1.3</strong> A adesão ocorre no momento em que o Administrador conclui o cadastro e aceita eletronicamente este Termo, ficando registrado o carimbo de data/hora e o endereço IP como prova de aceite, nos termos da Lei 14.063/2020 e do Marco Civil da Internet (Lei 12.965/2014).</p>
      </Section>

      <Section title="CLÁUSULA 2 — OBJETO">
        <p><strong>2.1</strong> A Plataforma concede ao Administrador acesso ao painel de gestão para cadastrar, divulgar e administrar reservas do Apartamento junto a hóspedes captados pela Plataforma.</p>
        <p><strong>2.2</strong> O Administrador compromete-se a manter o Apartamento disponível, em condições adequadas de habitabilidade, e a honrar todas as reservas confirmadas pela Plataforma.</p>
      </Section>

      <Section title="CLÁUSULA 3 — MODELO DE PAGAMENTO">
        <p><strong>3.1 Antecedência mínima.</strong> A Plataforma não aceita reservas para o mesmo dia. O prazo mínimo de antecedência é de <strong>24 horas</strong> antes do check-in.</p>
        <p><strong>3.2 Reservas com mais de 48 horas de antecedência — pagamento em duas etapas.</strong></p>
        <ul>
          <li><strong>Etapa 1 (no ato da reserva):</strong> o hóspede paga <strong>30%</strong> do valor total da estadia à Plataforma, via processador licenciado, a título de arras confirmatórias.</li>
          <li><strong>Etapa 2 (na manhã do check-in):</strong> a Plataforma envia automaticamente ao hóspede um link de pagamento para quitação do saldo de <strong>70%</strong>. O hóspede deve efetuar o pagamento antes do horário de check-in.</li>
        </ul>
        <p><strong>3.3 Reservas com 24 a 48 horas de antecedência — pagamento integral.</strong> O hóspede paga <strong>100%</strong> do valor total no ato da reserva, via processador licenciado.</p>
        <p><strong>3.4 Não pagamento do saldo de 70%.</strong> Se o hóspede não efetuar o pagamento do saldo de 70% antes do check-in, a reserva é cancelada automaticamente e o Administrador retém o sinal de 30% (após dedução das taxas da Cláusula 4), sem direito a reembolso pelo hóspede.</p>
        <p><strong>3.5 Repasse ao Administrador.</strong> Após a confirmação de check-in, a Plataforma repassa ao Administrador o valor total recebido (30% + 70%), já descontadas as taxas previstas na Cláusula 4.</p>
        <p><strong>3.6 Pagamento via cartão — sobretaxa.</strong> Quando o hóspede optar por pagar com cartão de crédito ou débito, será cobrada uma sobretaxa de <strong>10%</strong> sobre o valor pago online, destinada a cobrir os custos de processamento. Essa sobretaxa é arcada pelo hóspede e informada de forma transparente no checkout.</p>
      </Section>

      <Section title="CLÁUSULA 4 — COMISSÃO E TAXAS">
        <p><strong>4.1 Comissão da Plataforma.</strong> Sobre o valor total da estadia (100%), a Plataforma retém uma comissão de <strong>5% (cinco por cento)</strong>, descontada do sinal de 30% antes do repasse.</p>
        <p><strong>4.2 Taxa operacional.</strong> Adicionalmente, a Plataforma retém <strong>1,39%</strong> a título de taxa operacional, composta por:</p>
        <ul>
          <li><strong>0,99%</strong> — taxa do gateway de pagamento (Stripe/Mercado Pago);</li>
          <li><strong>0,40%</strong> — proteção contra contestações (Stripe Chargeback Protection ou equivalente), que cobre integralmente o risco de estorno em disputas de cartão.</li>
        </ul>
        <p><strong>4.3 Total retido pela Plataforma.</strong> A retenção total sobre o valor da estadia é de <strong>6,39%</strong> (5% comissão + 1,39% operacional), descontada integralmente do sinal de 30%.</p>
        <p><strong>4.4 Alteração de taxas.</strong> A Plataforma poderá reajustar as taxas com aviso prévio de <strong>30 dias</strong> por e-mail. O Administrador que não concordar poderá rescindir o contrato sem multa no prazo de aviso.</p>
      </Section>

      <Section title="CLÁUSULA 5 — CANCELAMENTOS E REEMBOLSOS">
        <p><strong>5.1</strong> A política de cancelamento é definida pela Plataforma e informada ao hóspede no momento da reserva. Cabe ao Administrador respeitar a política vigente.</p>
        <p><strong>5.2</strong> Em caso de cancelamento pelo hóspede com direito a reembolso, a Plataforma devolverá ao hóspede o valor retido (sinal de 30% ou parte dele) e deduzirá o repasse ao Administrador proporcionalmente.</p>
        <p><strong>5.3 Cancelamento pelo Administrador.</strong> O cancelamento de reserva confirmada pelo Administrador, salvo força maior comprovada (Cláusula 9), sujeita-o ao pagamento de multa equivalente à comissão que seria devida, além de suspensão temporária ou definitiva do perfil na Plataforma.</p>
        <p><strong>5.4 No-show do hóspede.</strong> Em caso de não comparecimento do hóspede sem cancelamento prévio, o sinal de 30% é retido pelo Administrador como compensação, após dedução das taxas previstas na Cláusula 4.</p>
      </Section>

      <Section title="CLÁUSULA 6 — RESPONSABILIDADE DO ADMINISTRADOR">
        <p><strong>6.1</strong> O Administrador é integralmente responsável pela hospedagem, pelo estado do imóvel e pelo atendimento ao hóspede, incluindo:</p>
        <ul>
          <li>Manutenção do imóvel em condições adequadas de habitabilidade, limpeza e segurança;</li>
          <li>Cumprimento das normas municipais, estaduais e federais de hospedagem;</li>
          <li>Tratamento digno e não discriminatório dos hóspedes;</li>
          <li>Resolução de conflitos relativos à hospedagem diretamente com o hóspede.</li>
        </ul>
        <p><strong>6.2</strong> A Plataforma não responde por danos materiais, morais ou físicos sofridos pelo hóspede durante a estadia, salvo nos limites do valor do sinal processado (30%), conforme o Código de Defesa do Consumidor.</p>
      </Section>

      <Section title="CLÁUSULA 7 — OBRIGAÇÕES DA PLATAFORMA">
        <p><strong>7.1</strong> A Plataforma compromete-se a:</p>
        <ul>
          <li>Disponibilizar o painel de gestão com disponibilidade mínima de 99% ao mês;</li>
          <li>Processar reservas e comunicar confirmações em até 24 horas;</li>
          <li>Realizar o repasse do sinal em até 3 dias úteis após a confirmação de check-in;</li>
          <li>Manter suporte por e-mail com tempo de resposta de até 48 horas úteis;</li>
          <li>Notificar com 30 dias de antecedência qualquer alteração de taxas ou condições.</li>
        </ul>
      </Section>

      <Section title="CLÁUSULA 8 — NÃO CIRCUNVENÇÃO">
        <p><strong>8.1</strong> É vedado ao Administrador realizar, facilitar ou aceitar reservas de hóspedes captados pela Plataforma por fora do sistema ("circunvenção"), durante a vigência deste Termo e por <strong>12 (doze) meses</strong> após o último contato do hóspede com a Plataforma.</p>
        <p><strong>8.2 Presunção.</strong> Todo hóspede que tenha consultado a Plataforma nos 12 meses anteriores à reserva direta é presumivelmente captado pela Plataforma para fins desta cláusula, salvo prova em contrário.</p>
        <p><strong>8.3 Penalidade.</strong> Em caso de circunvenção comprovada, o Administrador pagará multa equivalente a <strong>3 (três) vezes</strong> a comissão que seria devida pela reserva circunvencionada, além de poder sofrer suspensão ou exclusão da Plataforma.</p>
      </Section>

      <Section title="CLÁUSULA 9 — FORÇA MAIOR">
        <p><strong>9.1</strong> Eventos de força maior (desastres naturais, interdições governamentais, pandemias declaradas por autoridade competente) que impeçam a disponibilidade do Apartamento isentam o Administrador de multa por cancelamento, desde que:</p>
        <ul>
          <li>(a) O evento seja comprovado por documento oficial;</li>
          <li>(b) O Administrador notifique a Plataforma em até <strong>7 dias</strong> após o evento;</li>
          <li>(c) O Administrador não tenha aceitado novas reservas nos <strong>30 dias</strong> anteriores ao evento com ciência da situação de risco.</li>
        </ul>
        <p><strong>9.2</strong> A Plataforma poderá solicitar documentação comprobatória antes de aplicar a isenção de penalidade.</p>
      </Section>

      <Section title="CLÁUSULA 10 — PROTEÇÃO DE DADOS (LGPD)">
        <p><strong>10.1</strong> O Administrador autoriza a Plataforma a tratar seus dados pessoais (nome, CPF/CNPJ, e-mail, telefone, dados bancários/Stripe) para fins de gestão contratual, processamento de pagamentos e comunicações operacionais, nos termos da Lei 13.709/2018 (LGPD).</p>
        <p><strong>10.2</strong> Os dados poderão ser compartilhados com processadores de pagamento (Stripe, Mercado Pago) e autoridades fiscais, quando exigido por lei.</p>
        <p><strong>10.3</strong> O Administrador poderá exercer seus direitos de acesso, correção e eliminação de dados conforme a LGPD mediante solicitação ao suporte da Plataforma.</p>
      </Section>

      <Section title="CLÁUSULA 11 — PROGRAMA DE RECONHECIMENTO">
        <p><strong>11.1</strong> A Plataforma mantém um programa voluntário de reconhecimento para Administradores com bom histórico, organizado nos seguintes níveis:</p>
        <ul>
          <li><strong>Verificado</strong> — documentação completa e perfil aprovado. Benefícios: selo de verificação visível ao hóspede, acesso prioritário ao suporte.</li>
          <li><strong>Destaque</strong> — mínimo de 10 reservas concluídas sem cancelamentos não justificados. Benefícios: posicionamento prioritário nos resultados de busca, relatórios de ocupação avançados.</li>
          <li><strong>Elite</strong> — mínimo de 30 reservas concluídas e zero cancelamentos injustificados nos últimos 12 meses. Benefícios: repasse acelerado (1 dia útil), acesso a painel de precificação dinâmica, gerente de conta dedicado.</li>
        </ul>
        <p><strong>11.2</strong> O Administrador <strong>Elite</strong> que indicar novo administrador receberá crédito de <strong>R$ 100,00</strong> em sua conta na Plataforma após a primeira reserva concluída do indicado.</p>
        <p><strong>11.3</strong> Os critérios e benefícios do programa podem ser ajustados pela Plataforma com aviso prévio de 15 dias, sem constituir alteração das condições comerciais deste Termo.</p>
      </Section>

      <Section title="CLÁUSULA 12 — PRAZO E RESCISÃO">
        <p><strong>12.1</strong> O presente Termo vigora por prazo indeterminado a partir do aceite.</p>
        <p><strong>12.2 Rescisão pelo Administrador.</strong> O Administrador pode solicitar o encerramento da conta a qualquer momento, respeitando as reservas já confirmadas e em vigor. Reservas em andamento devem ser concluídas antes do encerramento efetivo.</p>
        <p><strong>12.3 Rescisão pela Plataforma.</strong> A Plataforma pode encerrar a conta do Administrador mediante aviso prévio de 30 dias, ou imediatamente em caso de:</p>
        <ul>
          <li>Violação das cláusulas de não circunvenção (Cláusula 8);</li>
          <li>Fraude, discriminação ou comportamento contrário às normas da Plataforma;</li>
          <li>Descumprimento reiterado das reservas confirmadas.</li>
        </ul>
      </Section>

      <Section title="CLÁUSULA 13 — FORO E LEGISLAÇÃO APLICÁVEL">
        <p><strong>13.1</strong> O presente Termo é regido pela legislação brasileira, em especial o Código Civil (Lei 10.406/2002), o Código de Defesa do Consumidor (Lei 8.078/1990), a LGPD (Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).</p>
        <p><strong>13.2</strong> Fica eleito o foro da Comarca do Rio de Janeiro/RJ para dirimir quaisquer controvérsias oriundas deste Termo, renunciando as partes a qualquer outro, por mais privilegiado que seja.</p>
      </Section>

      <Section title="CLÁUSULA 14 — DISPOSIÇÕES GERAIS">
        <p><strong>14.1</strong> Este Termo substitui quaisquer acordos anteriores entre as partes relativos ao objeto aqui descrito.</p>
        <p><strong>14.2</strong> A tolerância de uma parte em relação ao descumprimento de qualquer cláusula não implica novação ou renúncia de direito.</p>
        <p><strong>14.3</strong> Se qualquer cláusula for declarada inválida, as demais permanecem em plena vigência.</p>
        <p><strong>14.4</strong> Versões anteriores deste Termo ficam arquivadas e acessíveis mediante solicitação ao suporte.</p>
      </Section>
    </article>
  );
}

// ─── Versão ES ────────────────────────────────────────────────────────────────

function ContractES() {
  return (
    <article className="prose prose-sm max-w-none prose-neutral">
      <h2 className="text-center text-base font-semibold">
        CONTRATO DE ADHESIÓN — ADMINISTRADOR DE APARTAMENTO<br />
        Lapa Casa Rio — Plataforma de Hospedaje<br />
        Versión {CURRENT_TERM_VERSION}
      </h2>
      <p className="text-center text-xs text-neutral-500 mt-1 mb-6">
        Fecha de entrada en vigor: según sello de aceptación electrónica registrado por el sistema.
      </p>

      <Section title="CLÁUSULA 1 — PARTES Y NATURALEZA DEL ACUERDO">
        <p><strong>1.1</strong> El presente Contrato de Adhesión ("Contrato") es celebrado entre <strong>Lapa Casa Rio</strong> ("Plataforma"), operada por persona física/jurídica brasileña responsable del dominio digital y la infraestructura de reservas, y el <strong>Administrador</strong>, persona física o jurídica propietaria o gestora del inmueble registrado en la Plataforma ("Apartamento"), identificado por los datos proporcionados al momento del registro.</p>
        <p><strong>1.2</strong> La Plataforma actúa exclusivamente como <strong>marketplace de hospedaje</strong>: conecta huéspedes y administradores, procesa la señal confirmatoria de reserva a través de procesadores de pago autorizados por el Banco Central de Brasil (Stripe Payments Brazil Ltda. y/o Mercado Pago), y ofrece herramientas de gestión. La Plataforma no es parte del contrato de hospedaje entre el huésped y el Administrador, no presta servicio de hospedaje directamente y no es institución de pago.</p>
        <p><strong>1.3</strong> La adhesión ocurre cuando el Administrador completa el registro y acepta electrónicamente este Contrato, quedando registrados el sello de fecha/hora y la dirección IP como prueba de aceptación, conforme a la Ley 14.063/2020 y el Marco Civil de Internet (Ley 12.965/2014).</p>
      </Section>

      <Section title="CLÁUSULA 2 — OBJETO">
        <p><strong>2.1</strong> La Plataforma otorga al Administrador acceso al panel de gestión para registrar, publicar y administrar reservas del Apartamento con huéspedes captados por la Plataforma.</p>
        <p><strong>2.2</strong> El Administrador se compromete a mantener el Apartamento disponible, en condiciones adecuadas de habitabilidad, y a respetar todas las reservas confirmadas por la Plataforma.</p>
      </Section>

      <Section title="CLÁUSULA 3 — MODELO DE PAGO">
        <p><strong>3.1 Anticipación mínima.</strong> La Plataforma no acepta reservas para el mismo día. La anticipación mínima es de <strong>24 horas</strong> antes del check-in.</p>
        <p><strong>3.2 Reservas con más de 48 horas de anticipación — pago en dos etapas.</strong></p>
        <ul>
          <li><strong>Etapa 1 (al reservar):</strong> el huésped paga el <strong>30%</strong> del valor total de la estadía a la Plataforma, vía procesador autorizado, en concepto de arras confirmatorias.</li>
          <li><strong>Etapa 2 (la mañana del check-in):</strong> la Plataforma envía automáticamente al huésped un link de pago para abonar el saldo del <strong>70%</strong>. El huésped debe pagar antes del horario de check-in.</li>
        </ul>
        <p><strong>3.3 Reservas con 24 a 48 horas de anticipación — pago íntegro.</strong> El huésped paga el <strong>100%</strong> del valor total al momento de la reserva, vía procesador autorizado.</p>
        <p><strong>3.4 No pago del saldo del 70%.</strong> Si el huésped no abona el saldo del 70% antes del check-in, la reserva se cancela automáticamente y el Administrador retiene la señal del 30% (tras deducción de las tasas de la Cláusula 4), sin derecho a reembolso por parte del huésped.</p>
        <p><strong>3.5 Transferencia al Administrador.</strong> Tras la confirmación del check-in, la Plataforma transfiere al Administrador el valor total recibido (30% + 70%), ya deducidas las tasas previstas en la Cláusula 4.</p>
        <p><strong>3.6 Pago con tarjeta — recargo.</strong> Cuando el huésped opte por pagar con tarjeta de crédito o débito, se cobrará un recargo del <strong>10%</strong> sobre el valor pagado online, destinado a cubrir los costos de procesamiento. Este recargo es asumido por el huésped e informado de forma transparente en el checkout.</p>
      </Section>

      <Section title="CLÁUSULA 4 — COMISIÓN Y TASAS">
        <p><strong>4.1 Comisión de la Plataforma.</strong> Sobre el valor total de la estadía (100%), la Plataforma retiene una comisión del <strong>5% (cinco por ciento)</strong>, descontada de la señal del 30% antes de la transferencia.</p>
        <p><strong>4.2 Tasa operativa.</strong> Adicionalmente, la Plataforma retiene <strong>1,39%</strong> en concepto de tasa operativa, compuesta por:</p>
        <ul>
          <li><strong>0,99%</strong> — tasa de la pasarela de pago (Stripe/Mercado Pago);</li>
          <li><strong>0,40%</strong> — protección contra contracargos (Stripe Chargeback Protection o equivalente), que cubre íntegramente el riesgo de disputa en pagos con tarjeta.</li>
        </ul>
        <p><strong>4.3 Total retenido por la Plataforma.</strong> La retención total sobre el valor de la estadía es del <strong>6,39%</strong> (5% comisión + 1,39% operativo), descontada íntegramente de la señal del 30%.</p>
        <p><strong>4.4 Modificación de tasas.</strong> La Plataforma podrá ajustar las tasas con previo aviso de <strong>30 días</strong> por e-mail. El Administrador que no acepte podrá rescindir el contrato sin multa dentro del plazo de aviso.</p>
      </Section>

      <Section title="CLÁUSULA 5 — CANCELACIONES Y REEMBOLSOS">
        <p><strong>5.1</strong> La política de cancelación es definida por la Plataforma e informada al huésped al momento de la reserva. El Administrador debe respetar la política vigente.</p>
        <p><strong>5.2</strong> En caso de cancelación por el huésped con derecho a reembolso, la Plataforma devolverá al huésped el valor retenido (señal del 30% o parte de ella) y deducirá la transferencia al Administrador proporcionalmente.</p>
        <p><strong>5.3 Cancelación por el Administrador.</strong> La cancelación de una reserva confirmada por el Administrador, salvo fuerza mayor comprobada (Cláusula 9), lo sujeta al pago de una multa equivalente a la comisión que hubiera correspondido, además de suspensión temporal o definitiva del perfil en la Plataforma.</p>
        <p><strong>5.4 No-show del huésped.</strong> En caso de no presentación del huésped sin cancelación previa, la señal del 30% queda retenida por el Administrador como compensación, tras deducción de las tasas previstas en la Cláusula 4.</p>
      </Section>

      <Section title="CLÁUSULA 6 — RESPONSABILIDAD DEL ADMINISTRADOR">
        <p><strong>6.1</strong> El Administrador es íntegramente responsable del hospedaje, del estado del inmueble y de la atención al huésped, incluyendo:</p>
        <ul>
          <li>Mantenimiento del inmueble en condiciones adecuadas de habitabilidad, limpieza y seguridad;</li>
          <li>Cumplimiento de las normas municipales, estaduales y federales de hospedaje;</li>
          <li>Trato digno y no discriminatorio de los huéspedes;</li>
          <li>Resolución de conflictos relativos al hospedaje directamente con el huésped.</li>
        </ul>
        <p><strong>6.2</strong> La Plataforma no responde por daños materiales, morales o físicos sufridos por el huésped durante la estadía, salvo dentro de los límites del valor de la señal procesada (30%), conforme al Código de Defensa del Consumidor brasileño.</p>
      </Section>

      <Section title="CLÁUSULA 7 — OBLIGACIONES DE LA PLATAFORMA">
        <p><strong>7.1</strong> La Plataforma se compromete a:</p>
        <ul>
          <li>Disponibilizar el panel de gestión con disponibilidad mínima del 99% mensual;</li>
          <li>Procesar reservas y comunicar confirmaciones en hasta 24 horas;</li>
          <li>Realizar la transferencia de la señal en hasta 3 días hábiles tras la confirmación del check-in;</li>
          <li>Mantener soporte por e-mail con tiempo de respuesta de hasta 48 horas hábiles;</li>
          <li>Notificar con 30 días de anticipación cualquier modificación de tasas o condiciones.</li>
        </ul>
      </Section>

      <Section title="CLÁUSULA 8 — NO CIRCUNVENCIÓN">
        <p><strong>8.1</strong> Queda prohibido al Administrador realizar, facilitar o aceptar reservas de huéspedes captados por la Plataforma fuera del sistema ("circunvención"), durante la vigencia de este Contrato y por <strong>12 (doce) meses</strong> tras el último contacto del huésped con la Plataforma.</p>
        <p><strong>8.2 Presunción.</strong> Todo huésped que haya consultado la Plataforma en los 12 meses anteriores a la reserva directa se presume captado por la Plataforma a los fines de esta cláusula, salvo prueba en contrario.</p>
        <p><strong>8.3 Penalidad.</strong> En caso de circunvención comprobada, el Administrador pagará una multa equivalente a <strong>3 (tres) veces</strong> la comisión que hubiera correspondido por la reserva circunvenida, además de poder ser suspendido o excluido de la Plataforma.</p>
      </Section>

      <Section title="CLÁUSULA 9 — FUERZA MAYOR">
        <p><strong>9.1</strong> Eventos de fuerza mayor (desastres naturales, restricciones gubernamentales, pandemias declaradas por autoridad competente) que impidan la disponibilidad del Apartamento eximen al Administrador de multa por cancelación, siempre que:</p>
        <ul>
          <li>(a) El evento sea comprobado con documento oficial;</li>
          <li>(b) El Administrador notifique a la Plataforma dentro de los <strong>7 días</strong> posteriores al evento;</li>
          <li>(c) El Administrador no haya aceptado nuevas reservas en los <strong>30 días</strong> anteriores al evento con conocimiento de la situación de riesgo.</li>
        </ul>
        <p><strong>9.2</strong> La Plataforma podrá solicitar documentación comprobatoria antes de aplicar la exención de penalidad.</p>
      </Section>

      <Section title="CLÁUSULA 10 — PROTECCIÓN DE DATOS (LGPD)">
        <p><strong>10.1</strong> El Administrador autoriza a la Plataforma a tratar sus datos personales (nombre, CPF/CNPJ, e-mail, teléfono, datos bancarios/Stripe) para fines de gestión contractual, procesamiento de pagos y comunicaciones operativas, conforme a la Ley 13.709/2018 (LGPD).</p>
        <p><strong>10.2</strong> Los datos podrán ser compartidos con procesadores de pago (Stripe, Mercado Pago) y autoridades fiscales, cuando lo exija la ley.</p>
        <p><strong>10.3</strong> El Administrador podrá ejercer sus derechos de acceso, corrección y eliminación de datos conforme a la LGPD mediante solicitud al soporte de la Plataforma.</p>
      </Section>

      <Section title="CLÁUSULA 11 — PROGRAMA DE RECONOCIMIENTO">
        <p><strong>11.1</strong> La Plataforma mantiene un programa voluntario de reconocimiento para Administradores con buen historial, organizado en los siguientes niveles:</p>
        <ul>
          <li><strong>Verificado</strong> — documentación completa y perfil aprobado. Beneficios: sello de verificación visible al huésped, acceso prioritario al soporte.</li>
          <li><strong>Destacado</strong> — mínimo de 10 reservas completadas sin cancelaciones injustificadas. Beneficios: posicionamiento prioritario en los resultados de búsqueda, informes de ocupación avanzados.</li>
          <li><strong>Élite</strong> — mínimo de 30 reservas completadas y cero cancelaciones injustificadas en los últimos 12 meses. Beneficios: transferencia acelerada (1 día hábil), acceso a panel de precios dinámicos, gerente de cuenta dedicado.</li>
        </ul>
        <p><strong>11.2</strong> El Administrador <strong>Élite</strong> que refiera a un nuevo administrador recibirá un crédito de <strong>R$ 100,00</strong> en su cuenta en la Plataforma tras la primera reserva completada del referido.</p>
        <p><strong>11.3</strong> Los criterios y beneficios del programa pueden ser ajustados por la Plataforma con previo aviso de 15 días, sin constituir modificación de las condiciones comerciales de este Contrato.</p>
      </Section>

      <Section title="CLÁUSULA 12 — PLAZO Y RESCISIÓN">
        <p><strong>12.1</strong> El presente Contrato rige por tiempo indeterminado desde la aceptación.</p>
        <p><strong>12.2 Rescisión por el Administrador.</strong> El Administrador puede solicitar el cierre de la cuenta en cualquier momento, respetando las reservas ya confirmadas y en vigor. Las reservas en curso deben completarse antes del cierre efectivo.</p>
        <p><strong>12.3 Rescisión por la Plataforma.</strong> La Plataforma puede cerrar la cuenta del Administrador con previo aviso de 30 días, o de inmediato en caso de:</p>
        <ul>
          <li>Violación de las cláusulas de no circunvención (Cláusula 8);</li>
          <li>Fraude, discriminación o comportamiento contrario a las normas de la Plataforma;</li>
          <li>Incumplimiento reiterado de reservas confirmadas.</li>
        </ul>
      </Section>

      <Section title="CLÁUSULA 13 — JURISDICCIÓN Y LEGISLACIÓN APLICABLE">
        <p><strong>13.1</strong> El presente Contrato se rige por la legislación brasileña, en especial el Código Civil (Ley 10.406/2002), el Código de Defensa del Consumidor (Ley 8.078/1990), la LGPD (Ley 13.709/2018) y el Marco Civil de Internet (Ley 12.965/2014).</p>
        <p><strong>13.2</strong> Se elige el foro de la Comarca de Río de Janeiro/RJ para dirimir cualquier controversia derivada de este Contrato, renunciando las partes a cualquier otro fuero, por más privilegiado que sea.</p>
      </Section>

      <Section title="CLÁUSULA 14 — DISPOSICIONES GENERALES">
        <p><strong>14.1</strong> Este Contrato reemplaza cualquier acuerdo anterior entre las partes relativo al objeto aquí descrito.</p>
        <p><strong>14.2</strong> La tolerancia de una parte respecto al incumplimiento de cualquier cláusula no implica novación ni renuncia de derechos.</p>
        <p><strong>14.3</strong> Si alguna cláusula fuera declarada inválida, las demás permanecen en plena vigencia.</p>
        <p><strong>14.4</strong> Las versiones anteriores de este Contrato quedan archivadas y accesibles mediante solicitud al soporte.</p>
      </Section>
    </article>
  );
}

// ─── Versão FR ────────────────────────────────────────────────────────────────

function ContractFR() {
  return (
    <article className="prose prose-sm max-w-none prose-neutral">
      <h2 className="text-center text-base font-semibold">
        CONDITIONS D&apos;ADHÉSION — GESTIONNAIRE D&apos;APPARTEMENT<br />
        Lapa Casa Rio — Plateforme d&apos;Hébergement<br />
        Version {CURRENT_TERM_VERSION}
      </h2>
      <p className="text-center text-xs text-neutral-500 mt-1 mb-6">
        Date d&apos;entrée en vigueur : selon l&apos;horodatage d&apos;acceptation électronique enregistré par le système.
      </p>

      <Section title="CLAUSE 1 — PARTIES ET NATURE DE L'ACCORD">
        <p><strong>1.1</strong> Les présentes Conditions d&apos;Adhésion (« Contrat ») sont conclues entre <strong>Lapa Casa Rio</strong> (« Plateforme »), exploitée par une personne physique/morale brésilienne responsable du domaine numérique et de l&apos;infrastructure de réservations, et le <strong>Gestionnaire</strong>, personne physique ou morale propriétaire ou gestionnaire du bien enregistré sur la Plateforme (« Appartement »), identifié par les données fournies lors de l&apos;inscription.</p>
        <p><strong>1.2</strong> La Plateforme agit exclusivement en tant que <strong>marketplace d&apos;hébergement</strong> : elle met en relation hôtes et gestionnaires, traite l&apos;acompte confirmatoire de réservation via des processeurs de paiement agréés par la Banque Centrale du Brésil (Stripe Payments Brazil Ltda. et/ou Mercado Pago), et fournit des outils de gestion. La Plateforme n&apos;est pas partie au contrat d&apos;hébergement entre l&apos;hôte et le Gestionnaire, ne preste pas directement de service d&apos;hébergement et n&apos;est pas un établissement de paiement.</p>
        <p><strong>1.3</strong> L&apos;adhésion intervient au moment où le Gestionnaire finalise son inscription et accepte électroniquement ce Contrat, l&apos;horodatage et l&apos;adresse IP étant enregistrés comme preuve d&apos;acceptation, conformément à la Loi 14.063/2020 et au Marco Civil da Internet (Loi 12.965/2014).</p>
      </Section>

      <Section title="CLAUSE 2 — OBJET">
        <p><strong>2.1</strong> La Plateforme accorde au Gestionnaire l&apos;accès au panneau de gestion pour enregistrer, publier et administrer les réservations de l&apos;Appartement auprès des hôtes captés par la Plateforme.</p>
        <p><strong>2.2</strong> Le Gestionnaire s&apos;engage à maintenir l&apos;Appartement disponible, dans des conditions adéquates d&apos;habitabilité, et à honorer toutes les réservations confirmées par la Plateforme.</p>
      </Section>

      <Section title="CLAUSE 3 — MODÈLE DE PAIEMENT">
        <p><strong>3.1 Délai minimum.</strong> La Plateforme n&apos;accepte pas de réservations pour le jour même. Le délai minimum est de <strong>24 heures</strong> avant le check-in.</p>
        <p><strong>3.2 Réservations avec plus de 48 heures d&apos;avance — paiement en deux étapes.</strong></p>
        <ul>
          <li><strong>Étape 1 (à la réservation) :</strong> l&apos;hôte paie <strong>30%</strong> du montant total du séjour à la Plateforme, via le processeur agréé, à titre d&apos;arrhes confirmatoires.</li>
          <li><strong>Étape 2 (le matin du check-in) :</strong> la Plateforme envoie automatiquement à l&apos;hôte un lien de paiement pour régler le solde de <strong>70%</strong>. L&apos;hôte doit payer avant l&apos;heure de check-in.</li>
        </ul>
        <p><strong>3.3 Réservations avec 24 à 48 heures d&apos;avance — paiement intégral.</strong> L&apos;hôte paie <strong>100%</strong> du montant total au moment de la réservation, via le processeur agréé.</p>
        <p><strong>3.4 Non-paiement du solde de 70%.</strong> Si l&apos;hôte n&apos;effectue pas le paiement du solde de 70% avant le check-in, la réservation est automatiquement annulée et le Gestionnaire conserve l&apos;acompte de 30% (après déduction des frais de la Clause 4), sans remboursement pour l&apos;hôte.</p>
        <p><strong>3.5 Reversement au Gestionnaire.</strong> Après la confirmation du check-in, la Plateforme reverse au Gestionnaire le montant total reçu (30% + 70%), déduction faite des frais prévus à la Clause 4.</p>
        <p><strong>3.6 Paiement par carte — majoration.</strong> Lorsque l&apos;hôte opte pour un paiement par carte de crédit ou de débit, une majoration de <strong>10%</strong> est appliquée sur le montant payé en ligne, destinée à couvrir les coûts de traitement. Cette majoration est à la charge de l&apos;hôte et clairement indiquée lors du paiement.</p>
      </Section>

      <Section title="CLAUSE 4 — COMMISSION ET FRAIS">
        <p><strong>4.1 Commission de la Plateforme.</strong> Sur la valeur totale du séjour (100%), la Plateforme retient une commission de <strong>5% (cinq pour cent)</strong>, déduite de l&apos;acompte de 30% avant reversement.</p>
        <p><strong>4.2 Frais opérationnels.</strong> La Plateforme retient en outre <strong>1,39%</strong> au titre de frais opérationnels, composés de :</p>
        <ul>
          <li><strong>0,99%</strong> — frais de passerelle de paiement (Stripe/Mercado Pago) ;</li>
          <li><strong>0,40%</strong> — protection contre les contestations (Stripe Chargeback Protection ou équivalent), couvrant intégralement le risque de litige lié aux paiements par carte.</li>
        </ul>
        <p><strong>4.3 Total retenu par la Plateforme.</strong> La retenue totale sur la valeur du séjour est de <strong>6,39%</strong> (5% commission + 1,39% opérationnel), déduite intégralement de l&apos;acompte de 30%.</p>
        <p><strong>4.4 Modification des frais.</strong> La Plateforme peut ajuster les frais avec un préavis de <strong>30 jours</strong> par e-mail. Le Gestionnaire qui n&apos;accepte pas les nouvelles conditions peut résilier le contrat sans pénalité dans le délai de préavis.</p>
      </Section>

      <Section title="CLAUSE 5 — ANNULATIONS ET REMBOURSEMENTS">
        <p><strong>5.1</strong> La politique d&apos;annulation est définie par la Plateforme et communiquée à l&apos;hôte lors de la réservation. Le Gestionnaire doit respecter la politique en vigueur.</p>
        <p><strong>5.2</strong> En cas d&apos;annulation par l&apos;hôte ouvrant droit à remboursement, la Plateforme restituera à l&apos;hôte le montant retenu (acompte de 30% ou partie) et déduira le reversement au Gestionnaire en proportion.</p>
        <p><strong>5.3 Annulation par le Gestionnaire.</strong> L&apos;annulation d&apos;une réservation confirmée par le Gestionnaire, sauf force majeure dûment justifiée (Clause 9), entraîne le paiement d&apos;une pénalité équivalente à la commission qui aurait été due, ainsi qu&apos;une suspension temporaire ou définitive du profil sur la Plateforme.</p>
        <p><strong>5.4 No-show de l&apos;hôte.</strong> En cas de non-présentation de l&apos;hôte sans annulation préalable, l&apos;acompte de 30% est conservé par le Gestionnaire à titre d&apos;indemnisation, après déduction des frais prévus à la Clause 4.</p>
      </Section>

      <Section title="CLAUSE 6 — RESPONSABILITÉ DU GESTIONNAIRE">
        <p><strong>6.1</strong> Le Gestionnaire est entièrement responsable de l&apos;hébergement, de l&apos;état du bien et de l&apos;accueil de l&apos;hôte, notamment :</p>
        <ul>
          <li>Entretien du bien dans des conditions adéquates d&apos;habitabilité, de propreté et de sécurité ;</li>
          <li>Respect des réglementations municipales, étatiques et fédérales en matière d&apos;hébergement ;</li>
          <li>Traitement digne et non discriminatoire des hôtes ;</li>
          <li>Résolution des litiges liés à l&apos;hébergement directement avec l&apos;hôte.</li>
        </ul>
        <p><strong>6.2</strong> La Plateforme n&apos;est pas responsable des dommages matériels, moraux ou physiques subis par l&apos;hôte durant le séjour, sauf dans les limites du montant de l&apos;acompte traité (30%), conformément au Code de Défense du Consommateur brésilien.</p>
      </Section>

      <Section title="CLAUSE 7 — OBLIGATIONS DE LA PLATEFORME">
        <p><strong>7.1</strong> La Plateforme s&apos;engage à :</p>
        <ul>
          <li>Mettre à disposition le panneau de gestion avec une disponibilité minimale de 99% par mois ;</li>
          <li>Traiter les réservations et communiquer les confirmations sous 24 heures ;</li>
          <li>Effectuer le reversement de l&apos;acompte dans les 3 jours ouvrables suivant la confirmation du check-in ;</li>
          <li>Maintenir un support par e-mail avec un délai de réponse de 48 heures ouvrables ;</li>
          <li>Notifier toute modification de frais ou de conditions avec 30 jours d&apos;avance.</li>
        </ul>
      </Section>

      <Section title="CLAUSE 8 — NON-CONTOURNEMENT">
        <p><strong>8.1</strong> Il est interdit au Gestionnaire de réaliser, faciliter ou accepter des réservations de hôtes captés par la Plateforme en dehors du système (« contournement »), pendant la durée du présent Contrat et pendant <strong>12 (douze) mois</strong> après le dernier contact de l&apos;hôte avec la Plateforme.</p>
        <p><strong>8.2 Présomption.</strong> Tout hôte ayant consulté la Plateforme dans les 12 mois précédant la réservation directe est présumé capté par la Plateforme aux fins de cette clause, sauf preuve contraire.</p>
        <p><strong>8.3 Pénalité.</strong> En cas de contournement avéré, le Gestionnaire paiera une pénalité équivalente à <strong>3 (trois) fois</strong> la commission qui aurait été due pour la réservation contournée, et pourra être suspendu ou exclu de la Plateforme.</p>
      </Section>

      <Section title="CLAUSE 9 — FORCE MAJEURE">
        <p><strong>9.1</strong> Les événements de force majeure (catastrophes naturelles, restrictions gouvernementales, pandémies déclarées par une autorité compétente) rendant l&apos;Appartement indisponible exonèrent le Gestionnaire de pénalité d&apos;annulation, à condition que :</p>
        <ul>
          <li>(a) L&apos;événement soit justifié par un document officiel ;</li>
          <li>(b) Le Gestionnaire notifie la Plateforme dans les <strong>7 jours</strong> suivant l&apos;événement ;</li>
          <li>(c) Le Gestionnaire n&apos;ait pas accepté de nouvelles réservations dans les <strong>30 jours</strong> précédant l&apos;événement en ayant connaissance du risque.</li>
        </ul>
        <p><strong>9.2</strong> La Plateforme peut demander des justificatifs avant d&apos;appliquer l&apos;exonération de pénalité.</p>
      </Section>

      <Section title="CLAUSE 10 — PROTECTION DES DONNÉES (LGPD)">
        <p><strong>10.1</strong> Le Gestionnaire autorise la Plateforme à traiter ses données personnelles (nom, CPF/CNPJ, e-mail, téléphone, coordonnées bancaires/Stripe) à des fins de gestion contractuelle, de traitement des paiements et de communications opérationnelles, conformément à la Loi 13.709/2018 (LGPD).</p>
        <p><strong>10.2</strong> Les données pourront être partagées avec les processeurs de paiement (Stripe, Mercado Pago) et les autorités fiscales, lorsque la loi l&apos;exige.</p>
        <p><strong>10.3</strong> Le Gestionnaire peut exercer ses droits d&apos;accès, de rectification et d&apos;effacement des données conformément à la LGPD en adressant une demande au support de la Plateforme.</p>
      </Section>

      <Section title="CLAUSE 11 — PROGRAMME DE RECONNAISSANCE">
        <p><strong>11.1</strong> La Plateforme maintient un programme volontaire de reconnaissance pour les Gestionnaires ayant un bon historique, organisé selon les niveaux suivants :</p>
        <ul>
          <li><strong>Vérifié</strong> — dossier complet et profil approuvé. Avantages : badge de vérification visible par l&apos;hôte, accès prioritaire au support.</li>
          <li><strong>En vedette</strong> — minimum de 10 réservations complétées sans annulations injustifiées. Avantages : positionnement prioritaire dans les résultats de recherche, rapports d&apos;occupation avancés.</li>
          <li><strong>Élite</strong> — minimum de 30 réservations complétées et zéro annulation injustifiée au cours des 12 derniers mois. Avantages : reversement accéléré (1 jour ouvrable), accès au panneau de tarification dynamique, gestionnaire de compte dédié.</li>
        </ul>
        <p><strong>11.2</strong> Le Gestionnaire <strong>Élite</strong> qui parraine un nouveau gestionnaire recevra un crédit de <strong>R$ 100,00</strong> sur son compte sur la Plateforme après la première réservation complétée par le filleul.</p>
        <p><strong>11.3</strong> Les critères et avantages du programme peuvent être ajustés par la Plateforme avec un préavis de 15 jours, sans constituer une modification des conditions commerciales du présent Contrat.</p>
      </Section>

      <Section title="CLAUSE 12 — DURÉE ET RÉSILIATION">
        <p><strong>12.1</strong> Le présent Contrat est conclu pour une durée indéterminée à compter de l&apos;acceptation.</p>
        <p><strong>12.2 Résiliation par le Gestionnaire.</strong> Le Gestionnaire peut demander la fermeture de son compte à tout moment, dans le respect des réservations déjà confirmées et en cours. Les réservations en cours doivent être achevées avant la clôture effective.</p>
        <p><strong>12.3 Résiliation par la Plateforme.</strong> La Plateforme peut fermer le compte du Gestionnaire avec un préavis de 30 jours, ou immédiatement en cas de :</p>
        <ul>
          <li>Violation des clauses de non-contournement (Clause 8) ;</li>
          <li>Fraude, discrimination ou comportement contraire aux règles de la Plateforme ;</li>
          <li>Non-respect répété des réservations confirmées.</li>
        </ul>
      </Section>

      <Section title="CLAUSE 13 — JURIDICTION ET DROIT APPLICABLE">
        <p><strong>13.1</strong> Le présent Contrat est régi par la législation brésilienne, notamment le Code Civil (Loi 10.406/2002), le Code de Défense du Consommateur (Loi 8.078/1990), la LGPD (Loi 13.709/2018) et le Marco Civil da Internet (Loi 12.965/2014).</p>
        <p><strong>13.2</strong> Le tribunal compétent est celui de la Comarca do Rio de Janeiro/RJ pour tout litige découlant du présent Contrat, les parties renonçant à tout autre for, aussi privilégié soit-il.</p>
      </Section>

      <Section title="CLAUSE 14 — DISPOSITIONS GÉNÉRALES">
        <p><strong>14.1</strong> Le présent Contrat remplace tout accord antérieur entre les parties relatif à l&apos;objet décrit ci-dessus.</p>
        <p><strong>14.2</strong> La tolérance d&apos;une partie à l&apos;égard du non-respect d&apos;une clause n&apos;implique ni novation ni renonciation à un droit.</p>
        <p><strong>14.3</strong> Si une clause est déclarée invalide, les autres restent pleinement en vigueur.</p>
        <p><strong>14.4</strong> Les versions antérieures du présent Contrat sont archivées et accessibles sur demande au support.</p>
      </Section>
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
