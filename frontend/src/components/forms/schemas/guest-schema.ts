// src/components/forms/schemas/guest-schema.ts
import { z } from 'zod';

// Lista de países más comunes para huéspedes
export const COMMON_COUNTRIES = {
  'AR': 'Argentina',
  'AU': 'Australia',
  'BR': 'Brasil',
  'CA': 'Canadá',
  'CL': 'Chile',
  'CO': 'Colombia',
  'DE': 'Alemania',
  'ES': 'España',
  'FR': 'Francia',
  'GB': 'Reino Unido',
  'IT': 'Italia',
  'MX': 'México',
  'NL': 'Países Bajos',
  'PE': 'Perú',
  'PT': 'Portugal',
  'US': 'Estados Unidos',
  'UY': 'Uruguay',
  'VE': 'Venezuela'
} as const;

// Códigos de área brasileños para validación de teléfonos
const BRAZIL_AREA_CODES = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // São Paulo
  '21', '22', '24', // Rio de Janeiro
  '27', '28', // Espírito Santo
  '31', '32', '33', '34', '35', '37', '38', // Minas Gerais
  '41', '42', '43', '44', '45', '46', // Paraná
  '47', '48', '49', // Santa Catarina
  '51', '53', '54', '55', // Rio Grande do Sul
  '61', // Distrito Federal
  '62', '64', // Goiás
  '63', // Tocantins
  '65', '66', // Mato Grosso
  '67', // Mato Grosso do Sul
  '68', // Acre
  '69', // Rondônia
  '71', '73', '74', '75', '77', // Bahia
  '79', // Sergipe
  '81', '87', // Pernambuco
  '82', // Alagoas
  '83', // Paraíba
  '84', // Rio Grande do Norte
  '85', '88', // Ceará
  '86', '89', // Piauí
  '91', '93', '94', // Pará
  '92', '97', // Amazonas
  '95', // Roraima
  '96', // Amapá
  '98', '99' // Maranhão
];

// Validadores personalizados
const nameValidator = z.string()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(100, 'El nombre no puede exceder 100 caracteres')
  .regex(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/, 'El nombre solo puede contener letras, espacios, guiones y apostrofes')
  .transform(name => name.trim().replace(/\s+/g, ' '));

const emailValidator = z.string()
  .email('Formato de email no válido')
  .max(255, 'El email no puede exceder 255 caracteres')
  .transform(email => email.toLowerCase().trim());

const phoneValidator = z.string()
  .min(8, 'El teléfono debe tener al menos 8 dígitos')
  .max(20, 'El teléfono no puede exceder 20 caracteres')
  .regex(/^[\+]?[\d\s\-\(\)\.]+$/, 'El teléfono contiene caracteres no válidos');

const countryValidator = z.string()
  .length(2, 'Código de país debe tener 2 caracteres')
  .regex(/^[A-Z]{2}$/, 'Código de país debe ser en mayúsculas')
  .refine(code => Object.keys(COMMON_COUNTRIES).includes(code), {
    message: 'País no soportado'
  });

// Schema principal de información del huésped
export const guestSchema = z.object({
  guestName: nameValidator,
  guestEmail: emailValidator,
  guestPhone: phoneValidator,
  guestCountry: countryValidator,
  
  specialRequests: z.string()
    .max(500, 'Las solicitudes especiales no pueden exceder 500 caracteres')
    .optional()
    .transform(text => text?.trim() || ''),

  // Preferencias de habitación
  preferredRoomType: z.enum(['mixed', 'female', 'no_preference'])
    .optional()
    .default('no_preference'),

  // Información adicional opcional
  arrivalTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora no válido (HH:MM)')
    .optional(),

  departureTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora no válido (HH:MM)')
    .optional(),

  // Consentimientos
  agreedToTerms: z.boolean()
    .refine(val => val === true, {
      message: 'Debe aceptar los términos y condiciones'
    }),

  newsletterOptIn: z.boolean()
    .optional()
    .default(false),

  // Comunicación
  preferredLanguage: z.enum(['pt', 'en', 'es'])
    .optional()
    .default('pt'),

  contactMethod: z.enum(['email', 'phone', 'whatsapp'])
    .optional()
    .default('email')
});

// Schema para validación de teléfono específica por país
export const phoneValidationSchema = z.object({
  phone: z.string(),
  country: z.string().length(2)
}).superRefine((data, ctx) => {
  const { phone, country } = data;
  const cleanPhone = phone.replace(/\D/g, '');

  switch (country) {
    case 'BR':
      // Teléfono brasileño: +55 + código de área (2 dígitos) + número (8-9 dígitos)
      if (cleanPhone.startsWith('55')) {
        const areaCode = cleanPhone.substring(2, 4);
        const number = cleanPhone.substring(4);
        
        if (!BRAZIL_AREA_CODES.includes(areaCode)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Código de área brasileño no válido',
            path: ['phone']
          });
        }
        
        if (number.length < 8 || number.length > 9) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Número de teléfono brasileño debe tener 8 o 9 dígitos',
            path: ['phone']
          });
        }
      } else {
        // Teléfono sin código de país
        if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Teléfono brasileño debe tener 10 u 11 dígitos',
            path: ['phone']
          });
        }
      }
      break;

    case 'AR':
      // Teléfono argentino
      if (cleanPhone.length < 10 || cleanPhone.length > 13) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Teléfono argentino no válido',
          path: ['phone']
        });
      }
      break;

    case 'US':
    case 'CA':
      // Teléfono estadounidense/canadiense
      if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Teléfono estadounidense/canadiense no válido',
          path: ['phone']
        });
      }
      break;

    default:
      // Validación genérica para otros países
      if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Teléfono internacional debe tener entre 8 y 15 dígitos',
          path: ['phone']
        });
      }
  }
});

// Schema para datos de contacto de emergencia (opcional)
export const emergencyContactSchema = z.object({
  name: nameValidator.optional(),
  phone: phoneValidator.optional(),
  email: emailValidator.optional(),
  relationship: z.enum(['family', 'friend', 'partner', 'other']).optional()
}).optional();

// Schema extendido con información adicional
export const extendedGuestSchema = guestSchema.extend({
  // Información demográfica opcional
  age: z.number()
    .int('La edad debe ser un número entero')
    .min(16, 'Edad mínima 16 años')
    .max(120, 'Edad máxima 120 años')
    .optional(),

  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
    .optional(),

  occupation: z.string()
    .max(100, 'La ocupación no puede exceder 100 caracteres')
    .optional(),

  // Propósito del viaje
  travelPurpose: z.enum(['tourism', 'business', 'study', 'work', 'transit', 'other'])
    .optional(),

  // Información del grupo
  groupSize: z.number()
    .int('El tamaño del grupo debe ser un número entero')
    .min(1, 'Mínimo 1 persona')
    .max(38, 'Máximo 38 personas')
    .optional(),

  isGroupLeader: z.boolean()
    .optional()
    .default(false),

  // Contacto de emergencia
  emergencyContact: emergencyContactSchema,

  // Preferencias dietéticas o alergias
  dietaryRestrictions: z.string()
    .max(300, 'Las restricciones dietéticas no pueden exceder 300 caracteres')
    .optional(),

  // Solicitudes especiales de accesibilidad
  accessibilityNeeds: z.string()
    .max(300, 'Las necesidades de accesibilidad no pueden exceder 300 caracteres')
    .optional(),

  // Experiencia previa en hostels
  previousHostelExperience: z.boolean()
    .optional(),

  // Cómo se enteró del hostel
  referralSource: z.enum(['google', 'booking', 'airbnb', 'hostelworld', 'friend', 'social_media', 'other'])
    .optional()
});

// Tipos TypeScript derivados
export type GuestFormData = z.infer<typeof guestSchema>;
export type ExtendedGuestData = z.infer<typeof extendedGuestSchema>;
export type PhoneValidationData = z.infer<typeof phoneValidationSchema>;
export type EmergencyContactData = z.infer<typeof emergencyContactSchema>;

// Funciones utilitarias
export const guestUtils = {
  // Formatear nombre
  formatName: (name: string): string => {
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  // Formatear teléfono brasileño
  formatBrazilianPhone: (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 3)} ${cleaned.substring(3, 7)}-${cleaned.substring(7)}`;
    }
    
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    
    return phone;
  },

  // Formatear teléfono internacional
  formatInternationalPhone: (phone: string, country: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    switch (country) {
      case 'BR':
        return guestUtils.formatBrazilianPhone(phone);
      case 'US':
      case 'CA':
        if (cleaned.length === 10) {
          return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
        }
        break;
    }
    
    return phone;
  },

  // Validar edad para entrada
  validateAge: (birthDate: Date): { isValid: boolean; age: number; canBook: boolean } => {
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;

    return {
      isValid: actualAge >= 16 && actualAge <= 120,
      age: actualAge,
      canBook: actualAge >= 18 // Menores de 18 requieren autorización
    };
  },

  // Obtener nombre del país
  getCountryName: (countryCode: string): string => {
    return COMMON_COUNTRIES[countryCode as keyof typeof COMMON_COUNTRIES] || countryCode;
  },

  // Validar email corporativo
  isCorporateEmail: (email: string): boolean => {
    const corporateDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? !corporateDomains.includes(domain) : false;
  }
};

// Mensajes de error personalizados
export const guestErrorMessages = {
  name: {
    required: 'El nombre es requerido',
    tooShort: 'El nombre debe tener al menos 2 caracteres',
    tooLong: 'El nombre no puede exceder 100 caracteres',
    invalidFormat: 'El nombre contiene caracteres no válidos'
  },
  email: {
    required: 'El email es requerido',
    invalid: 'Formato de email no válido',
    tooLong: 'El email es demasiado largo'
  },
  phone: {
    required: 'El teléfono es requerido',
    tooShort: 'El teléfono es demasiado corto',
    tooLong: 'El teléfono es demasiado largo',
    invalidFormat: 'Formato de teléfono no válido',
    invalidAreaCode: 'Código de área no válido'
  },
  country: {
    required: 'El país es requerido',
    invalidCode: 'Código de país no válido',
    notSupported: 'País no soportado actualmente'
  },
  terms: {
    required: 'Debe aceptar los términos y condiciones'
  }
};
