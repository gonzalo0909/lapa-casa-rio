// lapa-casa-hostel/frontend/src/components/payment/payment-schedule.tsx

'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

interface PaymentScheduleProps {
  depositAmount: number;
  remainingAmount: number;
  currency: string;
  depositDate: string;
  remainingDate: string;
  checkInDate: string;
  depositStatus?: 'pending' | 'paid' | 'failed';
  remainingStatus?: 'pending' | 'paid' | 'scheduled' | 'failed';
}

export function PaymentSchedule({
  depositAmount,
  remainingAmount,
  currency,
  depositDate,
  remainingDate,
  checkInDate,
  depositStatus = 'pending',
  remainingStatus = 'pending'
}: PaymentScheduleProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD'
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <Badge variant="warning">Pendente</Badge>,
      paid: <Badge variant="success">Pago</Badge>,
      scheduled: <Badge variant="info">Agendado</Badge>,
