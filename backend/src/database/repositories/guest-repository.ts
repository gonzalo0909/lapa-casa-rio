// lapa-casa-hostel/backend/src/database/repositories/guest-repository.ts

import { prisma } from '../../config/prisma';
import type { Guest } from '../../types/database';

function toGuest(row: any): Guest {
  return row as unknown as Guest;
}

export class GuestRepository {
  async create(data: {
    full_name: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    language?: string | null;
  }): Promise<Guest> {
    const guest = await prisma.guests.create({
      data: {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        country: data.country ?? null,
        language: data.language ?? null,
      },
    });
    return toGuest(guest);
  }

  async upsert(data: {
    full_name: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    language?: string | null;
  }): Promise<Guest> {
    const guest = await prisma.guests.upsert({
      where: { email: data.email },
      update: {
        full_name: data.full_name,
        phone: data.phone ?? undefined,
        country: data.country ?? undefined,
        language: data.language ?? undefined,
        updated_at: new Date(),
      },
      create: {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        country: data.country ?? null,
        language: data.language ?? null,
      },
    });
    return toGuest(guest);
  }

  async findById(id: string): Promise<Guest | null> {
    const guest = await prisma.guests.findUnique({ where: { id } });
    return guest ? toGuest(guest) : null;
  }

  async findByEmail(email: string): Promise<Guest | null> {
    const guest = await prisma.guests.findUnique({ where: { email } });
    return guest ? toGuest(guest) : null;
  }

  async findByPhone(phone: string): Promise<Guest | null> {
    const guest = await prisma.guests.findFirst({ where: { phone } });
    return guest ? toGuest(guest) : null;
  }

  async update(id: string, data: Partial<{
    full_name: string;
    phone: string;
    country: string;
    language: string;
  }>): Promise<Guest> {
    if (Object.keys(data).length === 0) {
      const g = await this.findById(id);
      if (!g) throw new Error('Guest not found');
      return g;
    }
    const guest = await prisma.guests.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
    });
    return toGuest(guest);
  }

  async updateStats(_id: string): Promise<void> {
    // no-op: guests table has no stats columns
  }

  async search(filters: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  }): Promise<Guest[]> {
    const where: any = {};
    if (filters.name)        where.full_name = { contains: filters.name, mode: 'insensitive' };
    if (filters.email)       where.email     = { contains: filters.email, mode: 'insensitive' };
    if (filters.phone)       where.phone     = { contains: filters.phone };
    if (filters.nationality) where.country   = { contains: filters.nationality, mode: 'insensitive' };

    const guests = await prisma.guests.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return guests.map(toGuest);
  }

  async findAll(limit: number = 50): Promise<Guest[]> {
    const guests = await prisma.guests.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return guests.map(toGuest);
  }

  async findTop(limit: number = 10): Promise<Guest[]> {
    const guests = await prisma.guests.findMany({
      where: {
        reservations: {
          some: { status: { in: ['confirmed', 'completed'] } },
        },
      },
      orderBy: { reservations: { _count: 'desc' } },
      take: limit,
    });
    return guests.map(toGuest);
  }

  async findRecent(limit: number = 20): Promise<Guest[]> {
    const guests = await prisma.guests.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return guests.map(toGuest);
  }

  async findInactive(months: number = 12): Promise<Guest[]> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const guests = await prisma.guests.findMany({
      where: {
        reservations: {
          none: { created_at: { gte: cutoff } },
        },
      },
      orderBy: { created_at: 'asc' },
    });
    return guests.map(toGuest);
  }

  async countByNationality(): Promise<Array<{ nationality: string; count: number }>> {
    const rows = await prisma.$queryRaw<Array<{ nationality: string; count: number }>>`
      SELECT country AS nationality, COUNT(*)::int AS count
      FROM guests
      WHERE country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
    `;
    return rows.map(r => ({ nationality: r.nationality, count: Number(r.count) }));
  }

  async getStatistics(): Promise<{
    totalGuests: number;
    returningGuests: number;
    topNationalities: Array<{ nationality: string; count: number }>;
  }> {
    const [totals, nats] = await Promise.all([
      prisma.$queryRaw<[{ total: number; returning: number }]>`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (
                 WHERE (SELECT COUNT(*) FROM reservations WHERE guest_id = g.id) > 1
               )::int AS returning
         FROM guests g
      `,
      this.countByNationality(),
    ]);
    return {
      totalGuests: Number(totals[0].total),
      returningGuests: Number(totals[0].returning),
      topNationalities: nats.slice(0, 5),
    };
  }

  async delete(id: string): Promise<void> {
    const count = await prisma.reservations.count({ where: { guest_id: id } });
    if (count > 0) throw new Error('Cannot delete guest with existing reservations');
    await prisma.guests.delete({ where: { id } });
  }

  async merge(primaryId: string, duplicateId: string): Promise<Guest> {
    await prisma.$transaction(async (tx) => {
      await tx.reservations.updateMany({
        where: { guest_id: duplicateId },
        data: { guest_id: primaryId },
      });
      await tx.guests.delete({ where: { id: duplicateId } });
    });
    const g = await this.findById(primaryId);
    if (!g) throw new Error('Guest not found after merge');
    return g;
  }
}

export default new GuestRepository();
