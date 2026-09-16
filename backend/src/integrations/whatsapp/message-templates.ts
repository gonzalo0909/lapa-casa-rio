// lapa-casa-hostel/backend/src/integrations/whatsapp/message-templates.ts

interface BookingDetails {
  guestName: string;
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  bedsCount: number;
  totalPrice?: number;
  depositAmount?: number;
  remainingAmount?: number;
}

interface PaymentDetails {
  guestName: string;
  bookingId: string;
  amount: number;
  dueDate: string;
  paymentLink?: string;
}

interface CheckInDetails {
  guestName: string;
  checkInTime: string;
  address: string;
  contactPhone: string;
}

export class MessageTemplates {
  private readonly HOSTEL_NAME = 'Lapa Casa';
  private readonly HOSTEL_ADDRESS = 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro';
  private readonly HOSTEL_PHONE = '+55 21 97715-7530';
  private readonly CHECKIN_TIME = '14:00';
  private readonly CHECKOUT_TIME = '11:00';

  bookingConfirmation(details: BookingDetails): string {
    return `🎉 *Reserva Confirmada - ${this.HOSTEL_NAME}*

Olá ${details.guestName}! 👋

Sua reserva foi confirmada com sucesso! ✅

📋 *Detalhes da Reserva:*
🆔 ID: ${details.bookingId}
📅 Check-in: ${this.formatDate(details.checkInDate)}
📅 Check-out: ${this.formatDate(details.checkOutDate)}
🛏️ Quarto: ${details.roomName}
👥 Camas: ${details.bedsCount}
${details.totalPrice ? `💰 Total: R$ ${details.totalPrice.toFixed(2)}` : ''}

📍 *Endereço:*
${this.HOSTEL_ADDRESS}

⏰ Check-in: ${this.CHECKIN_TIME}
⏰ Check-out: ${this.CHECKOUT_TIME}

📞 Contato: ${this.HOSTEL_PHONE}

Nos vemos em breve! 🏠✨`;
  }

  paymentReminder(details: PaymentDetails): string {
    return `💳 *Lembrete de Pagamento - ${this.HOSTEL_NAME}*

Olá ${details.guestName}! 👋

Este é um lembrete sobre o pagamento pendente da sua reserva.

📋 *Detalhes do Pagamento:*
🆔 Reserva: ${details.bookingId}
💰 Valor: R$ ${details.amount.toFixed(2)}
📅 Vencimento: ${this.formatDate(details.dueDate)}

${details.paymentLink ? `🔗 Link de Pagamento:\n${details.paymentLink}\n\n` : ''}Para evitar o cancelamento automático, por favor efetue o pagamento até a data de vencimento.

Dúvidas? Entre em contato: ${this.HOSTEL_PHONE}

Obrigado! 🙏`;
  }

  depositConfirmation(details: BookingDetails): string {
    return `✅ *Depósito Confirmado - ${this.HOSTEL_NAME}*

Olá ${details.guestName}! 👋

Recebemos o pagamento do seu depósito! 💚

📋 *Detalhes:*
🆔 Reserva: ${details.bookingId}
💰 Depósito pago: R$ ${details.depositAmount?.toFixed(2)}
💳 Valor restante: R$ ${details.remainingAmount?.toFixed(2)}
📅 Pagamento restante até: ${this.formatDate(details.checkInDate)} (7 dias antes)

Sua reserva está garantida! ✅

Qualquer dúvida, estamos à disposição.
📞 ${this.HOSTEL_PHONE}

Até breve! 🏠`;
  }

  fullPaymentConfirmation(details: BookingDetails): string {
    return `✅ *Pagamento Completo - ${this.HOSTEL_NAME}*

Olá ${details.guestName}! 👋

Pagamento recebido com sucesso! 💚

📋 *Sua Reserva:*
🆔 ID: ${details.bookingId}
📅 Check-in: ${this.formatDate(details.checkInDate)}
📅 Check-out: ${this.formatDate(details.checkOutDate)}
🛏️ Quarto: ${details.roomName}
💰 Valor total: R$ ${details.totalPrice?.toFixed(2)} ✅ PAGO

Tudo certo! Aguardamos você! 🎉

📍 ${this.HOSTEL_ADDRESS}
📞 ${this.HOSTEL_PHONE}`;
  }

  checkInInstructions(details: CheckInDetails): string {
    return `🏠 *Instruções de Check-in - ${this.HOSTEL_NAME}*

Olá ${details.guestName}! 👋

Estamos ansiosos para recebê-lo! Aqui estão as instruções de check-in:

⏰ *Horário de Check-in:*
${details.checkInTime}

📍 *Endereço:*
${details.address}

🔑 *Procedimento:*
1. Toque a campainha na entrada
2. Nossa equipe te receberá
3. Apresente seu documento de identidade
4. Assine o termo de hospedagem
5. Receba as chaves e orientações

📦 *O que trazer:*
• Documento com foto (RG/Passaporte)
• Comprovante de reserva (este WhatsApp)
• Toalha (não fornecemos)

🚫 *Regras importantes:*
• Não fumantes
• Silêncio após 22h
• Respeite os outros hóspedes

📞 *Contato de emergência:*
${details.contactPhone}

Bem-vindo ao Rio! 🌴☀️`;
  }

  checkOutReminder(guestName: string, checkOutDate: string): string {
    return `⏰ *Lembrete de Check-out - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Esperamos que tenha tido uma ótima estadia! 😊

📅 Seu check-out é amanhã: ${this.formatDate(checkOutDate)}
⏰ Horário: ${this.CHECKOUT_TIME}

📝 *Procedimento:*
1. Organize seus pertences
2. Devolva as chaves na recepção
3. Faça o check-out com nossa equipe

💬 Como foi sua experiência?
Adoraríamos receber seu feedback!

Até a próxima! 👋
📞 ${this.HOSTEL_PHONE}`;
  }

  cancellationConfirmation(
    guestName: string,
    bookingId: string,
    refundAmount?: number
  ): string {
    const refundText = refundAmount
      ? `💰 Valor a ser reembolsado: R$ ${refundAmount.toFixed(2)}\n⏰ Prazo: 5-10 dias úteis\n\n`
      : '⚠️ Cancelamento sem reembolso conforme política.\n\n';

    return `❌ *Cancelamento Confirmado - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Sua reserva foi cancelada.

🆔 Reserva: ${bookingId}
📅 Data do cancelamento: ${this.formatDate(new Date().toISOString())}

${refundText}Esperamos recebê-lo em uma próxima oportunidade! 🙏

📞 Dúvidas: ${this.HOSTEL_PHONE}`;
  }

  earlyCheckInAvailable(guestName: string, availableTime: string): string {
    return `⏰ *Check-in Antecipado Disponível - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Boa notícia! Seu quarto está pronto! ✅

🕐 Você pode fazer check-in a partir de: ${availableTime}

📍 Endereço:
${this.HOSTEL_ADDRESS}

Nos vemos logo! 🏠`;
  }

  lateCheckOutOffer(guestName: string, newCheckOutTime: string, fee?: number): string {
    const feeText = fee
      ? `💰 Taxa adicional: R$ ${fee.toFixed(2)}`
      : '✅ Sem custo adicional';

    return `⏰ *Check-out Tardio Disponível - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Precisando de mais tempo? Oferecemos check-out tardio!

🕐 Novo horário disponível: ${newCheckOutTime}
${feeText}

Confirme conosco se tiver interesse.
📞 ${this.HOSTEL_PHONE}`;
  }

  specialOffer(guestName: string, offerDetails: string): string {
    return `🎁 *Oferta Especial - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Temos uma oferta especial para você! 🌟

${offerDetails}

Entre em contato para aproveitar:
📞 ${this.HOSTEL_PHONE}

Não perca! ⏰`;
  }

  groupBookingWelcome(
    groupLeaderName: string,
    bookingId: string,
    groupSize: number,
    checkInDate: string
  ): string {
    return `👥 *Reserva de Grupo Confirmada - ${this.HOSTEL_NAME}*

Olá ${groupLeaderName}! 👋

Sua reserva de grupo foi confirmada! 🎉

📋 *Detalhes:*
🆔 Reserva: ${bookingId}
👥 Tamanho do grupo: ${groupSize} pessoas
📅 Check-in: ${this.formatDate(checkInDate)}

🎯 *Benefícios de grupo:*
✅ Desconto automático aplicado
✅ Check-in coordenado
✅ Área comum reservada

📞 Coordenador do grupo:
Entre em contato para alinhar detalhes
${this.HOSTEL_PHONE}

Aguardamos vocês! 🏠✨`;
  }

  weatherAlert(guestName: string, checkInDate: string, weatherInfo: string): string {
    return `🌤️ *Alerta Climático - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Informação importante sobre o clima durante sua estadia:

📅 Sua chegada: ${this.formatDate(checkInDate)}
🌡️ ${weatherInfo}

💡 *Recomendações:*
• Traga roupas adequadas
• Considere um guarda-chuva/protetor solar
• Planeje atividades alternativas

Qualquer dúvida, estamos aqui!
📞 ${this.HOSTEL_PHONE}`;
  }

  emergencyNotification(guestName: string, message: string): string {
    return `⚠️ *Aviso Importante - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

${message}

📞 Contato imediato:
${this.HOSTEL_PHONE}

Equipe ${this.HOSTEL_NAME}`;
  }

  feedbackRequest(guestName: string, _checkOutDate: string): string {
    return `💬 *Sua Opinião é Importante - ${this.HOSTEL_NAME}*

Olá ${guestName}! 👋

Obrigado por se hospedar conosco! 🙏

Como foi sua experiência? Gostaríamos muito de saber!

⭐ *Avalie-nos:*
• Google Reviews
• Booking.com
• TripAdvisor

Seu feedback nos ajuda a melhorar! 💚

Esperamos recebê-lo novamente em breve!
📞 ${this.HOSTEL_PHONE}

Equipe ${this.HOSTEL_NAME} 🏠`;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekday = weekdays[date.getDay()];
    
    return `${day}/${month}/${year} (${weekday})`;
  }

  customMessage(content: string): string {
    return `${this.HOSTEL_NAME}\n\n${content}\n\n📞 ${this.HOSTEL_PHONE}`;
  }
}

export const messageTemplates = new MessageTemplates();
