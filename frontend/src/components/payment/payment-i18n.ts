// lapa-casa-hostel/frontend/src/components/payment/payment-i18n.ts
//
// pix-payment.tsx, card-payment.tsx y payment-processor.tsx tenían cada uno
// su propia función local `T(key, locale)` -- misma firma, mismo patrón de
// lookup, copiada 3 veces -- solo el diccionario de textos cambiaba entre
// ellos. Se consolida acá el tipo de locale compartido y el factory del
// lookup; cada componente sigue manteniendo su propio diccionario (las
// claves de texto son genuinamente distintas por componente).

export type PaymentLocale = 'pt' | 'es' | 'en' | 'fr' | 'de' | 'it';

export function createPaymentT(dict: Record<string, Record<string, string>>) {
  return (key: string, locale: string): string =>
    dict[locale]?.[key] ?? dict['pt']?.[key] ?? key;
}
