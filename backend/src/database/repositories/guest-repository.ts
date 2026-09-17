// lapa-casa-hostel/backend/src/database/repositories/guest-repository.ts
//
// FIX (auditoría 2026-08-30): reescrito de Prisma a SQL directo (pg) --
// era la única pieza de todo el backend que hablaba con la base por un
// ORM aparte, con su propio pool de conexiones, mientras el resto (incluida
// la transacción crítica de creación de reserva en booking-service.ts) usa
// siempre config/database.ts contra el mismo pool. Se eliminaron además 14
// de los 16 métodos que tenía esta clase (create, findById, findByEmail,
// findByPhone, updateStats, search, findAll, findTop, findRecent,
// findInactive, countByNationality, getStatistics, delete, merge): cero
// callers reales en toda la base de código -- vestigios de una capa
// CRUD+analytics genérica que nadie llegó a usar.

import type { PoolClient } from 'pg';
import { query } from '../../config/database';
import type { Guest } from '../../types/database';

export class GuestRepository {
  /**
   * FIX (2026-09-02): booking-service.ts llama a upsert() desde DENTRO de
   * la transacción de createBooking() (withTransaction), pero sin este
   * parámetro corría sobre el pool compartido vía query() -- una conexión
   * DISTINTA a la del `client` que tiene tomado el resto de la
   * transacción. Con el pool bajo presión (varias reservas concurrentes,
   * cada una reteniendo su propia conexión de transacción) eso podía
   * agotar el pool y tirar un timeout de conexión random en pleno
   * checkout ("An unexpected error occurred" genérico). Pasando `client`
   * se reusa la misma conexión: sin conexión extra y, de yapa, el upsert
   * queda atado al COMMIT/ROLLBACK real de la reserva.
   */
  async upsert(
    data: {
      full_name: string;
      email: string;
      phone?: string | null;
      country?: string | null;
      language?: string | null;
      /** CPF o pasaporte, sin normalizar -- ver nota más abajo. */
      document?: string | null;
    },
    client?: PoolClient,
  ): Promise<Guest> {
    const run = client
      ? (text: string, params: unknown[]) => client.query<Guest>(text, params)
      : (text: string, params: unknown[]) => query<Guest>(text, params);
    // FIX (2026-09-04): guests.document_number nunca se escribía en ningún
    // lugar del backend -- la lista negra de huéspedes (bookings/
    // create-booking.ts, anyDocumentBlocked()) compara CPFs contra esta
    // columna, así que nunca podía coincidir con nadie y el bloqueo no
    // tenía ningún efecto real. Se normaliza igual que normalizeCPF() en
    // create-booking.ts (solo dígitos); si tiene letras se guarda como
    // pasaporte tal cual, sin normalizar.
    const documentNumber = data.document
      ? /[a-zA-Z]/.test(data.document)
        ? data.document.trim()
        : data.document.replace(/\D/g, '')
      : null;
    const documentType = data.document
      ? /[a-zA-Z]/.test(data.document)
        ? 'passaporte'
        : 'CPF'
      : null;
    const { rows } = await run(
      `INSERT INTO guests (full_name, email, phone, country, language, document_number, document_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         full_name       = EXCLUDED.full_name,
         phone           = COALESCE(EXCLUDED.phone, guests.phone),
         country         = COALESCE(EXCLUDED.country, guests.country),
         language        = COALESCE(EXCLUDED.language, guests.language),
         document_number = COALESCE(EXCLUDED.document_number, guests.document_number),
         document_type   = COALESCE(EXCLUDED.document_type, guests.document_type),
         updated_at      = now()
       RETURNING *`,
      [
        data.full_name,
        data.email,
        data.phone ?? null,
        data.country ?? null,
        data.language ?? null,
        documentNumber,
        documentType,
      ],
    );
    return rows[0];
  }

  async setDocumentPhoto(id: string, photo: { url: string; publicId: string }): Promise<Guest> {
    const { rows } = await query<Guest>(
      `UPDATE guests
       SET document_photo_url = $2,
           document_photo_public_id = $3,
           document_photo_uploaded_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, photo.url, photo.publicId],
    );
    if (!rows[0]) {
      throw new Error('Guest not found');
    }
    return rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      full_name: string;
      phone: string;
      country: string;
      language: string;
    }>,
  ): Promise<Guest> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      const { rows } = await query<Guest>(`SELECT * FROM guests WHERE id = $1`, [id]);
      if (!rows[0]) {
        throw new Error('Guest not found');
      }
      return rows[0];
    }
    const sets = entries.map(([key], i) => `${key} = $${i + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(id);
    const { rows } = await query<Guest>(
      `UPDATE guests SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows[0]) {
      throw new Error('Guest not found');
    }
    return rows[0];
  }
}

export default new GuestRepository();
