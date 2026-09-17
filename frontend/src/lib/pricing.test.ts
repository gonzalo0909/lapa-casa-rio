// lapa-casa-hostel/frontend/src/lib/pricing.test.ts
//
// Sección 13 auditoría de 17 secciones: segundo archivo de test real del
// frontend (después de utils.test.ts). Cubre pricing.ts -- lógica pura de
// validación de fechas que ambos motores de reserva (hostel/apartamentos)
// usan antes de pedirle el precio real al backend, incluyendo la regla de
// negocio de estadía mínima de 5 noches en Carnaval.

import { getSeason, calculateNights, validateCarnivalBooking, validateBookingDates, CARNIVAL_MIN_NIGHTS } from './pricing';

describe('getSeason', () => {
  it('identifica temporada de Carnaval en febrero (día 3-25)', () => {
    expect(getSeason('2027-02-10')).toBe('carnival');
    expect(getSeason('2027-02-03')).toBe('carnival');
    expect(getSeason('2027-02-25')).toBe('carnival');
  });

  it('febrero fuera del rango de Carnaval cae en temporada alta', () => {
    expect(getSeason('2027-02-01')).toBe('high');
    expect(getSeason('2027-02-27')).toBe('high');
  });

  it('identifica temporada alta (diciembre-marzo)', () => {
    expect(getSeason('2027-12-15')).toBe('high');
    expect(getSeason('2027-01-15')).toBe('high');
    expect(getSeason('2027-03-15')).toBe('high');
  });

  it('identifica temporada baja (junio-septiembre)', () => {
    expect(getSeason('2027-07-15')).toBe('low');
  });

  it('identifica temporada media (abril-mayo, octubre-noviembre)', () => {
    expect(getSeason('2027-04-15')).toBe('medium');
    expect(getSeason('2027-11-15')).toBe('medium');
  });
});

describe('calculateNights', () => {
  it('calcula noches entre dos fechas', () => {
    expect(calculateNights('2027-06-01', '2027-06-05')).toBe(4);
  });

  it('devuelve 0 si check-out no es posterior a check-in', () => {
    expect(calculateNights('2027-06-05', '2027-06-05')).toBe(0);
    expect(calculateNights('2027-06-05', '2027-06-01')).toBe(0);
  });
});

describe('validateCarnivalBooking', () => {
  it('acepta cualquier estadía fuera de Carnaval', () => {
    expect(validateCarnivalBooking('2027-07-01', '2027-07-02')).toEqual({ valid: true });
  });

  it('rechaza una estadía de Carnaval más corta que el mínimo', () => {
    const result = validateCarnivalBooking('2027-02-10', '2027-02-12');
    expect(result.valid).toBe(false);
    expect(result.message).toContain(String(CARNIVAL_MIN_NIGHTS));
  });

  it('acepta una estadía de Carnaval que cumple el mínimo de noches', () => {
    const result = validateCarnivalBooking('2027-02-10', '2027-02-15');
    expect(result.valid).toBe(true);
  });
});

describe('validateBookingDates', () => {
  it('rechaza check-in en el pasado', () => {
    const result = validateBookingDates('2020-01-01', '2020-01-05');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Check-in date cannot be in the past');
  });

  it('rechaza check-out que no es posterior al check-in', () => {
    const result = validateBookingDates('2027-06-10', '2027-06-10');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Check-out date must be after check-in date');
  });

  it('rechaza una reserva de Carnaval por debajo del mínimo de noches, incluso con fechas válidas', () => {
    const result = validateBookingDates('2027-02-10', '2027-02-12');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain(String(CARNIVAL_MIN_NIGHTS));
  });

  it('acepta una reserva válida fuera de Carnaval', () => {
    const result = validateBookingDates('2027-07-01', '2027-07-05');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
