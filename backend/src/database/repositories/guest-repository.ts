// lapa-casa-hostel/backend/src/database/repositories/guest-repository.ts

import { PrismaClient, Guest } from '@prisma/client';

const prisma = new PrismaClient();

export class GuestRepository {
  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    alternativePhone?: string;
    whatsappNumber?: string;
    nationality?: string;
    language?: string;
    dateOfBirth?: Date;
    documentType?: string;
    documentNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    newsletterOptIn?: boolean;
    smsOptIn?: boolean;
    notes?: string;
    metadata?: any;
  }): Promise<Guest> {
    return await prisma.guest.create({ data });
  }

  async findById(id: string): Promise<Guest | null> {
    return await prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async findByEmail(email: string): Promise<Guest | null> {
    return await prisma.guest.findUnique({
      where: { email },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async findByPhone(phone: string): Promise<Guest | null> {
    return await prisma.guest.findFirst({
      where: { phone },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async findOrCreate(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    alternativePhone?: string;
    whatsappNumber?: string;
    nationality?: string;
    language?: string;
    dateOfBirth?: Date;
    documentType?: string;
    documentNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    newsletterOptIn?: boolean;
    smsOptIn?: boolean;
  }): Promise<Guest> {
    const existing = await this.findByEmail(data.email);

    if (existing) {
      return await this.update(existing.id, data);
    }

    return await this.create(data);
  }

  async update(id: string, data: any): Promise<Guest> {
    return await prisma.guest.update({
      where: { id },
      data
    });
  }

  async updateStats(id: string): Promise<Guest> {
    const bookings = await prisma.booking.findMany({
      where: {
        guestId: id,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] }
      },
      select: {
        totalPrice: true,
        createdAt: true
      }
    });

    const totalBookings = bookings.length;
    const totalSpent = bookings.reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const lastBooking = bookings.length > 0 
      ? bookings.reduce((latest, b) => b.createdAt > latest ? b.createdAt : latest, bookings[0].createdAt)
      : null;

    return await prisma.guest.update({
      where: { id },
      data: {
        totalBookings,
        totalSpent,
        lastBookingAt: lastBooking
      }
    });
  }

  async search(query: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  }): Promise<Guest[]> {
    const where: any = {};

    if (query.name) {
      where.OR = [
        { firstName: { contains: query.name, mode: 'insensitive' } },
        { lastName: { contains: query.name, mode: 'insensitive' } }
      ];
    }

    if (query.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }

    if (query.phone) {
      where.phone = { contains: query.phone };
    }

    if (query.nationality) {
      where.nationality = { contains: query.nationality, mode: 'insensitive' };
    }

    return await prisma.guest.findMany({
      where,
      include: {
        bookings: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            checkInDate: true,
            totalPrice: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async findRecent(limit: number = 20): Promise<Guest[]> {
    return await prisma.guest.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        bookings: {
          select: {
            bookingNumber: true,
            status: true,
            checkInDate: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  async findTop(limit: number = 10): Promise<Guest[]> {
    return await prisma.guest.findMany({
      where: {
        totalBookings: { gt: 0 }
      },
      orderBy: [
        { totalSpent: 'desc' },
        { totalBookings: 'desc' }
      ],
      take: limit,
      include: {
        bookings: {
          select: {
            bookingNumber: true,
            checkInDate: true,
            totalPrice: true
          },
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });
  }

  async findByNationality(nationality: string): Promise<Guest[]> {
    return await prisma.guest.findMany({
      where: { nationality },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findNewsletterSubscribers(): Promise<Guest[]> {
    return await prisma.guest.findMany({
      where: { newsletterOptIn: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        language: true
      }
    });
  }

  async findSMSSubscribers(): Promise<Guest[]> {
    return await prisma.guest.findMany({
      where: { smsOptIn: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsappNumber: true,
        language: true
      }
    });
  }

  async updateNewsletterPreference(id: string, optIn: boolean): Promise<Guest> {
    return await prisma.guest.update({
      where: { id },
      data: { newsletterOptIn: optIn }
    });
  }

  async updateSMSPreference(id: string, optIn: boolean): Promise<Guest> {
    return await prisma.guest.update({
      where: { id },
      data: { smsOptIn: optIn }
    });
  }

  async getStatistics(): Promise<{
    totalGuests: number;
    returningGuests: number;
    newsletterSubscribers: number;
    topNationalities: Array<{ nationality: string; count: number }>;
  }> {
    const [total, returning, newsletter, nationalities] = await Promise.all([
      prisma.guest.count(),
      prisma.guest.count({ where: { totalBookings: { gt: 1 } } }),
      prisma.guest.count({ where: { newsletterOptIn: true } }),
      prisma.guest.groupBy({
        by: ['nationality'],
        _count: { nationality: true },
        where: { nationality: { not: null } },
        orderBy: { _count: { nationality: 'desc' } },
        take: 5
      })
    ]);

    const topNationalities = nationalities.map(n => ({
      nationality: n.nationality || 'Unknown',
      count: n._count.nationality
    }));

    return {
      totalGuests: total,
      returningGuests: returning,
      newsletterSubscribers: newsletter,
      topNationalities
    };
  }

  async delete(id: string): Promise<Guest> {
    const hasBookings = await prisma.booking.count({
      where: { guestId: id }
    });

    if (hasBookings > 0) {
      throw new Error('Cannot delete guest with existing bookings');
    }

    return await prisma.guest.delete({
      where: { id }
    });
  }

  async merge(primaryGuestId: string, duplicateGuestId: string): Promise<Guest> {
    await prisma.booking.updateMany({
      where: { guestId: duplicateGuestId },
      data: { guestId: primaryGuestId }
    });

    await prisma.guest.delete({
      where: { id: duplicateGuestId }
    });

    return await this.updateStats(primaryGuestId);
  }

  async findAll(limit?: number): Promise<Guest[]> {
    return await prisma.guest.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        bookings: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            checkInDate: true,
            totalPrice: true
          },
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });
  }

  async countByNationality(): Promise<Array<{ nationality: string; count: number }>> {
    const result = await prisma.guest.groupBy({
      by: ['nationality'],
      _count: { nationality: true },
      where: { nationality: { not: null } },
      orderBy: { _count: { nationality: 'desc' } }
    });

    return result.map(r => ({
      nationality: r.nationality || 'Unknown',
      count: r._count.nationality
    }));
  }

  async findWithoutBookings(): Promise<Guest[]> {
    return await prisma.guest.findMany({
      where: { totalBookings: 0 },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findInactive(months: number = 12): Promise<Guest[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    return await prisma.guest.findMany({
      where: {
        lastBookingAt: { lt: cutoffDate }
      },
      orderBy: { lastBookingAt: 'asc' }
    });
  }
}

export default new GuestRepository();
