import { z } from 'zod';

// Schema para fechas
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha debe ser YYYY-MM-DD');

// Schema para disponibilidad
export const availabilityRequestSchema = z.object({
  from: dateSchema,
  to: dateSchema,
}).refine((data) => new Date(data.from) < new Date(data.to), {
  message: 'Fecha de inicio debe ser anterior a fecha fin',
});

// Schema para información del huésped
export const guestInfoSchema = z.object({
  nombre: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Nombre solo puede contener letras y espacios'),
  email: z.string()
    .email('Email inválido')
    .max(254, 'Email muy largo'),
  telefono: z.string()
    .regex(/^[\d+\-\s\(\)]{10,}$/, 'Formato de teléfono inválido')
    .optional(),
});

// Schema para selección de camas
export const bedSelectionSchema = z.object({
  roomId: z.number().int().min(1).max(6),
  bedNumber: z.number().int().min(1).max(12),
});

// Schema para solicitud de reserva
export const bookingRequestSchema = z.object({
  guest: guestInfoSchema,
  dates: z.object({
    entrada: dateSchema,
    salida: dateSchema,
  }).refine((data) => new Date(data.entrada) < new Date(data.salida), {
    message: 'Fecha de entrada debe ser anterior a fecha de salida',
  }),
  guests: z.object({
    hombres: z.number().int().min(0).max(38),
    mujeres: z.number().int().min(0).max(38),
  }).refine((data) => data.hombres + data.mujeres > 0, {
    message: 'Debe haber al menos un huésped',
  }).refine((data) => data.hombres + data.mujeres <= 38, {
    message: 'Total de huéspedes no puede exceder 38',
  }),
  beds: z.array(bedSelectionSchema).min(1, 'Debe seleccionar al menos una cama'),
  totalPrice: z.number().positive('Precio debe ser positivo'),
});

// Schema para hold
export const holdRequestSchema = z.object({
  beds: z.array(bedSelectionSchema).min(1, 'Debe seleccionar al menos una cama'),
  expiresInMinutes: z.number().int().min(1).max(60).optional().default(10),
});

// Schema para query parameters
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
});
