import crypto from 'crypto';

// Stateless HMAC-based token that proves the caller received the booking
// creation response or the confirmation email — no DB storage required.
// Token is 32 hex chars (128 bits), deterministic from bookingId + JWT_SECRET.
export const generateConfirmationToken = (bookingId: string): string => {
  const secret = process.env.JWT_SECRET ?? '';
  return crypto.createHmac('sha256', secret).update(bookingId).digest('hex').slice(0, 32);
};
