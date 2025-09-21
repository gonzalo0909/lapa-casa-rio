// src/components/booking/guest-information/guest-form.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBookingStore } from '@/stores/booking-store';

const guestSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  country: z.string().min(2, 'Selecione o país'),
  document: z.string().min(8, 'Documento inválido'),
  documentType: z.enum(['cpf', 'passport', 'rg']),
  birthDate: z.string().min(10, 'Data de nascimento obrigatória'),
  emergencyContact: z.string().min(5, 'Contato de emergência obrigatório'),
  emergencyPhone: z.string().min(10, 'Telefone de emergência obrigatório'),
  specialRequests: z.string().optional(),
  arrivalTime: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
});

type GuestFormData = z.infer<typeof guestSchema>;

interface GuestFormProps {
  onSubmit: (data: GuestFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<GuestFormData>;
}

const countries = [
  { value: 'BR', label: 'Brasil' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Peru' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CA', label: 'Canadá' },
  { value: 'FR', label: 'França' },
  { value: 'DE', label: 'Alemanha' },
  { value: 'ES', label: 'Espanha' },
  { value: 'IT', label: 'Itália' },
  { value: 'UK', label: 'Reino Unido' },
  { value: 'AU', label: 'Austrália' },
  { value: 'NZ', label: 'Nova Zelândia' },
];

const documentTypes = [
  { value: 'cpf', label: 'CPF (Brasileiros)' },
  { value: 'passport', label: 'Passaporte (Estrangeiros)' },
  { value: 'rg', label: 'RG (Brasileiros)' },
];

export function GuestForm({ onSubmit, isLoading = false, initialData }: GuestFormProps) {
  const { bookingData, updateBookingData } = useBookingStore();
  const [selectedCountry, setSelectedCountry] = useState(initialData?.country || 'BR');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      country: 'BR',
      documentType: 'cpf',
      ...initialData,
    },
  });

  const watchedCountry = watch('country');

  const handleFormSubmit = (data: GuestFormData) => {
    updateBookingData({ guestInfo: data });
    onSubmit(data);
  };

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setValue('country', value);
    
    // Auto-select document type based on country
    if (value === 'BR') {
      setValue('documentType', 'cpf');
    } else {
      setValue('documentType', 'passport');
    }
  };

  const getDocumentPlaceholder = (docType: string) => {
    switch (docType) {
      case 'cpf':
        return '123.456.789-00';
      case 'passport':
        return 'A1234567';
      case 'rg':
        return '12.345.678-9';
      default:
        return 'Número do documento';
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Informações do Hóspede Principal
            </h2>
            <p className="text-gray-600 mt-1">
              Complete os dados para finalizar sua reserva
            </p>
          </div>
          {bookingData.beds && bookingData.beds > 1 && (
            <Badge variant="secondary" className="text-sm">
              Grupo de {bookingData.beds} pessoas
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Dados Pessoais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Dados Pessoais
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <Input
                {...register('fullName')}
                placeholder="João Silva Santos"
                error={errors.fullName?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <Input
                {...register('email')}
                type="email"
                placeholder="joao@email.com"
                error={errors.email?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <Input
                {...register('phone')}
                placeholder="+55 21 99999-9999"
                error={errors.phone?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                País *
              </label>
              <Select
                options={countries}
                value={selectedCountry}
                onChange={handleCountryChange}
                placeholder="Selecione o país"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Nascimento *
              </label>
              <Input
                {...register('birthDate')}
                type="date"
                error={errors.birthDate?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento *
              </label>
              <Select
                {...register('documentType')}
                options={documentTypes}
                placeholder="Selecione o tipo"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do Documento *
              </label>
              <Input
                {...register('document')}
                placeholder={getDocumentPlaceholder(watch('documentType'))}
                error={errors.document?.message}
              />
            </div>
          </div>

          {/* Contato de Emergência */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Contato de Emergência
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Contato *
                </label>
                <Input
                  {...register('emergencyContact')}
                  placeholder="Maria Silva Santos"
                  error={errors.emergencyContact?.message}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone do Contato *
                </label>
                <Input
                  {...register('emergencyPhone')}
                  placeholder="+55 21 88888-8888"
                  error={errors.emergencyPhone?.message}
                />
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Informações Adicionais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário de Chegada (estimado)
                </label>
                <Select
                  {...register('arrivalTime')}
                  options={[
                    { value: 'morning', label: 'Manhã (8h - 12h)' },
                    { value: 'afternoon', label: 'Tarde (12h - 18h)' },
                    { value: 'evening', label: 'Noite (18h - 22h)' },
                    { value: 'late', label: 'Madrugada (após 22h)' },
                  ]}
                  placeholder="Selecione o período"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restrições Alimentares
                </label>
                <Input
                  {...register('dietaryRestrictions')}
                  placeholder="Vegetariano, alérgico a..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pedidos Especiais
              </label>
              <Textarea
                {...register('specialRequests')}
                placeholder="Aniversário, lua de mel, necessidades especiais..."
                rows={3}
              />
            </div>
          </div>

          {/* Informações Importantes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">
              Informações Importantes:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Check-in: 15h00 | Check-out: 11h00</li>
              <li>• Documento oficial obrigatório na chegada</li>
              <li>• Café da manhã incluso (7h30 - 10h30)</li>
              <li>• WiFi gratuito em todas as áreas</li>
              <li>• Recepção 24h disponível</li>
            </ul>
          </div>

          {/* Botão Submit */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isValid || isLoading}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? 'Processando...' : 'Continuar para Pagamento'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
