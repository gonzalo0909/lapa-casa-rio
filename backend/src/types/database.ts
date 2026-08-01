// lapa-casa-hostel/backend/src/types/database.ts

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'completed';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod = 'card' | 'pix' | 'bank_transfer' | 'cash';

export type BedGender = 'mixed' | 'female' | 'male';

export interface Guest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: BedGender | null;
  document_type: string | null;
  document_number: string | null;
  country: string | null;
  language: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoomType {
  id: string;
  code: string;
  name: string;
  capacity: number;
  default_gender: BedGender;
  is_flexible: boolean;
  base_price: number;
  created_at: Date;
  updated_at: Date;
}

export interface Bed {
  id: string;
  room_type_id: string;
  bed_code: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Reservation {
  id: string;
  reservation_number: string;
  guest_id: string;
  channel_id: string;
  external_reservation_id: string | null;
  guest_gender: BedGender | null;
  check_in_date: Date;
  check_out_date: Date;
  nights_count: number;
  beds_count: number;
  base_price: number;
  season_multiplier: number;
  group_discount: number;
  early_bird_discount: number;
  final_price: number;
  deposit_percent: number;
  deposit_amount: number;
  remaining_amount: number;
  status: BookingStatus;
  pending_expires_at: Date | null;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  refund_amount: number | null;
  special_requests: string | null;
  source: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  reservation_id: string;
  guest_id: string;
  provider: 'stripe' | 'mercadopago';
  payment_type: 'deposit' | 'remaining';
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider_payment_id: string | null;
  provider_metadata: Record<string, any> | null;
  paid_at: Date | null;
  failed_at: Date | null;
  refunded_at: Date | null;
  failure_reason: string | null;
  refund_amount: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Channel {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  commission_percent: number;
  created_at: Date;
  updated_at: Date;
}
