// lapa-casa-hostel/backend/src/integrations/google-sheets/data-formatter.ts
//
// Formatea una fila cruda de la query de booking-export.ts (join
// reservations + guests + room_types + agregados de payments) al
// formato de columnas A-N que espera sheets-client.ts.

import type { BookingRowData } from './sheets-client';

export interface RawBookingExportRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in_date: Date | string;
  check_out_date: Date | string;
  room_assigned: string | null;
  beds_count: number;
  final_price: number | string;
  deposit_paid: number | string;
  remaining_paid: number | string;
  status: string;
  created_at: Date | string;
  special_requests: string | null;
}

function toDateOnly(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().split('T')[0];
}

export function formatBookingForSheet(row: RawBookingExportRow): BookingRowData {
  return {
    bookingId: row.id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone ?? '',
    checkIn: toDateOnly(row.check_in_date),
    checkOut: toDateOnly(row.check_out_date),
    roomAssigned: row.room_assigned ?? '',
    bedsCount: Number(row.beds_count),
    totalPrice: Number(row.final_price),
    depositPaid: Number(row.deposit_paid),
    remainingPaid: Number(row.remaining_paid),
    bookingStatus: row.status,
    createdDate: toDateOnly(row.created_at),
    notes: row.special_requests ?? ''
  };
}
