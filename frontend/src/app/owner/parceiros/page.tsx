'use client';

//
// Página informativa do Programa de Parceiros -- pitch narrativo + programa
// de indicação de hóspedes. Vive dentro do painel /owner (só para
// administradores já logados): não tem formulário de contato, porque quem
// vê essa página já é parceiro -- esse texto era o pitch para gente de fora
// antes de se cadastrar, aqui fica só como referência.
//

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { OwnerNav } from '@/components/owner/owner-nav';

export default function OwnerParceirosPage() {
  const { profile, loading } = useOwnerAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  if (!profile) {return null;}

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <OwnerNav fullName={profile.fullName} />

      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
          Programa de Parceiros
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-4 leading-tight">
          O Rio não é só praia e cartão-postal.
        </h1>
        <div className="space-y-3 max-w-2xl">
          <p className="text-base text-muted-foreground leading-relaxed">
            É um bairro com ritmo próprio, uma mercearia na esquina, uma vista que só se vê de uma
            certa janela em um certo horário. Isso é o que seu apartamento oferece a quem vem de
            fora: não mais um quarto de hotel, mas um pedaço real da cidade.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed">
            Nós ajudamos esse pedaço de cidade a chegar até a pessoa certa — alguém que vai
            aproveitar e cuidar dele, não só usar de passagem.
          </p>
        </div>
      </div>

      <section className="py-8 border-t border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Como trabalhamos</h2>
        <ul className="space-y-2.5">
          {[
            'Comissão de 5% por reserva confirmada — sem taxa de adesão nem mensalidade',
            'Cuidamos dos hóspedes, da limpeza, do check-in e do check-out',
            'O repasse cai na sua conta poucas horas após cada check-in',
            'Você não precisa morar no Rio nem visitar o imóvel',
            'Pessoa física ou jurídica: o processo é o mesmo',
            'Tratamos os dados dos seus hóspedes com o cuidado exigido pela LGPD',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-foreground">
              <span className="text-primary mt-0.5 flex-shrink-0">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-8 border-t border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Programa de indicação de hóspedes
        </h2>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Cada hóspede que se hospeda no Lapa Casa Rio recebe um código pessoal de desconto (10%)
          para compartilhar. Quando o amigo indicado conclui a estadia, o hóspede titular recebe
          R$5 para uma próxima reserva. Condições:
        </p>
        <ul className="space-y-2">
          {[
            'Códigos válidos até 31/12/2026',
            'Não aplicável em reservas que incluam feriados nacionais do Brasil',
            'Cada código pode ser usado uma vez por hóspede',
            'Não é permitido auto-indicação',
            'O benefício de R$5 é creditado após o check-out confirmado da reserva do amigo',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-foreground">
              <span className="text-primary mt-0.5 flex-shrink-0">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
