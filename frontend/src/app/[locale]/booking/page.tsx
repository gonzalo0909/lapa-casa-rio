// lapa-casa-hostel-frontend/src/app/[locale]/booking/page.tsx
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingEngineLoading } from '@/app/loading';

interface BookingPageProps {
  params: {
    locale: string;
  };
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    beds?: string;
    room?: string;
  };
}

export async function generateMetadata({ 
  params: { locale } 
}: BookingPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'BookingPage' });
  
  return {
    title: 'Reservas - Lapa Casa Hostel',
    description: 'Faça sua reserva no Lapa Casa Hostel. Desconto especial para grupos de 7+ pessoas.',
    keywords: 'reserva hostel rio, booking santa teresa, hospedagem grupos rio',
  };
}

export default function BookingPage({ 
  params: { locale }, 
  searchParams 
}: BookingPageProps) {
  const t = useTranslations('BookingPage');

  const initialValues = {
    checkIn: searchParams.checkIn ? new Date(searchParams.checkIn) : null,
    checkOut: searchParams.checkOut ? new Date(searchParams.checkOut) : null,
    beds: searchParams.beds ? parseInt(searchParams.beds) : 1,
    selectedRoom: searchParams.room || null
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-12">
        <div className="container-lapa">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Faça Sua Reserva
            </h1>
            <p className="text-lg text-muted-foreground">
              Reserve sua estadia no Lapa Casa Hostel e aproveite descontos especiais para grupos
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-lapa">
          <Suspense fallback={<BookingEngineLoading />}>
            <div className="bg-card rounded-lg border p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4">
                Motor de Reservas
              </h2>
              <p className="text-muted-foreground mb-6">
                Selecione suas datas, quartos e complete sua reserva em minutos
              </p>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="booking-step">
                  <h3 className="font-semibold mb-4">
                    Selecionar Datas
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">
                        Check-in
                      </label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 border rounded-md"
                        defaultValue={initialValues.checkIn?.toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Check-out
                      </label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 border rounded-md"
                        defaultValue={initialValues.checkOut?.toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>

                <div className="booking-step">
                  <h3 className="font-semibold mb-4">
                    Selecionar Quartos
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Mixto 12A</div>
                        <div className="text-sm text-muted-foreground">
                          12 camas
                        </div>
                      </div>
                      <input type="number" min="0" max="12" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Mixto 12B</div>
                        <div className="text-sm text-muted-foreground">
                          12 camas
                        </div>
                      </div>
                      <input type="number" min="0" max="12" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Mixto 7</div>
                        <div className="text-sm text-muted-foreground">
                          7 camas
                        </div>
                      </div>
                      <input type="number" min="0" max="7" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Flexible 7</div>
                        <div className="text-sm text-muted-foreground">
                          7 camas • Flexível
                        </div>
                      </div>
                      <input type="number" min="0" max="7" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                  </div>
                </div>

                <div className="booking-step">
                  <h3 className="font-semibold mb-4">
                    Resumo do Preço
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Preço base</span>
                      <span>R$ 0,00</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto grupo</span>
                      <span>- R$ 0,00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Multiplicador temporada</span>
                      <span>R$ 0,00</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="price-display">R$ 0,00</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Depósito: R$ 0,00 (30%)
                    </div>
                    <button className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium">
                      Continuar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Suspense>
        </div>
      </section>

      <section className="bg-muted/50 section-padding">
        <div className="container-lapa">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-semibold mb-2">
                Desconto para Grupos
              </h3>
              <p className="text-sm text-muted-foreground">
                Economia de 10-20% para grupos de 7+ pessoas
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💳</span>
              </div>
              <h3 className="font-semibold mb-2">
                Pagamento Fácil
              </h3>
              <p className="text-sm text-muted-foreground">
                Pix, cartão ou parcelamento em até 12x
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="font-semibold mb-2">
                Cancelamento Flexível
              </h3>
              <p className="text-sm text-muted-foreground">
                Cancele até 48h antes sem taxa
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-lapa max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Perguntas Frequentes
          </h2>
          
          <div className="space-y-6">
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                Como funciona o desconto para grupos?
              </summary>
              <p className="mt-3 text-muted-foreground">
                Oferecemos desconto automático: 10% para 7-15 pessoas, 15% para 16-25 pessoas e 20% para 26+ pessoas.
              </p>
            </details>
            
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                Quais formas de pagamento vocês aceitam?
              </summary>
              <p className="mt-3 text-muted-foreground">
                Aceitamos Pix, cartão de crédito/débito e parcelamento em até 12x sem juros.
              </p>
            </details>
            
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                Qual é a política de cancelamento?
              </summary>
              <p className="mt-3 text-muted-foreground">
                Cancelamento gratuito até 48h antes do check-in. Para cancelamentos após esse prazo, consulte nossa política.
              </p>
            </details>
            
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                Quais são os horários de check-in e check-out?
              </summary>
              <p className="mt-3 text-muted-foreground">
                Check-in: 14h às 22h | Check-out: até 11h. Para horários especiais, entre em contato conosco.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground section-padding">
        <div className="container-lapa text-center">
          <h2 className="text-3xl font-bold mb-4">
            Precisa de Ajuda?
          </h2>
          <p className="text-xl opacity-90 mb-6">
            Nossa equipe está pronta para ajudar com sua reserva
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              className="bg-white text-primary px-6 py-3 rounded-md font-medium hover:bg-white/90"
              onClick={() => window.open('https://wa.me/5521999999999', '_blank')}
            >
              WhatsApp: +55 21 9999-9999
            </button>
            <button 
              className="bg-white/10 text-white px-6 py-3 rounded-md font-medium hover:bg-white/20"
              onClick={() => window.location.href = 'mailto:reservas@lapacasahostel.com'}
            >
              reservas@lapacasahostel.com
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
