// lapa-casa-hostel/backend/src/database/prisma/seed.ts

import { PrismaClient, RoomType, RoomStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.roomAvailability.deleteMany();
    await prisma.guest.deleteMany();
    await prisma.room.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.systemConfig.deleteMany();
  }

  console.log('🏠 Seeding rooms...');
  await seedRooms();

  console.log('⚙️ Seeding system configuration...');
  await seedSystemConfig();

  console.log('📅 Seeding room availability...');
  await seedRoomAvailability();

  if (process.env.NODE_ENV === 'development') {
    console.log('👥 Seeding sample guests...');
    await seedSampleGuests();
    
    console.log('📝 Seeding sample bookings...');
    await seedSampleBookings();
  }

  console.log('✅ Database seed completed successfully!');
}

async function seedRooms() {
  const rooms = [
    {
      roomCode: 'room_mixto_12a',
      name: 'Mixto 12A',
      capacity: 12,
      type: RoomType.MIXED,
      isFlexible: false,
      basePrice: 60.00,
      description: 'Dormitório misto com 12 camas em beliches, ar-condicionado, armários individuais e banheiro compartilhado.',
      amenities: ['Ar-condicionado', 'Armários com cadeado', 'Tomadas individuais', 'Luz de leitura', 'Banheiro compartilhado', 'Wi-Fi gratuito'],
      images: ['/images/rooms/mixto-12a-1.jpg', '/images/rooms/mixto-12a-2.jpg'],
      status: RoomStatus.ACTIVE,
      metadata: { floor: 1, bathroomType: 'shared', hasWindow: true, squareMeters: 35 }
    },
    {
      roomCode: 'room_mixto_12b',
      name: 'Mixto 12B',
      capacity: 12,
      type: RoomType.MIXED,
      isFlexible: false,
      basePrice: 60.00,
      description: 'Dormitório misto com 12 camas em beliches, ar-condicionado, armários individuais e banheiro compartilhado.',
      amenities: ['Ar-condicionado', 'Armários com cadeado', 'Tomadas individuais', 'Luz de leitura', 'Banheiro compartilhado', 'Wi-Fi gratuito'],
      images: ['/images/rooms/mixto-12b-1.jpg', '/images/rooms/mixto-12b-2.jpg'],
      status: RoomStatus.ACTIVE,
      metadata: { floor: 2, bathroomType: 'shared', hasWindow: true, squareMeters: 35 }
    },
    {
      roomCode: 'room_mixto_7',
      name: 'Mixto 7',
      capacity: 7,
      type: RoomType.MIXED,
      isFlexible: false,
      basePrice: 60.00,
      description: 'Dormitório misto com 7 camas em beliches, ar-condicionado, armários individuais e banheiro compartilhado.',
      amenities: ['Ar-condicionado', 'Armários com cadeado', 'Tomadas individuais', 'Luz de leitura', 'Banheiro compartilhado', 'Wi-Fi gratuito'],
      images: ['/images/rooms/mixto-7-1.jpg', '/images/rooms/mixto-7-2.jpg'],
      status: RoomStatus.ACTIVE,
      metadata: { floor: 2, bathroomType: 'shared', hasWindow: true, squareMeters: 25 }
    },
    {
      roomCode: 'room_flexible_7',
      name: 'Flexible 7',
      capacity: 7,
      type: RoomType.FEMALE,
      isFlexible: true,
      basePrice: 60.00,
      autoConvertHours: 48,
      description: 'Dormitório feminino com 7 camas que converte automaticamente para misto 48h antes do check-in se não houver reservas femininas.',
      amenities: ['Ar-condicionado', 'Armários com cadeado', 'Tomadas individuais', 'Luz de leitura', 'Banheiro compartilhado', 'Wi-Fi gratuito', 'Secador de cabelo'],
      images: ['/images/rooms/flexible-7-1.jpg', '/images/rooms/flexible-7-2.jpg'],
      status: RoomStatus.ACTIVE,
      metadata: { floor: 1, bathroomType: 'shared', hasWindow: true, squareMeters: 25, flexibleConversion: true }
    }
  ];

  for (const room of rooms) {
    await prisma.room.create({ data: room });
    console.log(`  ✓ Created room: ${room.name} (${room.capacity} beds)`);
  }
}

async function seedSystemConfig() {
  const configs = [
    { key: 'group_discount_7_to_15', value: { percentage: 0.10 }, description: '10% discount for groups of 7-15 beds', isPublic: true },
    { key: 'group_discount_16_to_25', value: { percentage: 0.15 }, description: '15% discount for groups of 16-25 beds', isPublic: true },
    { key: 'group_discount_26_plus', value: { percentage: 0.20 }, description: '20% discount for groups of 26+ beds', isPublic: true },
    { key: 'season_high_multiplier', value: { multiplier: 1.50, months: [12, 1, 2, 3] }, description: 'High season multiplier (Dec-Mar): +50%', isPublic: true },
    { key: 'season_medium_multiplier', value: { multiplier: 1.00, months: [4, 5, 10, 11] }, description: 'Medium season multiplier (Apr-May, Oct-Nov): base price', isPublic: true },
    { key: 'season_low_multiplier', value: { multiplier: 0.80, months: [6, 7, 8, 9] }, description: 'Low season multiplier (Jun-Sep): -20%', isPublic: true },
    { key: 'carnival_multiplier', value: { multiplier: 2.00, minNights: 5, month: 2 }, description: 'Carnival multiplier (February): +100%, minimum 5 nights', isPublic: true },
    { key: 'deposit_standard_percentage', value: { percentage: 0.30 }, description: 'Standard deposit: 30% of total', isPublic: true },
    { key: 'deposit_large_group_percentage', value: { percentage: 0.50, threshold: 15 }, description: 'Large group deposit: 50% for 15+ people', isPublic: true },
    { key: 'auto_charge_days_before', value: { days: 7 }, description: 'Auto-charge remaining payment 7 days before check-in', isPublic: false },
    { key: 'payment_retry_attempts', value: { attempts: 3, intervalHours: 24 }, description: 'Retry failed payments 3 times with 24h interval', isPublic: false },
    { key: 'flexible_room_auto_convert_hours', value: { hours: 48 }, description: 'Auto-convert flexible room 48 hours before check-in', isPublic: false },
    { key: 'min_group_size', value: { beds: 7 }, description: 'Minimum beds to qualify for group discount', isPublic: true },
    { key: 'max_booking_advance_days', value: { days: 365 }, description: 'Maximum days in advance for bookings', isPublic: true },
    { key: 'cancellation_policy_hours', value: { hours: 48 }, description: 'Free cancellation up to 48 hours before check-in', isPublic: true },
    { key: 'contact_info', value: { email: 'reservas@lapacasahostel.com', phone: '+55 21 99999-9999', whatsapp: '+55 21 99999-9999', address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro' }, description: 'Contact information', isPublic: true }
  ];

  for (const config of configs) {
    await prisma.systemConfig.create({ data: config });
    console.log(`  ✓ Created config: ${config.key}`);
  }
}

async function seedRoomAvailability() {
  const rooms = await prisma.room.findMany();
  const startDate = new Date();
  const daysToSeed = 365;

  for (let day = 0; day < daysToSeed; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    date.setHours(0, 0, 0, 0);

    const month = date.getMonth() + 1;
    const seasonMultiplier = getSeasonMultiplier(month);

    for (const room of rooms) {
      const finalPrice = Number(room.basePrice) * seasonMultiplier;

      await prisma.roomAvailability.create({
        data: {
          roomId: room.id,
          date: date,
          totalCapacity: room.capacity,
          availableBeds: room.capacity,
          occupiedBeds: 0,
          blockedBeds: 0,
          basePrice: room.basePrice,
          seasonMultiplier: seasonMultiplier,
          finalPrice: finalPrice,
          isAvailable: true,
          isClosed: false
        }
      });
    }
  }

  console.log(`  ✓ Created availability for ${daysToSeed} days across ${rooms.length} rooms`);
}

function getSeasonMultiplier(month: number): number {
  if ([12, 1, 2, 3].includes(month)) return 1.50;
  if ([6, 7, 8, 9].includes(month)) return 0.80;
  return 1.00;
}

async function seedSampleGuests() {
  const guests = [
    { firstName: 'João', lastName: 'Silva', email: 'joao.silva@example.com', phone: '+5521987654321', whatsappNumber: '+5521987654321', nationality: 'Brazilian', language: 'pt', documentType: 'cpf', documentNumber: '123.456.789-00', newsletterOptIn: true },
    { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@example.com', phone: '+5521976543210', whatsappNumber: '+5521976543210', nationality: 'Brazilian', language: 'pt', documentType: 'cpf', documentNumber: '987.654.321-00', newsletterOptIn: true },
    { firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com', phone: '+12125551234', nationality: 'American', language: 'en', documentType: 'passport', documentNumber: 'US123456789', newsletterOptIn: false }
  ];

  for (const guest of guests) {
    await prisma.guest.create({ data: guest });
    console.log(`  ✓ Created guest: ${guest.firstName} ${guest.lastName}`);
  }
}

async function seedSampleBookings() {
  const guests = await prisma.guest.findMany();
  const rooms = await prisma.room.findMany();

  if (guests.length === 0 || rooms.length === 0) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const checkout = new Date(tomorrow);
  checkout.setDate(checkout.getDate() + 3);

  await prisma.booking.create({
    data: {
      bookingNumber: 'LCH-2025-0001',
      guestId: guests[0].id,
      roomId: rooms[0].id,
      bedsCount: 8,
      checkInDate: tomorrow,
      checkOutDate: checkout,
      nightsCount: 3,
      basePrice: 60.00,
      groupDiscount: 0.10,
      seasonMultiplier: 1.00,
      totalPrice: 1296.00,
      depositAmount: 388.80,
      depositPercent: 0.30,
      remainingAmount: 907.20,
      depositPaid: true,
      depositPaidAt: new Date(),
      status: 'CONFIRMED',
      source: 'web'
    }
  });

  console.log('  ✓ Created sample booking');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
