// lapa-casa-hostel/frontend/src/components/payment/stripe-elements.tsx

'use client';

import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeElementsWrapperProps {
  clientSecret: string;
  amount: number;
  currency: string;
  children: React.ReactNode;
}

export function StripeElementsWrapper({
  clientSecret,
  amount,
  currency,
  children
}: StripeElementsWrapperProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#dc2626',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px'
      },
      rules: {
        '.Input': {
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
          padding: '12px'
        },
        '.Input:focus': {
          border: '1px solid #2563eb',
          boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
        },
        '.Label': {
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '8px'
        }
      }
    },
    locale: currency === 'BRL' ? 'pt-BR' : 'en'
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
