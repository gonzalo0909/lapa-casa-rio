"use strict";

const { logger } = require('./logger');

class WhatsAppService {
  constructor() {
    this.apiUrl = 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    this.businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER || '+5521999999999';
  }

  // Verificación de webhook
  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === this.verifyToken) {
        logger.info('WhatsApp webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  }

  // Procesar mensajes entrantes
  async processIncomingMessage(req, res) {
    try {
      const body = req.body;

      if (body.object === 'whatsapp_business_account') {
        body.entry?.forEach(entry => {
          const changes = entry.changes?.[0];
          
          if (changes?.field === 'messages') {
            const messages = changes.value?.messages;
            
            messages?.forEach(message => {
              this.handleIncomingMessage(message, changes.value.contacts?.[0]);
            });
          }
        });
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error('Error processing WhatsApp message:', error);
      res.sendStatus(500);
    }
  }

  async handleIncomingMessage(message, contact) {
    const phoneNumber = message.from;
    const messageText = message.text?.body?.toLowerCase();
    const contactName = contact?.profile?.name || 'Cliente';

    logger.info('WhatsApp message received', {
      from: phoneNumber,
      text: messageText,
      name: contactName
    });

    // Bot automático básico
    if (messageText) {
      if (messageText.includes('reserva') || messageText.includes('booking')) {
        await this.sendBookingInfo(phoneNumber, contactName);
      } else if (messageText.includes('precio') || messageText.includes('tarifa')) {
        await this.sendPricingInfo(phoneNumber);
      } else if (messageText.includes('ubicacion') || messageText.includes('direccion')) {
        await this.sendLocationInfo(phoneNumber);
      } else if (messageText.includes('disponibilidad')) {
        await this.sendAvailabilityInfo(phoneNumber);
      } else if (messageText.includes('cancelar')) {
        await this.sendCancellationInfo(phoneNumber);
      } else {
        await this.sendWelcomeMessage(phoneNumber, contactName);
      }
    }
  }

  // Enviar mensaje de texto
  async sendMessage(to, text) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      };

      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`);
      }

      logger.info('WhatsApp message sent', { to, text: text.substring(0, 50) });
      return await response.json();
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  // Mensajes automáticos del bot
  async sendWelcomeMessage(phoneNumber, name) {
    const message = `Hola ${name}! 👋

Bienvenido a Lapa Casa Hostel en Santa Teresa, Rio de Janeiro.

¿En qué puedo ayudarte hoy?

• 🏨 *Reservas* - Hacer una reserva
• 💰 *Precios* - Ver tarifas
• 📍 *Ubicación* - Cómo llegar
• 📅 *Disponibilidad* - Consultar fechas
• ❌ *Cancelar* - Cancelar reserva

Escribe la palabra clave o habla con nuestro equipo: ${this.businessNumber}`;

    await this.sendMessage(phoneNumber, message);
  }

  async sendBookingInfo(phoneNumber, name) {
    const message = `🏨 *Reservas - Lapa Casa Hostel*

Hola ${name}, puedes hacer tu reserva de 2 formas:

🌐 *Online (Recomendado):*
https://lapacasahostel.com

📱 *Por WhatsApp:*
Envíanos:
• Fechas de entrada y salida
• Número de huéspedes (hombres/mujeres)
• Nombre completo
• Email

💡 *Ventajas del sitio web:*
• Selección específica de camas
• Pago inmediato
• Confirmación instantánea

¿Prefieres reservar online o seguir por WhatsApp?`;

    await this.sendMessage(phoneNumber, message);
  }

  async sendPricingInfo(phoneNumber) {
    const message = `💰 *Tarifas Lapa Casa Hostel*

🛏️ *Cama en dormitorio:* R$ 55/noche

🏠 *Incluye:*
• WiFi gratis
• Desayuno básico
• Cocina compartida
• Área común
• Ubicación premium en Santa Teresa

📅 *Políticas:*
• Check-in: 14:00
• Check-out: 11:00
• Mínimo 1 noche

¿Te interesa hacer una reserva?`;

    await this.sendMessage(phoneNumber, message);
  }

  async sendLocationInfo(phoneNumber) {
    const message = `📍 *Ubicación - Lapa Casa Hostel*

🏠 *Dirección:*
Santa Teresa, Rio de Janeiro
(Dirección exacta enviada tras confirmación)

🚇 *Cómo llegar:*
• Metro: Estación Carioca (Línea 1)
• Bus: Varias líneas a Santa Teresa
• Taxi/Uber: ~15 min desde Copacabana

🎯 *Cerca de:*
• Lapa (vida nocturna)
• Centro histórico
• Escalones de Selarón
• Tranvía de Santa Teresa

📱 *Ubicación exacta:*
Te enviaremos el pin de Google Maps tras la reserva.`;

    await this.sendMessage(phoneNumber, message);
  }

  async sendAvailabilityInfo(phoneNumber) {
    const message = `📅 *Disponibilidad - Lapa Casa Hostel*

Para consultar disponibilidad en tiempo real:

🌐 *Sitio web:* https://lapacasahostel.com
(Más rápido y actualizado al minuto)

📱 *Por WhatsApp:*
Envíanos tus fechas:
• Fecha de entrada: DD/MM/YYYY
• Fecha de salida: DD/MM/YYYY
• Huéspedes: cantidad hombres/mujeres

⏰ *Tiempo de respuesta:*
• Web: Instantáneo
• WhatsApp: 10-30 minutos

¿Qué fechas te interesan?`;

    await this.sendMessage(phoneNumber, message);
  }

  async sendCancellationInfo(phoneNumber) {
    const message = `❌ *Cancelaciones - Lapa Casa Hostel*

📋 *Política de cancelación:*
• Cancelación gratuita hasta 24h antes
• Después de 24h: cargo del 50%
• No-show: cargo del 100%

📧 *Para cancelar:*
1. Envía tu código de reserva
2. Nombre completo del titular
3. Fechas de la reserva

💳 *Reembolsos:*
• Mismo método de pago
• Procesamiento: 3-7 días hábiles

¿Tienes el código de tu reserva?`;

    await this.sendMessage(phoneNumber, message);
  }

  // Notificaciones de reservas
  async notifyNewBooking(bookingData) {
    const adminNumbers = process.env.ADMIN_WHATSAPP_NUMBERS?.split(',') || [];
    
    const message = `🔔 *Nueva Reserva*

📝 *Detalles:*
• ID: ${bookingData.bookingId}
• Nombre: ${bookingData.guestName}
• Fechas: ${bookingData.checkIn} - ${bookingData.checkOut}
• Huéspedes: ${bookingData.guests}
• Total: R$ ${bookingData.total}

💳 *Pago:* ${bookingData.paymentStatus}

Ver detalles: https://lapacasahostel.com/admin`;

    for (const number of adminNumbers) {
      try {
        await this.sendMessage(number.trim(), message);
      } catch (error) {
        logger.error(`Failed to notify admin ${number}:`, error);
      }
    }
  }

  async notifyPaymentConfirmed(bookingData) {
    const adminNumbers = process.env.ADMIN_WHATSAPP_NUMBERS?.split(',') || [];
    
    const message = `💰 *Pago Confirmado*

✅ Reserva: ${bookingData.bookingId}
👤 Cliente: ${bookingData.guestName}
💵 Monto: R$ ${bookingData.total}

Estado: CONFIRMADO ✅`;

    for (const number of adminNumbers) {
      try {
        await this.sendMessage(number.trim(), message);
      } catch (error) {
        logger.error(`Failed to notify payment to admin ${number}:`, error);
      }
    }

    // Notificar también al cliente
    if (bookingData.guestPhone) {
      const guestMessage = `✅ *Pago Confirmado*

¡Hola ${bookingData.guestName}!

Tu reserva está confirmada:
• ID: ${bookingData.bookingId}
• Fechas: ${bookingData.checkIn} - ${bookingData.checkOut}
• Total pagado: R$ ${bookingData.total}

📧 Recibirás instrucciones por email.
📱 Para dudas: ${this.businessNumber}

¡Te esperamos en Lapa Casa Hostel! 🏨`;

      try {
        await this.sendMessage(bookingData.guestPhone, guestMessage);
      } catch (error) {
        logger.error('Failed to notify guest:', error);
      }
    }
  }

  // Enviar recordatorios automáticos
  async sendCheckInReminder(bookingData) {
    if (!bookingData.guestPhone) return;

    const message = `🏨 *Recordatorio Check-in*

¡Hola ${bookingData.guestName}!

Tu check-in es mañana en Lapa Casa Hostel.

📅 *Tu reserva:*
• Fecha: ${bookingData.checkIn}
• Hora: 14:00 - 22:00
• Código: ${bookingData.bookingId}

📍 *Dirección:*
[Ubicación se enviará 24h antes]

📱 *Contacto emergencia:*
${this.businessNumber}

¡Te esperamos! 😊`;

    try {
      await this.sendMessage(bookingData.guestPhone, message);
      logger.info('Check-in reminder sent', { bookingId: bookingData.bookingId });
    } catch (error) {
      logger.error('Failed to send check-in reminder:', error);
    }
  }

  // Configurar webhooks
  setupWebhookRoutes(app) {
    // Verificación del webhook
    app.get('/webhooks/whatsapp', (req, res) => {
      this.verifyWebhook(req, res);
    });

    // Procesar mensajes entrantes
    app.post('/webhooks/whatsapp', (req, res) => {
      this.processIncomingMessage(req, res);
    });
  }

  // Verificar configuración
  isConfigured() {
    return !!(this.phoneNumberId && this.accessToken && this.verifyToken);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      phoneNumberId: this.phoneNumberId ? 'set' : 'missing',
      accessToken: this.accessToken ? 'set' : 'missing',
      verifyToken: this.verifyToken ? 'set' : 'missing',
      businessNumber: this.businessNumber
    };
  }
}

module.exports = new WhatsAppService();
