// src/stores/payment-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Tipos para Stripe
export interface StripePaymentData {
  paymentIntentId: string | null;
  clientSecret: string | null;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  errorMessage?: string;
}

// Tipos para Mercado Pago
export interface MercadoPagoPaymentData {
  paymentId: string | null;
  preferenceId: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  paymentMethod?: 'pix' | 'credit_card' | 'debit_card';
  installments?: number;
  qrCode?: string; // Para PIX
  qrCodeData?: string;
  errorMessage?: string;
}

// Tipos para información de tarjeta
export interface CardInfo {
  brand?: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
}

// Tipos para información de pago
export interface PaymentInfo {
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  type: 'deposit' | 'remaining' | 'full';
  description: string;
  bookingId?: string;
}

// Tipos para estado de transacción
export interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  type: 'deposit' | 'remaining';
  method: 'stripe' | 'mercado_pago';
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
  errorMessage?: string;
  cardInfo?: CardInfo;
}

export interface PaymentState {
  // Método de pago seleccionado
  selectedProvider: 'stripe' | 'mercado_pago' | null;
  selectedMethod: 'card' | 'pix' | 'apple_pay' | 'google_pay' | null;
  
  // Información de pago
  paymentInfo: PaymentInfo | null;
  
  // Estados de proveedores
  stripe: StripePaymentData;
  mercadoPago: MercadoPagoPaymentData;
  
  // Transacciones
  transactions: PaymentTransaction[];
  currentTransaction: PaymentTransaction | null;
  
  // Estado general
  isProcessing: boolean;
  isVerifying: boolean;
  currentStep: 'method' | 'details' | 'processing' | 'verification' | 'completed' | 'failed';
  
  // Configuración
  environment: 'development' | 'production';
  webhookReceived: boolean;
  
  // Retry logic
  retryCount: number;
  maxRetries: number;
  retryTimeout: number;
  
  // Errores
  errors: Record<string, string>;
  
  // Acciones principales
  setSelectedProvider: (provider: PaymentState['selectedProvider']) => void;
  setSelectedMethod: (method: PaymentState['selectedMethod']) => void;
  setPaymentInfo: (info: PaymentInfo) => void;
  
  // Acciones de Stripe
  setStripePaymentIntent: (paymentIntentId: string, clientSecret: string) => void;
  updateStripeStatus: (status: StripePaymentData['status'], errorMessage?: string) => void;
  
  // Acciones de Mercado Pago
  setMercadoPagoPreference: (preferenceId: string) => void;
  setMercadoPagoPayment: (paymentId: string) => void;
  updateMercadoPagoStatus: (status: MercadoPagoPaymentData['status'], errorMessage?: string) => void;
  setPixData: (qrCode: string, qrCodeData: string) => void;
  setInstallments: (installments: number) => void;
  
  // Acciones de transacciones
  createTransaction: (transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTransaction: (id: string, updates: Partial<PaymentTransaction>) => void;
  setCurrentTransaction: (transaction: PaymentTransaction | null) => void;
  
  // Acciones de estado
  setCurrentStep: (step: PaymentState['currentStep']) => void;
  setProcessing: (processing: boolean) => void;
  setVerifying: (verifying: boolean) => void;
  setWebhookReceived: (received: boolean) => void;
  
  // Acciones de retry
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  canRetry: () => boolean;
  
  // Acciones de errores
  setError: (key: string, error: string) => void;
  clearError: (key: string) => void;
  clearAllErrors: () => void;
  
  // Acciones utilitarias
  resetPayment: () => void;
  resetProvider: (provider: 'stripe' | 'mercado_pago') => void;
  
  // Helpers
  getCurrentAmount: () => number;
  getPaymentDescription: () => string;
  isPaymentSuccessful: () => boolean;
  isPaymentFailed: () => boolean;
  getTransactionsByType: (type: 'deposit' | 'remaining') => PaymentTransaction[];
}

const initialState = {
  selectedProvider: null,
  selectedMethod: null,
  paymentInfo: null,
  stripe: {
    paymentIntentId: null,
    clientSecret: null,
    status: 'pending' as const,
  },
  mercadoPago: {
    paymentId: null,
    preferenceId: null,
    status: 'pending' as const,
    installments: 1,
  },
  transactions: [],
  currentTransaction: null,
  isProcessing: false,
  isVerifying: false,
  currentStep: 'method' as const,
  environment: 'development' as const,
  webhookReceived: false,
  retryCount: 0,
  maxRetries: 3,
  retryTimeout: 5000,
  errors: {},
};

export const usePaymentStore = create<PaymentState>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Acciones principales
      setSelectedProvider: (provider) => {
        set((state) => {
          state.selectedProvider = provider;
          state.selectedMethod = null; // Reset method when changing provider
        });
      },

      setSelectedMethod: (method) => {
        set((state) => {
          state.selectedMethod = method;
        });
      },

      setPaymentInfo: (info) => {
        set((state) => {
          state.paymentInfo = info;
        });
      },

      // Acciones de Stripe
      setStripePaymentIntent: (paymentIntentId, clientSecret) => {
        set((state) => {
          state.stripe.paymentIntentId = paymentIntentId;
          state.stripe.clientSecret = clientSecret;
          state.stripe.status = 'pending';
        });
      },

      updateStripeStatus: (status, errorMessage) => {
        set((state) => {
          state.stripe.status = status;
          if (errorMessage) {
            state.stripe.errorMessage = errorMessage;
          }
        });
      },

      // Acciones de Mercado Pago
      setMercadoPagoPreference: (preferenceId) => {
        set((state) => {
          state.mercadoPago.preferenceId = preferenceId;
        });
      },

      setMercadoPagoPayment: (paymentId) => {
        set((state) => {
          state.mercadoPago.paymentId = paymentId;
        });
      },

      updateMercadoPagoStatus: (status, errorMessage) => {
        set((state) => {
          state.mercadoPago.status = status;
          if (errorMessage) {
            state.mercadoPago.errorMessage = errorMessage;
          }
        });
      },

      setPixData: (qrCode, qrCodeData) => {
        set((state) => {
          state.mercadoPago.qrCode = qrCode;
          state.mercadoPago.qrCodeData = qrCodeData;
          state.mercadoPago.paymentMethod = 'pix';
        });
      },

      setInstallments: (installments) => {
        set((state) => {
          state.mercadoPago.installments = installments;
        });
      },

      // Acciones de transacciones
      createTransaction: (transaction) => {
        const id = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newTransaction: PaymentTransaction = {
          ...transaction,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => {
          state.transactions.push(newTransaction);
          state.currentTransaction = newTransaction;
        });
        
        return id;
      },

      updateTransaction: (id, updates) => {
        set((state) => {
          const transaction = state.transactions.find(t => t.id === id);
          if (transaction) {
            Object.assign(transaction, updates, { updatedAt: new Date() });
            if (state.currentTransaction?.id === id) {
              Object.assign(state.currentTransaction, updates, { updatedAt: new Date() });
            }
          }
        });
      },

      setCurrentTransaction: (transaction) => {
        set((state) => {
          state.currentTransaction = transaction;
        });
      },

      // Acciones de estado
      setCurrentStep: (step) => {
        set((state) => {
          state.currentStep = step;
        });
      },

      setProcessing: (processing) => {
        set((state) => {
          state.isProcessing = processing;
        });
      },

      setVerifying: (verifying) => {
        set((state) => {
          state.isVerifying = verifying;
        });
      },

      setWebhookReceived: (received) => {
        set((state) => {
          state.webhookReceived = received;
        });
      },

      // Acciones de retry
      incrementRetryCount: () => {
        set((state) => {
          state.retryCount += 1;
        });
      },

      resetRetryCount: () => {
        set((state) => {
          state.retryCount = 0;
        });
      },

      canRetry: () => {
        const state = get();
        return state.retryCount < state.maxRetries;
      },

      // Acciones de errores
      setError: (key, error) => {
        set((state) => {
          state.errors[key] = error;
        });
      },

      clearError: (key) => {
        set((state) => {
          delete state.errors[key];
        });
      },

      clearAllErrors: () => {
        set((state) => {
          state.errors = {};
        });
      },

      // Acciones utilitarias
      resetPayment: () => {
        set((state) => {
          Object.assign(state, initialState, {
            transactions: state.transactions, // Mantener historial
          });
        });
      },

      resetProvider: (provider) => {
        set((state) => {
          if (provider === 'stripe') {
            state.stripe = initialState.stripe;
          } else if (provider === 'mercado_pago') {
            state.mercadoPago = initialState.mercadoPago;
          }
        });
      },

      // Helpers
      getCurrentAmount: () => {
        const state = get();
        return state.paymentInfo?.amount || 0;
      },

      getPaymentDescription: () => {
        const state = get();
        return state.paymentInfo?.description || '';
      },

      isPaymentSuccessful: () => {
        const state = get();
        if (state.selectedProvider === 'stripe') {
          return state.stripe.status === 'succeeded';
        } else if (state.selectedProvider === 'mercado_pago') {
          return state.mercadoPago.status === 'approved';
        }
        return false;
      },

      isPaymentFailed: () => {
        const state = get();
        if (state.selectedProvider === 'stripe') {
          return state.stripe.status === 'failed';
        } else if (state.selectedProvider === 'mercado_pago') {
          return state.mercadoPago.status === 'rejected';
        }
        return false;
      },

    })),
    {
      name: 'lapa-casa-payment-storage',
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        selectedMethod: state.selectedMethod,
        paymentInfo: state.paymentInfo,
        transactions: state.transactions,
        environment: state.environment,
        retryCount: state.retryCount,
      }),
    }
  )
);

// Selectores útiles
export const useSelectedPaymentProvider = () => usePaymentStore((state) => state.selectedProvider);
export const useSelectedPaymentMethod = () => usePaymentStore((state) => state.selectedMethod);
export const usePaymentInfo = () => usePaymentStore((state) => state.paymentInfo);
export const useStripePayment = () => usePaymentStore((state) => state.stripe);
export const useMercadoPagoPayment = () => usePaymentStore((state) => state.mercadoPago);
export const useCurrentTransaction = () => usePaymentStore((state) => state.currentTransaction);
export const usePaymentTransactions = () => usePaymentStore((state) => state.transactions);
export const usePaymentStep = () => usePaymentStore((state) => state.currentStep);
export const usePaymentProcessing = () => usePaymentStore((state) => state.isProcessing);
export const usePaymentVerifying = () => usePaymentStore((state) => state.isVerifying);
export const usePaymentErrors = () => usePaymentStore((state) => state.errors);

// Hook personalizado para pagos
export const usePaymentActions = () => {
  const store = usePaymentStore();
  
  const processPayment = async () => {
    store.setProcessing(true);
    store.clearAllErrors();
    
    try {
      // Lógica de procesamiento según el proveedor
      if (store.selectedProvider === 'stripe') {
        // Procesar con Stripe
      } else if (store.selectedProvider === 'mercado_pago') {
        // Procesar con Mercado Pago
      }
    } catch (error) {
      store.setError('payment', error.message || 'Error procesando el pago');
    } finally {
      store.setProcessing(false);
    }
  };
  
  const retryPayment = async () => {
    if (!store.canRetry()) {
      store.setError('retry', 'Se alcanzó el máximo de intentos');
      return;
    }
    
    store.incrementRetryCount();
    await processPayment();
  };
  
  return {
    processPayment,
    retryPayment,
    resetPayment: store.resetPayment,
    isSuccessful: store.isPaymentSuccessful(),
    isFailed: store.isPaymentFailed(),
  };
};
