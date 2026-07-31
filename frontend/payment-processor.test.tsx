// lapa-casa-hostel/tests/frontend/payment-processor.test.tsx

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentProcessor } from '@/components/payment/payment-processor';
import { renderWithProviders } from './test-utils';
import * as stripeApi from '@/lib/api';

jest.mock('@stripe/stripe-js');
jest.mock('@/lib/api');

/**
 * @fileoverview Test suite for PaymentProcessor component
 * Tests Stripe, Mercado Pago, PIX integration, deposit logic, and error handling
 */

describe('PaymentProcessor Component', () => {
  const mockBooking = {
    id: 'booking_123',
    totalAmount: 1920.00,
    depositAmount: 576.00,
    remainingAmount: 1344.00,
    currency: 'BRL',
    guestEmail: 'guest@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Method Selection', () => {
    test('renders all payment options', () => {
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      expect(screen.getByText(/cartão de crédito/i)).toBeInTheDocument();
      expect(screen.getByText(/pix/i)).toBeInTheDocument();
      expect(screen.getByText(/mercado pago/i)).toBeInTheDocument();
    });

    test('allows selecting credit card payment', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      const creditCardOption = screen.getByLabelText(/cartão de crédito/i);
      await user.click(creditCardOption);

      expect(creditCardOption).toBeChecked();
      expect(screen.getByText(/dados do cartão/i)).toBeInTheDocument();
    });

    test('allows selecting PIX payment', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      const pixOption = screen.getByLabelText(/pix/i);
      await user.click(pixOption);

      expect(pixOption).toBeChecked();
      expect(screen.getByText(/qr code será gerado/i)).toBeInTheDocument();
    });

    test('shows installment options for credit card', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));

      expect(screen.getByText(/parcelamento/i)).toBeInTheDocument();
      expect(screen.getByText(/1x de R\$ 576,00/i)).toBeInTheDocument();
      expect(screen.getByText(/2x de R\$ 288,00/i)).toBeInTheDocument();
    });
  });

  describe('Deposit Logic', () => {
    test('displays 30% deposit for standard booking', () => {
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      expect(screen.getByText(/depósito \(30%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 576,00/i)).toBeInTheDocument();
    });

    test('displays 50% deposit for large groups', () => {
      const largeGroupBooking = {
        ...mockBooking,
        bedsCount: 20,
        depositAmount: 960.00,
        remainingAmount: 960.00
      };

      renderWithProviders(<PaymentProcessor booking={largeGroupBooking} />);

      expect(screen.getByText(/depósito \(50%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 960,00/i)).toBeInTheDocument();
    });

    test('shows payment breakdown', () => {
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      expect(screen.getByText(/total da reserva/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 1\.920,00/i)).toBeInTheDocument();
      expect(screen.getByText(/pagar agora/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 576,00/i)).toBeInTheDocument();
      expect(screen.getByText(/restante/i)).toBeInTheDocument();
      expect(screen.getByText(/R\$ 1\.344,00/i)).toBeInTheDocument();
    });

    test('shows remaining payment date', () => {
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      expect(screen.getByText(/a ser cobrado 7 dias antes do check-in/i)).toBeInTheDocument();
    });
  });

  describe('Stripe Integration', () => {
    test('loads stripe elements', async () => {
      (stripeApi.createPaymentIntent as jest.Mock).mockResolvedValue({
        clientSecret: 'pi_test_secret'
      });

      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      const user = userEvent.setup();
      await user.click(screen.getByLabelText(/cartão de crédito/i));

      await waitFor(() => {
        expect(screen.getByTestId('stripe-card-element')).toBeInTheDocument();
      });
    });

    test('validates card information', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));
      await user.click(screen.getByText(/pagar depósito/i));

      await waitFor(() => {
        expect(screen.getByText(/preencha os dados do cartão/i)).toBeInTheDocument();
      });
    });

    test('handles successful payment', async () => {
      const onSuccess = jest.fn();
      (stripeApi.confirmPayment as jest.Mock).mockResolvedValue({
        paymentIntent: { status: 'succeeded' }
      });

      const user = userEvent.setup();
      renderWithProviders(
        <PaymentProcessor booking={mockBooking} onSuccess={onSuccess} />
      );

      await user.click(screen.getByLabelText(/cartão de crédito/i));
      
      // Simulate valid card entry
      const cardElement = screen.getByTestId('stripe-card-element');
      fireEvent.change(cardElement, { 
        target: { complete: true, error: null } 
      });

      await user.click(screen.getByText(/pagar depósito/i));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          paymentId: expect.any(String),
          status: 'succeeded'
        });
      });
    });

    test('handles payment decline', async () => {
      (stripeApi.confirmPayment as jest.Mock).mockRejectedValue({
        type: 'card_error',
        message: 'Your card was declined'
      });

      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));

      const cardElement = screen.getByTestId('stripe-card-element');
      fireEvent.change(cardElement, { 
        target: { complete: true, error: null } 
      });

      await user.click(screen.getByText(/pagar depósito/i));

      await waitFor(() => {
        expect(screen.getByText(/cartão foi recusado/i)).toBeInTheDocument();
      });
    });

    test('handles network errors', async () => {
      (stripeApi.confirmPayment as jest.Mock).mockRejectedValue({
        type: 'api_connection_error',
        message: 'Network error'
      });

      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));

      const cardElement = screen.getByTestId('stripe-card-element');
      fireEvent.change(cardElement, { complete: true, error: null });

      await user.click(screen.getByText(/pagar depósito/i));

      await waitFor(() => {
        expect(screen.getByText(/erro de conexão/i)).toBeInTheDocument();
      });
    });
  });

  describe('PIX Integration', () => {
    test('generates PIX QR code', async () => {
      (stripeApi.createPixPayment as jest.Mock).mockResolvedValue({
        qrCode: 'pix_qr_code_data',
        qrCodeUrl: 'https://example.com/qr.png',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });

      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/pix/i));
      await user.click(screen.getByText(/gerar código pix/i));

      await waitFor(() => {
        expect(screen.getByAltText(/qr code pix/i)).toBeInTheDocument();
        expect(screen.getByText(/copiar código/i)).toBeInTheDocument();
      });
    });

    test('copies PIX code to clipboard', async () => {
      const mockClipboard = jest.fn();
      Object.assign(navigator, {
        clipboard: { writeText: mockClipboard }
      });

      (stripeApi.createPixPayment as jest.Mock).mockResolvedValue({
        qrCode: 'pix_qr_code_data',
        qrCodeUrl: 'https://example.com/qr.png'
      });

      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/pix/i));
      await user.click(screen.getByText(/gerar código pix/i));

      await waitFor(() => {
        expect(screen.getByText(/copiar código/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/copiar código/i));

      expect(mockClipboard).toHaveBeenCalledWith('pix_qr_code_data');
      expect(screen.getByText(/código copiado/i)).toBeInTheDocument();
    });

    test('shows PIX expiration countdown', async () => {
      jest.useFakeTimers();

      (stripeApi.createPixPayment as jest.Mock).mockResolvedValue({
        qrCode: 'pix_qr_code_data',
        qrCodeUrl: 'https://example.com/qr.png',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });

      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/pix/i));
      await user.click(screen.getByText(/gerar código pix/i));

      await waitFor(() => {
        expect(screen.getByText(/expira em: 30:00/i)).toBeInTheDocument();
      });

      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        expect(screen.getByText(/expira em: 29:00/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('polls for PIX payment confirmation', async () => {
      (stripeApi.createPixPayment as jest.Mock).mockResolvedValue({
        qrCode: 'pix_qr_code_data',
        paymentId: 'pix_123'
      });

      (stripeApi.checkPaymentStatus as jest.Mock)
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'succeeded' });

      const onSuccess = jest.fn();
      const user = userEvent.setup();
      
      renderWithProviders(
        <PaymentProcessor booking={mockBooking} onSuccess={onSuccess} />
      );

      await user.click(screen.getByLabelText(/pix/i));
      await user.click(screen.getByText(/gerar código pix/i));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      }, { timeout: 15000 });
    });
  });

  describe('Mercado Pago Integration', () => {
    test('loads Mercado Pago elements', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/mercado pago/i));

      await waitFor(() => {
        expect(screen.getByTestId('mp-card-form')).toBeInTheDocument();
      });
    });

    test('shows installment options with interest', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/mercado pago/i));

      await waitFor(() => {
        expect(screen.getByText(/1x sem juros/i)).toBeInTheDocument();
        expect(screen.getByText(/2x sem juros/i)).toBeInTheDocument();
        expect(screen.getByText(/3x com juros/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security and Validation', () => {
    test('does not expose sensitive data in DOM', () => {
      const { container } = renderWithProviders(
        <PaymentProcessor booking={mockBooking} />
      );

      expect(container.innerHTML).not.toContain(mockBooking.guestEmail);
      expect(container.innerHTML).not.toContain('credit_card');
    });

    test('disables submit during processing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));

      const submitButton = screen.getByText(/pagar depósito/i);
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/processando/i)).toBeInTheDocument();
    });

    test('prevents double submission', async () => {
      const onSuccess = jest.fn();
      (stripeApi.confirmPayment as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const user = userEvent.setup();
      renderWithProviders(
        <PaymentProcessor booking={mockBooking} onSuccess={onSuccess} />
      );

      await user.click(screen.getByLabelText(/cartão de crédito/i));

      const cardElement = screen.getByTestId('stripe-card-element');
      fireEvent.change(cardElement, { complete: true, error: null });

      const submitButton = screen.getByText(/pagar depósito/i);
      
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      await waitFor(() => {
        expect(stripeApi.confirmPayment).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility', () => {
    test('announces payment status to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));
      await user.click(screen.getByText(/pagar depósito/i));

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/processando pagamento/i);
    });

    test('has proper form labels', () => {
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      expect(screen.getByLabelText(/método de pagamento/i)).toBeInTheDocument();
    });

    test('keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.tab();
      expect(screen.getByLabelText(/cartão de crédito/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/pix/i)).toHaveFocus();
    });
  });

  describe('Error Recovery', () => {
    test('allows retry after failure', async () => {
      (stripeApi.confirmPayment as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ paymentIntent: { status: 'succeeded' } });

      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));

      const cardElement = screen.getByTestId('stripe-card-element');
      fireEvent.change(cardElement, { complete: true, error: null });

      await user.click(screen.getByText(/pagar depósito/i));

      await waitFor(() => {
        expect(screen.getByText(/tentar novamente/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/tentar novamente/i));

      await waitFor(() => {
        expect(screen.getByText(/pagamento confirmado/i)).toBeInTheDocument();
      });
    });

    test('clears error on method change', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentProcessor booking={mockBooking} />);

      await user.click(screen.getByLabelText(/cartão de crédito/i));
      await user.click(screen.getByText(/pagar depósito/i));

      await waitFor(() => {
        expect(screen.getByText(/preencha os dados do cartão/i)).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(/pix/i));

      expect(screen.queryByText(/preencha os dados do cartão/i)).not.toBeInTheDocument();
    });
  });
});
