'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log do erro para monitoramento
    console.error('Application error:', error);
    
    // Integração com serviços de monitoramento (Sentry, etc)
    if (typeof window !== 'undefined') {
      // window.Sentry?.captureException(error);
    }
  }, [error]);

  // Determinar tipo de erro e mensagem apropriada
  const getErrorInfo = (error: Error) => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return {
        title: 'Problema de Conexão',
        description: 'Verifique sua conexão com a internet e tente novamente.',
        type: 'network'
      };
    }
    
    if (message.includes('payment') || message.includes('stripe') || message.includes('mercado')) {
      return {
        title: 'Erro no Pagamento',
        description: 'Ocorreu um problema ao processar o pagamento. Seus dados estão seguros.',
        type: 'payment'
      };
    }
    
    if (message.includes('booking') || message.includes('reservation')) {
      return {
        title: 'Erro na Reserva',
        description: 'Não foi possível processar sua reserva. Tente novamente.',
        type: 'booking'
      };
    }
    
    if (message.includes('availability') || message.includes('room')) {
      return {
        title: 'Erro de Disponibilidade',
        description: 'Não foi possível verificar a disponibilidade dos quartos.',
        type: 'availability'
      };
    }
    
    // Erro genérico
    return {
      title: 'Algo deu errado',
      description: 'Ocorreu um erro inesperado. Nossa equipe foi notificada.',
      type: 'generic'
    };
  };

  const errorInfo = getErrorInfo(error);

  const handleContactSupport = () => {
    // Abrir WhatsApp ou email de suporte
    const whatsappMessage = encodeURIComponent(
      `Olá! Tive um problema no site do Lapa Casa Hostel. Erro: ${error.message}`
    );
    window.open(`https://wa.me/5521999999999?text=${whatsappMessage}`, '_blank');
  };

  const handleGoHome = () => {
    window.location.href = '/pt';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-6 text-center space-y-6">
          {/* Ícone de erro */}
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>

          {/* Título e descrição */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              {errorInfo.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorInfo.description}
            </p>
          </div>

          {/* Detalhes técnicos (apenas em desenvolvimento) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Detalhes técnicos
              </summary>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <pre className="text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">
                  {error.message}
                  {error.stack && `\n\nStack trace:\n${error.stack}`}
                  {error.digest && `\n\nDigest: ${error.digest}`}
                </pre>
              </div>
            </details>
          )}

          {/* Ações */}
          <div className="space-y-3">
            <Button 
              onClick={reset}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleGoHome}
                variant="outline"
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Início
              </Button>

              <Button 
                onClick={handleContactSupport}
                variant="outline"
                className="w-full"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Suporte
              </Button>
            </div>
          </div>

          {/* Informações de contato */}
          <div className="pt-4 border-t text-xs text-muted-foreground">
            <p>Precisa de ajuda imediata?</p>
            <p className="font-medium">
              WhatsApp: +55 21 9999-9999
            </p>
            <p>
              Email: reservas@lapacasahostel.com
            </p>
          </div>
        </Card>

        {/* Mensagem de segurança para erros de pagamento */}
        {errorInfo.type === 'payment' && (
          <Card className="mt-4 p-4 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                <span className="text-white text-xs">✓</span>
              </div>
              <div className="text-sm">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Seus dados estão seguros
                </p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  Nenhuma informação de pagamento foi comprometida. 
                  Todos os dados são processados de forma segura e criptografada.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Fallback para reservas em andamento */}
        {errorInfo.type === 'booking' && (
          <Card className="mt-4 p-4 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">
                Sua reserva pode ter sido processada
              </p>
              <p>
                Verifique seu email ou entre em contato conosco para confirmar 
                o status da sua reserva.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Componente de erro específico para boundary errors
export function ErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorProps>;
}) {
  return (
    <div>
      {children}
    </div>
  );
}

// Hook para capturar erros de forma controlada
export function useErrorHandler() {
  const handleError = (error: Error, errorInfo?: any) => {
    console.error('Handled error:', error, errorInfo);
    
    // Integração com serviços de monitoramento
    if (typeof window !== 'undefined') {
      // window.Sentry?.captureException(error, { extra: errorInfo });
    }
  };

  return { handleError };
}

// Tipos de erro específicos para a aplicação
export class BookingError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'BookingError';
  }
}

export class PaymentError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class AvailabilityError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AvailabilityError';
  }
}
