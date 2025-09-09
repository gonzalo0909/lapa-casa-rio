"use strict";

const { createClient } = require('redis');

async function verifyEnvironment() {
  console.log('🔍 VERIFICACIÓN PRE-PRODUCCIÓN\n');
  
  const checks = [];
  
  // 1. Variables de entorno críticas
  console.log('1. Variables de entorno...');
  const requiredEnvs = [
    'NODE_ENV',
    'PORT', 
    'REDIS_URL',
    'BOOKINGS_WEBAPP_URL',
    'STRIPE_SECRET_KEY',
    'MP_ACCESS_TOKEN',
    'ADMIN_TOKEN'
  ];
  
  for (const env of requiredEnvs) {
    const exists = !!process.env[env];
    console.log(`   ${env}: ${exists ? '✅' : '❌'}`);
    checks.push({ name: env, pass: exists });
  }
  
  // 2. Verificar clave Stripe
  console.log('\n2. Stripe configuration...');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeValid = stripeKey && stripeKey.startsWith('sk_');
  console.log(`   Stripe key format: ${stripeValid ? '✅' : '❌ Debe empezar con sk_'}`);
  checks.push({ name: 'stripe_key', pass: stripeValid });
  
  // 3. Conectividad Redis
  console.log('\n3. Redis connection...');
  try {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: true,
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    await client.ping();
    await client.quit();
    
    console.log('   Redis: ✅ Conectado');
    checks.push({ name: 'redis', pass: true });
  } catch (err) {
    console.log(`   Redis: ❌ ${err.message}`);
    checks.push({ name: 'redis', pass: false });
  }
  
  // 4. Google Sheets
  console.log('\n4. Google Sheets API...');
  try {
    const response = await fetch(process.env.BOOKINGS_WEBAPP_URL + '?mode=health');
    const sheetsOk = response.ok;
    console.log(`   Sheets API: ${sheetsOk ? '✅' : '❌'} (${response.status})`);
    checks.push({ name: 'sheets', pass: sheetsOk });
  } catch (err) {
    console.log(`   Sheets API: ❌ ${err.message}`);
    checks.push({ name: 'sheets', pass: false });
  }
  
  // 5. Resumen
  console.log('\n📊 RESUMEN:');
  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  
  console.log(`   Pasaron: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 ¡Listo para producción!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Corregir errores antes de desplegar');
    const failed = checks.filter(c => !c.pass);
    console.log('   Fallaron:', failed.map(f => f.name).join(', '));
    process.exit(1);
  }
}

verifyEnvironment().catch(console.error);
