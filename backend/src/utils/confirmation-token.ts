import crypto from 'crypto';

// Stateless HMAC-based token that proves the caller received the booking
// creation response or the confirmation email — no DB storage required.
// Token is 32 hex chars (128 bits), deterministic from bookingId + secret.
// Uses CONFIRMATION_TOKEN_SECRET so a JWT_SECRET rotation does not invalidate
// in-flight booking sessions, and vice-versa.
export const generateConfirmationToken = (bookingId: string): string => {
  const secret = process.env.CONFIRMATION_TOKEN_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CONFIRMATION_TOKEN_SECRET or JWT_SECRET is required');
  }
  return crypto.createHmac('sha256', secret).update(bookingId).digest('hex').slice(0, 32);
};
