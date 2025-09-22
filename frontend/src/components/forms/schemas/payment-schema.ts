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
    .max(0.5, 'Tasa máxima de interés 50%'),

  hasInterest: z.boolean()
    .default(false)
});

// Schema completo de pago
export const paymentSchema = z.discriminatedUnion('paymentMethod', [
  // Pago con Stripe (tarjeta)
  z.object({
    ...basePaymentSchema.shape,
    paymentMethod: z.literal('stripe'),
    paymentType: z.enum(['card', 'apple_pay', 'google_pay']).default('card'),
    
    // Información de tarjeta (solo si es card)
    cardInfo: stripeCardSchema.optional(),
    
    // Dirección de facturación
    billingAddress: billingAddressSchema.optional(),
    
    // Configuraciones específicas de Stripe
    saveCard: z.boolean().default(false),
    setupFutureUsage: z.enum(['off_session', 'on_session']).optional(),
    
    // Metadatos
    metadata: z.record(z.string()).optional()
  }),
  
  // Pago con Mercado Pago
  z.object({
    ...basePaymentSchema.shape,
    paymentMethod: z.literal('mercado_pago'),
    paymentType: z.enum(['card', 'pix', 'boleto']).default('pix'),
    
    // PIX específico
    pixInfo: pixSchema.optional(),
    
    // Cuotas (solo para tarjeta)
    installmentInfo: installmentsSchema.optional(),
    
    // Configuraciones específicas de MP
    binaryMode: z.boolean().default(true),
    
    // Información del pagador
    payer: z.object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      identification: z.object({
        type: z.enum(['CPF', 'CNPJ', 'passport']),
        number: z.string()
      }).optional()
    }).optional()
  })
]);

// Schema para webhook de pago
export const paymentWebhookSchema = z.object({
  id: z.string(),
  type: z.enum(['payment.created', 'payment.updated', 'payment.cancelled']),
  data: z.object({
    id: z.string()
  }),
  date_created: z.string().datetime(),
  user_id: z.string()
});

// Schema para reembolso
export const refundSchema = z.object({
  paymentId: z.string().min(1, 'ID de pago requerido'),
  amount: z.number().positive('Monto de reembolso debe ser positivo').optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).default('requested_by_customer'),
  description: z.string().max(500, 'Descripción máxima 500 caracteres').optional()
});

// Schema para validación de depósito
export const depositValidationSchema = z.object({
  totalAmount: z.number().positive(),
  depositPercentage: z.number().min(0.1).max(1), // 10% a 100%
  minimumDeposit: z.number().positive().default(50), // R$ 50 mínimo
  
  calculatedDeposit: z.number().positive(),
  remainingAmount: z.number().min(0)
}).refine((data) => {
  const expectedDeposit = Math.max(
    data.totalAmount * data.depositPercentage,
    data.minimumDeposit
  );
  
  return Math.abs(data.calculatedDeposit - expectedDeposit) < 0.01;
}, {
  message: 'El depósito calculado no coincide con las reglas de negocio',
  path: ['calculatedDeposit']
});

// Tipos TypeScript derivados
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type StripeCardData = z.infer<typeof stripeCardSchema>;
export type BillingAddressData = z.infer<typeof billingAddressSchema>;
export type PixData = z.infer<typeof pixSchema>;
export type InstallmentsData = z.infer<typeof installmentsSchema>;
export type RefundData = z.infer<typeof refundSchema>;
export type PaymentWebhookData = z.infer<typeof paymentWebhookSchema>;
export type DepositValidationData = z.infer<typeof depositValidationSchema>;

// Validadores específicos de negocio
export const paymentValidators = {
  // Validar número de tarjeta usando algoritmo de Luhn
  validateCardNumber: (cardNumber: string): boolean => {
    const cleaned = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  },

  // Detectar tipo de tarjeta
  detectCardType: (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\D/g, '');
    
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'discover';
    
    return 'unknown';
  },

  // Validar CVV según tipo de tarjeta
  validateCVV: (cvv: string, cardType: string): boolean => {
    const cleanCVV = cvv.replace(/\D/g, '');
    
    if (cardType === 'amex') {
      return cleanCVV.length === 4;
    }
    
    return cleanCVV.length === 3;
  },

  // Validar CPF brasileiro
  validateCPF: (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, '');
    
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * (10 - i);
    }
    
    let digit1 = (sum * 10) % 11;
    if (digit1 === 10) digit1 = 0;
    
    if (digit1 !== parseInt(cleaned[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i]) * (11 - i);
    }
    
    let digit2 = (sum * 10) % 11;
    if (digit2 === 10) digit2 = 0;
    
    return digit2 === parseInt(cleaned[10]);
  },

  // Calcular cuotas sin interés
  calculateInstallments: (totalAmount: number, maxInstallments: number = 12) => {
    const installments = [];
    
    for (let i = 1; i <= maxInstallments; i++) {
      const monthlyAmount = totalAmount / i;
      
      installments.push({
        number: i,
        monthlyAmount: Math.round(monthlyAmount * 100) / 100,
        totalAmount,
        interestRate: 0,
        hasInterest: false
      });
    }
    
    return installments;
  }
};

// Configuración de límites por método de pago
export const paymentLimits = {
  stripe: {
    minAmount: 5.00, // R$ 5.00
    maxAmount: 50000.00, // R$ 50,000
    currencies: ['BRL', 'USD', 'EUR']
  },
  
  mercado_pago: {
    pix: {
      minAmount: 1.00,
      maxAmount: 20000.00
    },
    card: {
      minAmount: 5.00,
      maxAmount: 50000.00,
      maxInstallments: 12
    },
    boleto: {
      minAmount: 10.00,
      maxAmount: 10000.00
    }
  }
};

// Mensajes de error para pagos
export const paymentErrorMessages = {
  card: {
    invalidNumber: 'Número de tarjeta inválido',
    expiredCard: 'Tarjeta expirada',
    invalidCVV: 'Código de seguridad inválido',
    insufficientFunds: 'Fondos insuficientes',
    cardDeclined: 'Tarjeta rechazada por el banco',
    processingError: 'Error al procesar el pago'
  },
  
  pix: {
    invalidKey: 'Clave PIX inválida',
    expired: 'Código PIX expirado',
    alreadyPaid: 'PIX ya fue pagado',
    cancelled: 'PIX cancelado'
  },
  
  general: {
    networkError: 'Error de conexión. Intente nuevamente.',
    serverError: 'Error del servidor. Contacte soporte.',
    invalidAmount: 'Monto inválido',
    currencyNotSupported: 'Moneda no soportada',
    paymentMethodUnavailable: 'Método de pago no disponible'
  }
};

// Funciones utilitarias
export const paymentUtils = {
  // Formatear monto en moneda brasileña
  formatBRL: (amount: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  },

  // Formatear número de tarjeta
  formatCardNumber: (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\D/g, '');
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  },

  // Máscarar número de tarjeta
  maskCardNumber: (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return cleaned;
    
    const lastFour = cleaned.slice(-4);
    const masked = '*'.repeat(cleaned.length - 4);
    
    return (masked + lastFour).replace(/(.{4})/g, '$1 ').trim();
  },

  // Calcular fee de Mercado Pago (aproximado)
  calculateMercadoPagoFee: (amount: number, paymentType: string): number => {
    const feeRates = {
      pix: 0.0099, // 0.99%
      card: 0.0399, // 3.99%
      boleto: 0.0199 // 1.99%
    };
    
    const rate = feeRates[paymentType as keyof typeof feeRates] || 0.04;
    return Math.round(amount * rate * 100) / 100;
  },

  // Calcular fee de Stripe (aproximado)
  calculateStripeFee: (amount: number): number => {
    // 2.9% + R$ 0.30
    return Math.round((amount * 0.029 + 0.30) * 100) / 100;
  }
};
