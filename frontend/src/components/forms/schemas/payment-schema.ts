// src/components/forms/schemas/payment-schema.ts
import { z } from 'zod';

// Monedas soportadas
export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

// Métodos de pago disponibles
export const PAYMENT_METHODS = {
  stripe: 'Stripe (Tarjeta Internacional)',
  mercado_pago: 'Mercado Pago (Brasil)'
} as const;

// Tipos de pago
export const PAYMENT_TYPES = {
  card: 'Tarjeta',
  pix: 'PIX',
  boleto: 'Boleto Bancário',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay'
} as const;

// Estados de pago
export const PAYMENT_STATUSES = {
  pending: 'Pendiente',
  processing: 'Procesando',
  succeeded: 'Exitoso',
  failed: 'Fallido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado'
} as const;

// Schema base para información de pago
export const basePaymentSchema = z.object({
  amount: z.number()
    .positive('El monto debe ser positivo')
    .multipleOf(0.01, 'El monto debe tener máximo 2 decimales')
    .max(50000, 'Monto máximo R$ 50,000'),

  currency: z.enum(SUPPORTED_CURRENCIES)
    .default('BRL'),

  paymentMethod: z.enum(['stripe', 'mercado_pago'], {
    required_error: 'Método de pago requerido',
    invalid_type_error: 'Método de pago no válido'
  }),

  paymentType: z.enum(['card', 'pix', 'boleto', 'apple_pay', 'google_pay'])
    .optional(),

  description: z.string()
    .max(500, 'Descripción máxima 500 caracteres')
    .optional()
});

// Schema para tarjeta de crédito (Stripe)
export const stripeCardSchema = z.object({
  cardNumber: z.string()
    .min(13, 'Número de tarjeta muy corto')
    .max(19, 'Número de tarjeta muy largo')
    .regex(/^[\d\s]+$/, 'Solo números permitidos'),

  expiryMonth: z.number()
    .int()
    .min(1, 'Mes inválido')
    .max(12, 'Mes inválido'),

  expiryYear: z.number()
    .int()
    .min(new Date().getFullYear(), 'Año expirado')
    .max(new Date().getFullYear() + 20, 'Año demasiado lejano'),

  cvc: z.string()
    .min(3, 'CVC debe tener 3-4 dígitos')
    .max(4, 'CVC debe tener 3-4 dígitos')
    .regex(/^\d+$/, 'CVC solo números'),

  holderName: z.string()
    .min(2, 'Nombre muy corto')
    .max(100, 'Nombre muy largo')
    .regex(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/, 'Nombre contiene caracteres no válidos')
});

// Schema para dirección de facturación
export const billingAddressSchema = z.object({
  street: z.string()
    .min(5, 'Dirección muy corta')
    .max(200, 'Dirección muy larga'),

  city: z.string()
    .min(2, 'Ciudad muy corta')
    .max(100, 'Ciudad muy larga'),

  state: z.string()
    .min(2, 'Estado/Provincia requerido')
    .max(50, 'Estado/Provincia muy largo'),

  postalCode: z.string()
    .min(5, 'Código postal muy corto')
    .max(12, 'Código postal muy largo'),

  country: z.string()
    .length(2, 'Código de país debe tener 2 caracteres')
    .regex(/^[A-Z]{2}$/, 'Código de país en mayúsculas')
});

// Schema para Mercado Pago PIX
export const pixSchema = z.object({
  payerEmail: z.string()
    .email('Email inválido para PIX')
    .optional(),

  payerName: z.string()
    .min(2, 'Nombre muy corto')
    .max(100, 'Nombre muy largo')
    .optional(),

  pixKey: z.string()
    .optional() // PIX key es opcional, se puede generar automáticamente
});

// Schema para cuotas (Mercado Pago)
export const installmentsSchema = z.object({
  installments: z.number()
    .int()
    .min(1, 'Mínimo 1 cuota')
    .max(12, 'Máximo 12 cuotas'),

  totalAmount: z.number()
    .positive('Monto total debe ser positivo'),

  monthlyAmount: z.number()
    .positive('Monto mensual debe ser positivo'),

  interestRate: z.number()
    .min(0, 'Tasa de interés no puede ser negativa')
    .max(0.5, 'Tasa má
