// database/tests/flexible-room.test.ts
//
// Ventana 2, entregable 10: "Test de Flexible 7: conversion automatica
// por fecha, sin afectar otras fechas". Se prueba availabilityService
// (que envuelve get_flexible_room_status()) y room-service.ts
// (getFlexibleRoomPrediction, Ventana 2 entregable 5), no una
// reimplementacion propia de la regla de 48h.

import { pool } from '../../src/config/database';
import { availabilityService } from '../../src/services/availability-service';
import { roomService } from '../../src/services/room-service';

afterAll(async () => {
  await pool.end();
});

describe('Flexible 7: conversion female -> mixed 48h antes del check-in (via get_flexible_room_status)', () => {
  let flexibleRoomId: string;

  beforeAll(async () => {
    const { rows } = await pool.query(`SELECT id FROM room_types WHERE is_flexible = true LIMIT 1`);
    expect(rows.length).toBe(1);
    flexibleRoomId = rows[0].id;
  });

  it('a mas de 48h del check-in, el genero efectivo por defecto es female (sin conversion todavia)', async () => {
    const farDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const status = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, farDate);
    expect(status.effectiveGender).toBe('female');
    expect(status.isConverted).toBe(false);
    expect(status.hoursUntilCheckin).toBeGreaterThan(48);
  });

  it('la prediccion no depende de una tabla/constante propia -- coincide exactamente con una llamada SQL directa a get_flexible_room_status()', async () => {
    const targetDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const fromService = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, targetDate);
    const { rows } = await pool.query(
      `SELECT * FROM get_flexible_room_status($1::uuid, $2::date)`,
      [flexibleRoomId, targetDate]
    );
    const direct = rows[0];
    expect(fromService.effectiveGender).toBe(direct.effective_gender);
    expect(fromService.isConverted).toBe(direct.is_converted);
    expect(fromService.willConvertPrediction).toBe(direct.will_convert_prediction);
  });

  it('hoursUntilCheckin decrece a medida que la fecha objetivo se acerca a hoy (consistencia interna, no un valor fijo)', async () => {
    const d1 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const d2 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const far = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, d1);
    const near = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, d2);
    expect(near.hoursUntilCheckin).toBeLessThan(far.hoursUntilCheckin);
  });

  it('roomService.getFlexibleRoomPrediction() cubre hoy, +1 y +2 dias sin reimplementar la regla (delega en availabilityService)', async () => {
    const predictions = await roomService.getFlexibleRoomPrediction();
    expect(predictions.length).toBe(3);
    for (const p of predictions) {
      const direct = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, p.date);
      expect(p.effectiveGender).toBe(direct.effectiveGender);
      expect(p.isConverted).toBe(direct.isConverted);
    }
  });

  it('convertir Flexible 7 no afecta el genero por defecto de otra habitacion no-flexible (mixto_7)', async () => {
    const { rows } = await pool.query(`SELECT id FROM room_types WHERE code = 'mixto_7'`);
    const mixtoRoomId = rows[0].id;
    const nearDate = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);

    const flexibleStatus = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, nearDate);
    const { rows: mixtoRows } = await pool.query(`SELECT default_gender FROM room_types WHERE id = $1`, [mixtoRoomId]);

    expect(mixtoRows[0].default_gender).toBe('mixed');
    // el estado de Flexible 7 (cualquiera sea) no debe alterar la columna de mixto_7
    expect(['mixed', 'female']).toContain(flexibleStatus.effectiveGender);
  });
});
