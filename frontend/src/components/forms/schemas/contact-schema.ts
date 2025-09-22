// src/components/forms/schemas/contact-schema.ts
import { z } from 'zod';

// Tipos de consulta
export const INQUIRY_TYPES = {
  booking: 'Reserva',
  group: 'Grupos',
  cancellation: 'Cancelación',
  payment: 'Pago',
  facilities: 'Instalaciones',
  location: 'Ubicación',
  policies: 'Políticas',
  complaint: 'Queja',
  compliment: 'Elogio',
  other: 'Otro'
} as const;

// Prioridades de consulta
export const PRIORITY_LEVELS = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente'
} as const;

// Canales de comunicación preferidos
export const COMMUNICATION_CHANNELS = {
  email: 'Email',
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  in_person: 'En persona'
} as const;

// Schema base para contacto
export const baseContactSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s\-'\.]+$/, 'El nombre contiene caracteres no válidos')
    .transform(name => name.trim().replace(/\s+/g, ' ')),

  email: z.string()
    .email('Formato de email no válido')
    .max(255, 'El email no puede exceder 255 caracteres')
    .transform(email => email.toLowerCase().trim()),

  phone: z.string()
    .min(8, 'El teléfono debe tener al menos 8 dígitos')
    .max(20, 'El teléfono no puede exceder 20 caracteres')
    .regex(/^[\+]?[\d\s\-\(\)\.]+$/, 'El teléfono contiene caracteres no válidos')
    .optional(),

  preferredLanguage: z.enum(['pt', 'en', 'es'])
    .default('pt'),

  preferredChannel: z.enum(['email', 'phone', 'whatsapp', 'in_person'])
    .default('email'),

  inquiryType: z.enum([
    'booking', 'group', 'cancellation', 'payment', 
    'facilities', 'location', 'policies', 'complaint', 
    'compliment', 'other'
  ], {
    required_error: 'Tipo de consulta requerido'
  }),

  subject: z.string()
    .min(5, 'El asunto debe tener al menos 5 caracteres')
    .max(200, 'El asunto no puede exceder 200 caracteres'),

  message: z.string()
    .min(10, 'El mensaje debe tener al menos 10 caracteres')
    .max(2000, 'El mensaje no puede exceder 2000 caracteres'),

  priority: z.enum(['low', 'normal', 'high', 'urgent'])
    .default('normal'),

  // Consentimientos
  agreedToPrivacyPolicy: z.boolean()
    .refine(val => val === true, {
      message: 'Debe aceptar la política de privacidad'
    }),

  allowMarketing: z.boolean()
    .optional()
    .default(false)
});

// Schema para consultas de reserva específicas
export const bookingInquirySchema = baseContactSchema.extend({
  inquiryType: z.literal('booking'),
  
  // Fechas deseadas
  checkInDate: z.date({
    required_error: 'Fecha de entrada requerida',
    invalid_type_error: 'Fecha no válida'
  }).optional(),

  checkOutDate: z.date({
    required_error: 'Fecha de salida requerida',
    invalid_type_error: 'Fecha no válida'
  }).optional(),

  // Información del grupo
  numberOfGuests: z.number()
    .int('Número de huéspedes debe ser entero')
    .min(1, 'Mínimo 1 huésped')
    .max(38, 'Máximo 38 huéspedes')
    .optional(),

  roomPreference: z.enum(['mixed', 'female', 'no_preference'])
    .optional(),

  // Presupuesto aproximado
  estimatedBudget: z.number()
    .positive('El presupuesto debe ser positivo')
    .max(100000, 'Presupuesto máximo R$ 100,000')
    .optional(),

  // Información adicional
  groupType: z.enum(['friends', 'family', 'corporate', 'event', 'school', 'other'])
    .optional(),

  specialRequests: z.string()
    .max(500, 'Solicitudes especiales máximo 500 caracteres')
    .optional()
});

// Schema para consultas de grupo
export const groupInquirySchema = baseContactSchema.extend({
  inquiryType: z.literal('group'),
  
  groupSize: z.number()
    .int('Tamaño del grupo debe ser entero')
    .min(7, 'Grupos mínimo 7 personas')
    .max(38, 'Grupo máximo 38 personas'),

  eventType: z.enum([
    'birthday', 'bachelor_bachelorette', 'corporate', 
    'school', 'sports_team', 'music_band', 'retreat', 'other'
  ]).optional(),

  duration: z.number()
    .int('Duración debe ser entero')
    .min(1, 'Mínimo 1 noche')
    .max(30, 'Máximo 30 noches')
    .optional(),

  hasSpecialNeeds: z.boolean()
    .default(false),

  cateringNeeded: z.boolean()
    .default(false),

  transportationNeeded: z.boolean()
    .default(false)
});

// Schema para cancelaciones
export const cancellationInquirySchema = baseContactSchema.extend({
  inquiryType: z.literal('cancellation'),
  
  bookingReference: z.string()
    .min(5, 'Referencia de reserva muy corta')
    .max(50, 'Referencia de reserva muy larga'),

  cancellationReason: z.enum([
    'change_of_plans', 'emergency', 'dissatisfied', 
    'found_better_option', 'financial', 'health', 'other'
  ]),

  requestRefund: z.boolean()
    .default(true),

  originalBookingDate: z.date().optional()
});

// Schema para quejas
export const complaintSchema = baseContactSchema.extend({
  inquiryType: z.literal('complaint'),
  
  complaintCategory: z.enum([
    'cleanliness', 'noise', 'staff_behavior', 'facilities',
    'booking_process', 'payment_issue', 'safety', 'other'
  ]),

  incidentDate: z.date({
    required_error: 'Fecha del incidente requerida'
  }).optional(),

  bookingReference: z.string()
    .max(50, 'Referencia muy larga')
    .optional(),

  severity: z.enum(['minor', 'moderate', 'serious', 'critical'])
    .default('moderate'),

  actionRequested: z.enum([
    'explanation', 'apology', 'refund', 'compensation', 
    'policy_change', 'staff_training', 'other'
  ]).optional(),

  witnessesPresent: z.boolean()
    .default(false)
});

// Schema completo de contacto con validación discriminada
export const contactSchema = z.discriminatedUnion('inquiryType', [
  bookingInquirySchema,
  groupInquirySchema,
  cancellationInquirySchema,
  complaintSchema,
  // Esquema base para otros tipos
  baseContactSchema.extend({
    inquiryType: z.enum(['payment', 'facilities', 'location', 'policies', 'compliment', 'other'])
  })
]);

// Schema para respuesta del sistema
export const contactResponseSchema = z.object({
  ticketId: z.string(),
  status: z.enum(['received', 'in_progress', 'resolved', 'closed']),
  estimatedResponse: z.string(), // "24 horas", "48 horas", etc.
  assignedAgent: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Schema para seguimiento de tickets
export const ticketUpdateSchema = z.object({
  ticketId: z.string(),
  status: z.enum(['received', 'in_progress', 'waiting_customer', 'resolved', 'closed']),
  agentNotes: z.string().max(1000).optional(),
  customerNotified: z.boolean().default(true),
  resolutionNotes: z.string().max(2000).optional(),
  satisfactionRating: z.number().int().min(1).max(5).optional(),
  followUpRequired: z.boolean().default(false),
  followUpDate: z.date().optional()
});

// Tipos TypeScript derivados
export type ContactFormData = z.infer<typeof contactSchema>;
export type BookingInquiryData = z.infer<typeof bookingInquirySchema>;
export type GroupInquiryData = z.infer<typeof groupInquirySchema>;
export type CancellationInquiryData = z.infer<typeof cancellationInquirySchema>;
export type ComplaintData = z.infer<typeof complaintSchema>;
export type ContactResponseData = z.infer<typeof contactResponseSchema>;
export type TicketUpdateData = z.infer<typeof ticketUpdateSchema>;

// Validadores específicos
export const contactValidators = {
  // Validar horario de disponibilidad para llamadas
  validateCallTime: (preferredTime?: string): boolean => {
    if (!preferredTime) return true;
    
    const [hours, minutes] = preferredTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // Horario de atención: 9:00 - 18:00 (São Paulo time)
    return totalMinutes >= 540 && totalMinutes <= 1080; // 9:00 AM to 6:00 PM
  },

  // Determinar prioridad automática basada en tipo y contenido
  determinePriority: (
    inquiryType: string, 
    message: string, 
    hasBookingReference: boolean
  ): 'low' | 'normal' | 'high' | 'urgent' => {
    const urgentKeywords = ['emergency', 'urgent', 'immediate', 'tonight', 'today'];
    const highKeywords = ['complaint', 'problem', 'issue', 'wrong', 'error'];
    
    const lowerMessage = message.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'urgent';
    }
    
    if (inquiryType === 'complaint' || inquiryType === 'cancellation') {
      return 'high';
    }
    
    if (hasBookingReference || highKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'high';
    }
    
    if (inquiryType === 'booking' || inquiryType === 'group') {
      return 'normal';
    }
    
    return 'low';
  },

  // Validar número de referencia de reserva
  validateBookingReference: (reference: string): boolean => {
    // Formato esperado: LCH-YYYYMMDD-XXX (ej: LCH-20241215-001)
    const pattern = /^LCH-\d{8}-\d{3}$/;
    return pattern.test(reference);
  },

  // Estimar tiempo de respuesta
  estimateResponseTime: (priority: string, inquiryType: string): string => {
    const responsesTimes = {
      urgent: '2 horas',
      high: '4 horas', 
      normal: '24 horas',
      low: '48 horas'
    };

    // Ajustes específicos por tipo
    if (inquiryType === 'booking' && priority === 'normal') {
      return '12 horas';
    }
    
    if (inquiryType === 'group' && priority === 'normal') {
      return '6 horas';
    }

    return responsesTimes[priority as keyof typeof responsesTimes] || '24 horas';
  }
};

// Plantillas de respuesta automática
export const autoResponseTemplates = {
  pt: {
    booking: `Obrigado pela sua consulta sobre reservas! Recebemos sua mensagem e nossa equipe entrará em contato em até {responseTime}. 
    
Referência do ticket: {ticketId}

Para consultas urgentes, ligue: +55 21 XXXX-XXXX
WhatsApp: +55 21 XXXX-XXXX`,

    group: `Recebemos sua consulta sobre reservas para grupos! Nossa equipe especializada em grupos analisará sua solicitação e retornará em até {responseTime}.

Referência do ticket: {ticketId}

Para grupos de 15+ pessoas, oferecemos condições especiais.`,

    complaint: `Lamentamos pelo inconveniente mencionado. Sua reclamação é muito importante para nós e será analisada com prioridade máxima.

Referência do ticket: {ticketId}
Tempo estimado de resposta: {responseTime}

Nossa gerência analisará pessoalmente sua situação.`,

    general: `Obrigado por entrar em contato com o Lapa Casa Hostel! Recebemos sua mensagem e responderemos em até {responseTime}.

Referência do ticket: {ticketId}`
  }
};

// Utilitários para formulários de contacto
export const contactUtils = {
  // Generar ID de ticket único
  generateTicketId: (): string => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LCH-${dateStr}-${randomNum}`;
  },

  // Formatear mensaje para el sistema interno
  formatInternalMessage: (data: ContactFormData): string => {
    let formatted = `NOVO CONTATO - ${data.inquiryType.toUpperCase()}\n\n`;
    formatted += `Nome: ${data.name}\n`;
    formatted += `Email: ${data.email}\n`;
    formatted += `Telefone: ${data.phone || 'Não informado'}\n`;
    formatted += `Idioma: ${data.preferredLanguage}\n`;
    formatted += `Canal preferido: ${data.preferredChannel}\n\n`;
    formatted += `Assunto: ${data.subject}\n\n`;
    formatted += `Mensagem:\n${data.message}\n\n`;
    
    // Adicionar campos específicos por tipo
    if ('numberOfGuests' in data && data.numberOfGuests) {
      formatted += `Número de hóspedes: ${data.numberOfGuests}\n`;
    }
    
    if ('groupSize' in data) {
      formatted += `Tamanho do grupo: ${data.groupSize}\n`;
    }
    
    if ('bookingReference' in data && data.bookingReference) {
      formatted += `Referência da reserva: ${data.bookingReference}\n`;
    }
    
    return formatted;
  },

  // Sanitizar entrada de texto
  sanitizeInput: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript URLs
      .trim();
  }
};
