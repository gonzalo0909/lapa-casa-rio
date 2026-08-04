// lapa-casa-hostel/backend/src/database/models/guest.ts

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { Guest } from '../../types/database';

function toGuest(row: any): Guest {
  return row as unknown as Guest;
}

export class GuestModel {
  static async createGuest(data: {
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    language?: string;
    document_type?: string;
    document_number?: string;
  }): Promise<Guest> {
    const guest = await prisma.guests.create({
      data: {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        country: data.country ?? null,
        language: data.language ?? null,
        document_type: data.document_type ?? null,
        document_number: data.document_number ?? null,
      },
    });
    return toGuest(guest);
  }

  static async getGuestById(id: string): Promise<Guest | null> {
    const guest = await prisma.guests.findUnique({ where: { id } });
    return guest ? toGuest(guest) : null;
  }

  static async getGuestByEmail(email: string): Promise<Guest | null> {
    const guest = await prisma.guests.findUnique({ where: { email } });
    return guest ? toGuest(guest) : null;
  }

  static async getGuestByPhone(phone: string): Promise<Guest | null> {
    const guest = await prisma.guests.findFirst({ where: { phone } });
    return guest ? toGuest(guest) : null;
  }

  static async findOrCreateGuest(data: {
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    language?: string;
  }): Promise<Guest> {
    const existing = await this.getGuestByEmail(data.email);
    if (existing) return this.updateGuest(existing.id, data);
    return this.createGuest(data);
  }

  static async updateGuest(id: string, data: Partial<Guest>): Promise<Guest> {
    const { id: _id, created_at, updated_at, ...rest } = data as any;
    const guest = await prisma.guests.update({
      where: { id },
      data: { ...rest, updated_at: new Date() },
    });
    return toGuest(guest);
  }

  static async searchGuests(query: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  }): Promise<Guest[]> {
    const where: Prisma.guestsWhereInput = {};
    if (query.name)        where.full_name = { contains: query.name, mode: 'insensitive' };
    if (query.email)       where.email     = { contains: query.email, mode: 'insensitive' };
    if (query.phone)       where.phone     = { contains: query.phone };
    if (query.nationality) where.country   = { contains: query.nationality, mode: 'insensitive' };

    const guests = await prisma.guests.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return guests.map(toGuest);
  }

  static async getRecentGuests(limit = 20): Promise<Guest[]> {
    const guests = await prisma.guests.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return guests.map(toGuest);
  }

  static async getGuestStats(): Promise<{ totalGuests: number; returningGuests: number }> {
    const rows = await prisma.$queryRaw<[{ total: number; returning: number }]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE id IN (
          SELECT guest_id FROM reservations GROUP BY guest_id HAVING COUNT(*) > 1
        ))::int AS returning
      FROM guests
    `;
    return {
      totalGuests: Number(rows[0].total),
      returningGuests: Number(rows[0].returning),
    };
  }

  static async deleteGuest(id: string): Promise<void> {
    const count = await prisma.reservations.count({ where: { guest_id: id } });
    if (count > 0) throw new Error('Cannot delete guest with existing bookings');
    await prisma.guests.delete({ where: { id } });
  }

  static async mergeGuests(primaryId: string, duplicateId: string): Promise<Guest> {
    await prisma.$transaction(async (tx) => {
      await tx.reservations.updateMany({
        where: { guest_id: duplicateId },
        data: { guest_id: primaryId },
      });
      await tx.guests.delete({ where: { id: duplicateId } });
    });
    return (await this.getGuestById(primaryId))!;
  }
}

export default GuestModel;
