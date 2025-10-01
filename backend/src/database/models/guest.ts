// lapa-casa-hostel/backend/src/database/models/guest.ts

import { PrismaClient, Guest, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class GuestModel {
  static async createGuest(data: {
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
    return await prisma.guest.create({
      data
    });
  }

  static async getGuestById(guestId: string): Promise<Guest | null> {
    return await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  static async getGuestByEmail(email: string): Promise<Guest | null> {
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

  static async getGuestByPhone(phone: string): Promise<Guest | null> {
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

  static async findOrCreateGuest(data: {
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
    const existingGuest = await this.getGuestByEmail(data.email);

    if (existingGuest) {
      return await this.updateGuest(existingGuest.id, data);
    }

    return await this.createGuest(data);
  }

  static async updateGuest(guestId: string, data: Partial<Prisma.GuestUpdateInput>): Promise<Guest> {
    return await prisma.guest.update({
      where: { id: guestId },
      data
    });
  }

  static async updateGuestStats(guestId: string): Promise<Guest> {
    const bookings = await prisma.booking.findMany({
      where: {
        guestId,
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
      where: { id: guestId },
      data: {
        totalBookings,
        totalSpent,
        lastBookingAt: lastBooking
      }
    });
  }

  static async searchGuests(query: {
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

  static async getRecentGuests(limit: number = 20): Promise<Guest[]> {
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

  static async getTopGuests(limit: number = 10): Promise<Guest[]> {
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

  static async getGuestsByNationality(nationality: string): Promise<Guest[]> {
    return await prisma.guest.findMany({
      where: { nationality },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getNewsletterSubscribers(): Promise<Guest[]> {
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

  static async getSMSSubscribers(): Promise<Guest[]> {
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

  static async updateNewsletterPreference(guestId: string, optIn: boolean): Promise<Guest> {
    return await prisma.guest.update({
      where: { id: guestId },
      data: { newsletterOptIn: optIn }
    });
  }

  static async updateSMSPreference(guestId: string, optIn: boolean): Promise<Guest> {
    return await prisma.guest.update({
      where: { id: guestId },
      data: { smsOptIn: optIn }
    });
  }

  static async getGuestStats(): Promise<{
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

  static async deleteGuest(guestId: string): Promise<Guest> {
    const hasBookings = await prisma.booking.count({
      where: { guestId }
    });

    if (hasBookings > 0) {
      throw new Error('Cannot delete guest with existing bookings');
    }

    return await prisma.guest.delete({
      where: { id: guestId }
    });
  }

  static async mergeGuests(primaryGuestId: string, duplicateGuestId: string): Promise<Guest> {
    await prisma.booking.updateMany({
      where: { guestId: duplicateGuestId },
      data: { guestId: primaryGuestId }
    });

    await prisma.guest.delete({
      where: { id: duplicateGuestId }
    });

    return await this.updateGuestStats(primaryGuestId);
  }
}

export default GuestModel;
