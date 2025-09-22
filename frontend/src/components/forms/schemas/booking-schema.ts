// src/components/forms/schemas/booking-schema.ts
import { z } from 'zod';

// Schema para fechas de reserva
export const datesSchema = z.object({
  checkInDate: z.date({
    required_error: 'La fecha de entrada es requerida',
    invalid_type_error: 'Fecha de entrada no válida'
  }).refine((date) => date >= new Date(), {
    message: 'La fecha de entrada debe ser futura'
  }),
  
  checkOutDate: z.date({
    required_error: 'La fecha de salida es requerida',
    invalid_type_error: 'Fecha de salida no válida'
  }),
  
  nights: z.number().int().min(1, 'Mínimo 1 noche').max(30, 'Máximo 30 noches')
}).refine((data) => data.checkOutDate > data.checkInDate, {
  message: 'La fecha de salida debe ser posterior a la entrada',
  path: ['checkOutDate']
});

// Schema para selección de habitaciones
export const roomSelectionSchema = z.object({
  roomId: z.enum(['room_mixto_12a', 'room_mixto_12b', 'room_mixto_7', 'room_flexible_7'], {
    required_error: 'ID de habitación requerido',
    invalid_type_error: 'ID de habitación no válido'
  }),
  
  beds: z.number().int().min(1, 'Mínimo 1 cama').max(12, 'Máximo 12 camas por habitación'),
  
  type: z.enum(['mixed', 'female'], {
    required_error: 'Tipo de habitación requerido'
  })
});

export const roomsSchema = z.object({
  selectedRooms: z.array(roomSelectionSchema).min(1, 'Debe seleccionar al menos una habitación'),
  
  totalBeds: z.number().int().min(1, 'Debe reservar al menos 1 cama').max(38, 'Máximo 38 camas disponibles')
}).refine((data) => {
  const calculatedTotal = data.selectedRooms.reduce((sum, room) => sum + room.beds, 0);
  return calculatedTotal === data.totalBeds;
}, {
  message: 'El total de camas no coincide con la suma de habitaciones seleccionadas',
  path: ['totalBeds']
});

// Schema para precios
export const pricingSchema = z.object({
  basePrice: z.number().positive('El precio base debe ser positivo'),
  
  totalPrice: z.number().positive('El precio total debe ser positivo'),
  
  groupDiscount: z.number().min(0, 'El descuento no puede ser negativo').max(0.5, 'Descuento máximo 50%'),
  
  seasonMultiplier: z.number().min(0.5, 'Multiplicador mínimo 0.5').max(3, 'Multiplicador máximo 3'),
  
  finalPrice: z.number().positive('El precio final debe ser positivo'),
  
  depositAmount: z.number().positive('El monto del depósito debe ser positivo'),
  
  remainingAmount: z.number().min(0, 'El monto restante no puede ser negativo')
}).refine((data) => {
  return Math.abs(data.finalPrice - (data.depositAmount + data.remainingAmount)) < 0.01;
}, {
  message: 'La suma del depósito y restante debe igual al precio final',
  path: ['finalPrice']
});

// Schema completo de reserva
export const bookingSchema = z.object({
  // Fechas
  ...datesSchema.shape,
  
  // Habitaciones
  ...roomsSchema.shape,
  
  // Precios
  ...pricingSchema.shape,
  
  // Información del huésped (se incluye por referencia)
  guestName: z.string().min(1, 'El nombre es requerido'),
  guestEmail: z.string().email('Email no válido'),
  guestPhone: z.string().min(1, 'El teléfono es requerido'),
  guestCountry: z.string().min(2, 'País requerido').max(2, 'Código de país de 2 letras'),
  specialRequests: z.string().optional(),
  
  // Pago
  paymentMethod: z.enum(['stripe', 'mercado_pago'], {
    required_error: 'Método de pago requerido'
  }),
  
  paymentType: z.enum(['card', 'pix']).optional(),
  
  // Términos
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: 'Debe aceptar los términos y condiciones'
  }),
  
  newsletterOptIn: z.boolean().optional()
});

// Schema para validación por pasos
export const stepSchemas = {
  1: datesSchema,
  2: roomsSchema,
  3: pricingSchema,
  4: z.object({
    guestName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'Máximo 100 caracteres'),
    guestEmail: z.string().email('Formato de email no válido'),
    guestPhone: z.string().min(8, 'Teléfono debe tener al menos 8 dígitos').regex(/^[\+]?[1-9][\d\s\-\(\)]{7,}$/, 'Formato de teléfono no válido'),
    guestCountry: z.string().length(2, 'Código de país de 2 letras'),
    specialRequests: z.string().max(500, 'Máximo 500 caracteres').optional(),
    agreedToTerms: z.boolean().refine((val) => val === true, {
      message: 'Debe aceptar los términos y condiciones'
    }),
    newsletterOptIn: z.boolean().optional()
  }),
  5: z.object({
    paymentMethod: z.enum(['stripe', 'mercado_pago'], {
      required_error: 'Seleccione un método de pago'
    }),
    paymentType: z.enum(['card', 'pix']).optional()
  })
};

// Tipos TypeScript derivados de los schemas
export type DatesFormData = z.infer<typeof datesSchema>;
export type RoomSelectionData = z.infer<typeof roomSelectionSchema>;
export type RoomsFormData = z.infer<typeof roomsSchema>;
export type PricingFormData = z.infer<typeof pricingSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;

// Validaciones específicas del negocio
export const businessValidations = {
  // Validar temporada de carnaval (mínimo 5 noches)
  validateCarnavalSeason: (checkInDate: Date, nights: number) => {
    const month = checkInDate.getMonth();
    const day = checkInDate.getDate();
    
    // Febrero (mes 1) generalmente carnaval
    if (month === 1 && day >= 15 && day <= 28) {
      return nights >= 5 ? null : 'Temporada de Carnaval requiere mínimo 5 noches';
    }
    return null;
  },

  // Validar disponibilidad de habitación flexible
  validateFlexibleRoom: (roomId: string, checkInDate: Date) => {
    if (roomId !== 'room_flexible_7') return null;
    
    const hoursUntilCheckIn = (checkInDate.getTime() - Date.now()) / (1000 * 60 * 60);
    
    if (hoursUntilCheckIn <= 48) {
      return 'Habitación flexible se convertirá a mixta si no hay reservas femeninas en 48h';
    }
    return null;
  },

  // Validar límites de grupo
  validateGroupLimits: (totalBeds: number, selectedRooms: RoomSelectionData[]) => {
    // Validar que no exceda capacidad por habitación
    for (const room of selectedRooms) {
      const maxCapacity = getMaxRoomCapacity(room.roomId);
      if (room.beds > maxCapacity) {
        return `Habitación ${room.roomId} excede capacidad máxima de ${maxCapacity} camas`;
      }
    }

    // Validar total máximo del hostel
    if (totalBeds > 38) {
      return 'El hostel tiene capacidad máxima de 38 camas';
    }

    return null;
  },

  // Validar descuentos de grupo
  validateGroupDiscount: (totalBeds: number, discount: number) => {
    const expectedDiscount = calculateGroupDiscount(totalBeds);
    
    if (Math.abs(discount - expectedDiscount) > 0.001) {
      return `Descuento de grupo incorrecto. Esperado: ${expectedDiscount * 100}%`;
    }
    return null;
  }
};

// Funciones auxiliares
function getMaxRoomCapacity(roomId: string): number {
  const capacities = {
    'room_mixto_12a': 12,
    'room_mixto_12b': 12,
    'room_mixto_7': 7,
    'room_flexible_7': 7
  };
  return capacities[roomId as keyof typeof capacities] || 0;
}

function calculateGroupDiscount(totalBeds: number): number {
  if (totalBeds >= 26) return 0.20;
  if (totalBeds >= 16) return 0.15;
  if (totalBeds >= 7) return 0.10;
  return 0;
}

// Schema para API requests
export const createBookingRequestSchema = z.object({
  // Fechas
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  nights: z.number().int().positive(),

  // Habitaciones
  selectedRooms: z.array(z.object({
    roomId: z.string(),
    beds: z.number().int().positive(),
    type: z.enum(['mixed', 'female'])
  })),

  // Huésped
  guest: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().min(8),
    country: z.string().length(2),
    specialRequests: z.string().max(500).optional()
  }),

  // Configuración
  paymentMethod: z.enum(['stripe', 'mercado_pago']),
  paymentType: z.enum(['card', 'pix']).optional(),
  agreedToTerms: z.boolean().refine(val => val === true),
  newsletterOptIn: z.boolean().optional()
});

export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;

// Validadores personalizados
export const customValidators = {
  isValidBrazilianPhone: (phone: string): boolean => {
    // Remove formatting
    const cleaned = phone.replace(/\D/g, '');
    
    // Brazilian phone: +55 + area code (2 digits) + number (8-9 digits)
    // Mobile: 11 digits total (9 digit number)
    // Landline: 10 digits total (8 digit number)
    return /^55[1-9]{2}[2-9][0-9]{7,8}$/.test(cleaned);
  },

  isValidInternationalPhone: (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 8 && cleaned.length <= 15;
  },

  isValidCheckInTime: (date: Date): boolean => {
    const hours = date.getHours();
    return hours >= 14; // Check-in after 2 PM
  },

  isValidCheckOutTime: (date: Date): boolean => {
    const hours = date.getHours();
    return hours <= 11; // Check-out before 11 AM
  }
};

// Error messages personalizados en español
export const errorMessages = {
  required: 'Este campo es requerido',
  invalidEmail: 'Formato de email no válido',
  invalidPhone: 'Formato de teléfono no válido',
  invalidDate: 'Fecha no válida',
  pastDate: 'La fecha debe ser futura',
  maxLength: (max: number) => `Máximo ${max} caracteres`,
  minLength: (min: number) => `Mínimo ${min} caracteres`,
  positiveNumber: 'Debe ser un número positivo',
  integerNumber: 'Debe ser un número entero',
  termsRequired: 'Debe aceptar los términos y condiciones',
  roomCapacityExceeded: 'Se ha excedido la capacidad de la habitación',
  totalCapacityExceeded: 'Se ha excedido la capacidad total del hostel',
  invalidRoomCombination: 'Combinación de habitaciones no válida',
  carnavalMinNights: 'Temporada de Carnaval requiere mínimo 5 noches',
  maxStayExceeded: 'La estadía máxima es de 30 noches'
};
