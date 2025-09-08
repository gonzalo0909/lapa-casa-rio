import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Crear habitaciones
  const rooms = [
    { id: 1, name: 'Cuarto 1 (Mixto)', totalBeds: 12, femaleOnly: false, basePrice: 55 },
    { id: 3, name: 'Cuarto 3 (Mixto)', totalBeds: 12, femaleOnly: false, basePrice: 55 },
    { id: 5, name: 'Cuarto 5 (Mixto)', totalBeds: 7, femaleOnly: false, basePrice: 55 },
    { id: 6, name: 'Cuarto 6 (Feminino)', totalBeds: 7, femaleOnly: true, basePrice: 60 },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { id: room.id },
      update: room,
      create: room,
    });
  }

  // Crear huésped de prueba
  const testGuest = await prisma.guest.upsert({
    where: { email: 'test@lapacasahostel.com' },
    update: {},
    create: {
      nombre: 'Test User',
      email: 'test@lapacasahostel.com',
      telefono: '(11) 99999-9999',
    },
  });

  // Crear booking de prueba
  await prisma.booking.upsert({
    where: { bookingId: 'BKG-TEST-001' },
    update: {},
    create: {
      bookingId: 'BKG-TEST-001',
      guestId: testGuest.id,
      entrada: new Date('2025-01-01T15:00:00'),
      salida: new Date('2025-01-03T11:00:00'),
      hombres: 1,
      mujeres: 1,
      totalPrice: 220,
      status: 'CONFIRMED',
      payStatus: 'PAID',
    },
  });

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
