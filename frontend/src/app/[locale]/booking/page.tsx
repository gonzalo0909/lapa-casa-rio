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

// Generar metadata dinámicamente
export async function generateMetadata({ 
  params: { locale } 
}: BookingPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'BookingPage' });
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: t('meta.keywords'),
  };
}

export default function BookingPage({ 
  params: { locale }, 
  searchParams 
}: BookingPageProps) {
  const t = useTranslations('BookingPage');

  // Procesar parámetros de búsqueda para valores iniciales
  const initialValues = {
    checkIn: searchParams.checkIn ? new Date(searchParams.checkIn) : null,
    checkOut: searchParams.checkOut ? new Date(searchParams.checkOut) : null,
    beds: searchParams.beds ? parseInt(searchParams.beds) : 1,
    selectedRoom: searchParams.room || null
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-12">
        <div className="container-lapa">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Booking Engine Section */}
      <section className="section-padding">
        <div className="container-lapa">
          <Suspense fallback={<BookingEngineLoading />}>
            {/* El BookingEngine será implementado en la siguiente fase */}
            <div className="bg-card rounded-lg border p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4">
                {t('engine.title')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('engine.description')}
              </p>
              
              {/* Placeholder para el motor de reservas */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Date Selection */}
                <div className="booking-step">
                  <h3 className="font-semibold mb-4">
                    {t('steps.dates.title')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">
                        {t('steps.dates.checkIn')}
                      </label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 border rounded-md"
                        defaultValue={initialValues.checkIn?.toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {t('steps.dates.checkOut')}
                      </label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 border rounded-md"
                        defaultValue={initialValues.checkOut?.toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>

                {/* Room Selection */}
                <div className="booking-step">
                  <h3 className="font-semibold mb-4">
                    {t('steps.rooms.title')}
                  </h3>
                  <div className="space-y-3">
                    {/* Mixto 12A */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{t('rooms.mixto12a')}</div>
                        <div className="text-sm text-muted-foreground">
                          12 {t('rooms.beds')}
                        </div>
                      </div>
                      <input type="number" min="0" max="12" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                    
                    {/* Mixto 12B */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{t('rooms.mixto12b')}</div>
                        <div className="text-sm text-muted-foreground">
                          12 {t('rooms.beds')}
                        </div>
                      </div>
                      <input type="number" min="0" max="12" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                    
                    {/* Mixto 7 */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{t('rooms.mixto7')}</div>
                        <div className="text-sm text-muted-foreground">
                          7 {t('rooms.beds')}
                        </div>
                      </div>
                      <input type="number" min="0" max="7" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                    
                    {/* Flexible 7 */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{t('rooms.flexible7')}</div>
                        <div className="text-sm text-muted-foreground">
                          7 {t('rooms.beds')} • {t('rooms.flexible')}
                        </div>
                      </div>
                      <input type="number" min="0" max="7" defaultValue="0" className="w-16 px-2 py-1 border rounded" />
                    </div>
                  </div>
                </div>

                {/* Price Summary */}
                <div className="booking-step">
                  <h3 className="font-semibold mb-4">
                    {t('steps.summary.title')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>{t('steps.summary.basePrice')}</span>
                      <span>R$ 0,00</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{t('steps.summary.groupDiscount')}</span>
                      <span>- R$ 0,00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('steps.summary.seasonMultiplier')}</span>
                      <span>R$ 0,00</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-semibold">
                      <span>{t('steps.summary.total')}</span>
                      <span className="price-display">R$ 0,00</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('steps.summary.deposit')}: R$ 0,00 (30%)
                    </div>
                    <button className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium">
                      {t('steps.summary.continue')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Suspense>
        </div>
      </section>

      {/* Information Section */}
      <section className="bg-muted/50 section-padding">
        <div className="container-lapa">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Group Discounts */}
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-semibold mb-2">
                {t('info.groupDiscounts.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('info.groupDiscounts.description')}
              </p>
            </div>

            {/* Easy Payment */}
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💳</span>
              </div>
              <h3 className="font-semibold mb-2">
                {t('info.easyPayment.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('info.easyPayment.description')}
              </p>
            </div>

            {/* Flexible Cancellation */}
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="font-semibold mb-2">
                {t('info.flexibleCancellation.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('info.flexibleCancellation.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding">
        <div className="container-lapa max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('faq.title')}
          </h2>
          
          <div className="space-y-6">
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                {t('faq.questions.groupDiscount.question')}
              </summary>
              <p className="mt-3 text-muted-foreground">
                {t('faq.questions.groupDiscount.answer')}
              </p>
            </details>
            
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                {t('faq.questions.payment.question')}
              </summary>
              <p className="mt-3 text-muted-foreground">
                {t('faq.questions.payment.answer')}
              </p>
            </details>
            
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                {t('faq.questions.cancellation.question')}
              </summary>
              <p className="mt-3 text-muted-foreground">
                {t('faq.questions.cancellation.answer')}
              </p>
            </details>
            
            <details className="bg-card border rounded-lg p-6">
              <summary className="font-semibold cursor-pointer">
                {t('faq.questions.checkin.question')}
              </summary>
              <p className="mt-3 text-muted-foreground">
                {t('faq.questions.checkin.answer')}
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="bg-primary text-primary-foreground section-padding">
        <div className="container-lapa text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t('support.title')}
          </h2>
          <p className="text-xl opacity-90 mb-6">
            {t('support.description')}
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
