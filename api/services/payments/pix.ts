import { logger } from '../../utils/logger';
import { config } from '../../config';

export interface PixData {
  bookingId: string;
  amount: number;
  description: string;
  guestName: string;
}

export class PixService {
  private pixKey: string;
  private merchantName: string;
  private merchantCity: string;

  constructor() {
    this.pixKey = config.pix?.key || 'lapacasahostel@gmail.com';
    this.merchantName = config.pix?.merchantName || 'LAPA CASA HOSTEL';
    this.merchantCity = config.pix?.merchantCity || 'RIO DE JANEIRO';
  }

  generatePixCode(data: PixData): { qrCode: string; copyPasteCode: string; expiresAt: string } {
    const txId = `LCH${data.bookingId.slice(-8)}`;
    const amount = data.amount.toFixed(2);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // Gerar payload PIX EMV
    const payload = this.generatePixPayload({
      pixKey: this.pixKey,
      merchantName: this.merchantName,
      merchantCity: this.merchantCity,
      amount: amount,
      txId: txId,
      description: data.description,
    });

    // Calcular CRC16
    const crc = this.calculateCRC16(payload);
    const copyPasteCode = payload + crc;

    logger.info('PIX code generated', { bookingId: data.bookingId, amount: data.amount, txId });

    return {
      qrCode: copyPasteCode, // Para QR code
      copyPasteCode,
      expiresAt,
    };
  }

  private generatePixPayload(data: {
    pixKey: string;
    merchantName: string;
    merchantCity: string;
    amount: string;
    txId: string;
    description: string;
  }): string {
    // Formato EMV do PIX
    let payload = '';

    // Payload Format Indicator
    payload += '0002'; // ID
    payload += '01'; // Length
    payload += '12'; // Version

    // Point of Initiation Method
    payload += '01'; // ID
    payload += '02'; // Length
    payload += '12'; // Static QR Code

    // PIX
    payload += '26'; // ID
    let pixData = '';
    pixData += '0014'; // GUI
    pixData += 'br.gov.bcb.pix'; // PIX identifier
    pixData += '01'; // Key ID
    pixData += String(data.pixKey.length).padStart(2, '0'); // Key length
    pixData += data.pixKey; // PIX key
    payload += String(pixData.length).padStart(2, '0'); // PIX data length
    payload += pixData;

    // Merchant Category Code
    payload += '52'; // ID
    payload += '04'; // Length
    payload += '0000'; // MCC

    // Transaction Currency
    payload += '53'; // ID
    payload += '03'; // Length
    payload += '986'; // BRL

    // Transaction Amount
    payload += '54'; // ID
    payload += String(data.amount.length).padStart(2, '0'); // Length
    payload += data.amount;

    // Country Code
    payload += '58'; // ID
    payload += '02'; // Length
    payload += 'BR';

    // Merchant Name
    payload += '59'; // ID
    payload += String(data.merchantName.length).padStart(2, '0'); // Length
    payload += data.merchantName;

    // Merchant City
    payload += '60'; // ID
    payload += String(data.merchantCity.length).padStart(2, '0'); // Length
    payload += data.merchantCity;

    // Additional Data Field Template
    payload += '62'; // ID
    let additionalData = '';
    additionalData += '05'; // Reference Label ID
    additionalData += String(data.txId.length).padStart(2, '0'); // Length
    additionalData += data.txId; // Transaction ID
    payload += String(additionalData.length).padStart(2, '0'); // Additional data length
    payload += additionalData;

    // CRC16 placeholder
    payload += '6304'; // CRC ID + Length

    return payload;
  }

  private calculateCRC16(payload: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      crc ^= (payload.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc <<= 1;
        }
        crc &= 0xFFFF;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  async verifyPixPayment(txId: string): Promise<{ status: string; amount?: number }> {
    // Em produção, integrar com API do banco para verificar pagamento
    // Por enquanto, mock para desenvolvimento
    logger.info('PIX payment verification requested', { txId });
    
    return {
      status: 'pending', // pending, approved, rejected
    };
  }
}
