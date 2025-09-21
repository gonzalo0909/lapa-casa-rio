// src/components/booking/guest-information/special-requests.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { 
  Heart, 
  Gift, 
  Utensils, 
  Bed, 
  Clock, 
  Users, 
  Star,
  Info,
  CheckCircle
} from 'lucide-react';

const specialRequestsSchema = z.object({
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
  roomPreferences: z.array(z.string()).default([]),
  dietaryRestrictions: z.string().optional(),
  accessibilityNeeds: z.string().optional(),
  celebrationDetails: z.string().optional(),
  groupOrganization: z.string().optional(),
  additionalServices: z.array(z.string()).default([]),
  specialRequests: z.string().optional(),
  emergencyInformation: z.string().optional(),
  transportationNeeds: z.string().optional(),
});

type SpecialRequestsData = z.infer<typeof specialRequestsSchema>;

interface SpecialRequestsProps {
  onSubmit: (data: SpecialRequestsData) => void;
  onBack: () => void;
  isLoading?: boolean;
  initialData?: Partial<SpecialRequestsData>;
  groupSize?: number;
}

const arrivalTimes = [
  { value: 'early-morning', label: 'Madrugada (6h - 9h)' },
  { value: 'morning', label: 'Manhã (9h - 12h)' },
  { value: 'afternoon', label: 'Tarde (12h - 15h)' },
  { value: 'check-in', label: 'Horário check-in (15h - 18h)' },
  { value: 'evening', label: 'Noite (18h - 21h)' },
  { value: 'late-night', label: 'Madrugada (após 21h)' },
];

const roomPreferences = [
  { value: 'quiet-area', label: 'Área mais silenciosa' },
  { value: 'near-bathroom', label: 'Próximo ao banheiro' },
  { value: 'window-view', label: 'Cama com vista para janela' },
  { value: 'lower-bunk', label: 'Beliche inferior' },
  { value: 'same-room', label: 'Todo grupo no mesmo quarto' },
  { value: 'separate-rooms', label: 'Dividir grupo em quartos separados' },
];

const additionalServices = [
  { 
    value: 'early-checkin', 
    label: 'Check-in antecipado (R$ 30)', 
    description: 'Check-in antes das 15h'
  },
  { 
    value: 'late-checkout', 
    label: 'Check-out tardio (R$ 25)', 
    description: 'Check-out após as 11h'
  },
  { 
    value: 'luggage-storage', 
    label: 'Guarda-volumes extra (R$ 15/dia)', 
    description: 'Armazenamento antes/depois da estadia'
  },
  { 
    value: 'airport-transfer', 
    label: 'Transfer aeroporto (R$ 80)', 
    description: 'Van compartilhada'
  },
  { 
    value: 'laundry-service', 
    label: 'Serviço de lavanderia (R$ 20)', 
    description: 'Lavagem e secagem'
  },
  { 
    value: 'tour-booking', 
    label: 'Reserva de tours', 
    description: 'Cristo Redentor, Pão de Açúcar, etc.'
  },
];

export function SpecialRequests({ 
  onSubmit, 
  onBack, 
  isLoading = false, 
  initialData,
  groupSize = 1
}: SpecialRequestsProps) {
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>(
    initialData?.roomPreferences || []
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(
    initialData?.additionalServices || []
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
  } = useForm<SpecialRequestsData>({
    resolver: zodResolver(specialRequestsSchema),
    defaultValues: {
      roomPreferences: [],
      additionalServices: [],
      ...initialData,
    },
  });

  const watchedCelebration = watch('celebrationDetails');

  const handleFormSubmit = (data: SpecialRequestsData) => {
    const formData = {
      ...data,
      roomPreferences: selectedPreferences,
      additionalServices: selectedServices,
    };
    onSubmit(formData);
  };

  const handlePreferenceChange = (value: string, checked: boolean) => {
    const updated = checked 
      ? [...selectedPreferences, value]
      : selectedPreferences.filter(p => p !== value);
    
    setSelectedPreferences(updated);
    setValue('roomPreferences', updated);
  };

  const handleServiceChange = (value: string, checked: boolean) => {
    const updated = checked 
      ? [...selectedServices, value]
      : selectedServices.filter(s => s !== value);
    
    setSelectedServices(updated);
    setValue('additionalServices', updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Star className="w-5 h-5 mr-2 text-purple-600" />
              Pedidos Especiais
            </h2>
            <p className="text-gray-600 mt-1">
              Personalize sua experiência no Lapa Casa Hostel
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs">
              Passo 3 de 3
            </Badge>
            {groupSize > 1 && (
              <Badge className="bg-purple-100 text-purple-800 text-xs">
                {groupSize} pessoas
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
          {/* Horários de Chegada e Saída */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-purple-600" />
              Horários
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário de Chegada Estimado
                </label>
                <Select
                  {...register('arrivalTime')}
                  options={arrivalTimes}
                  placeholder="Selecione o horário"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Check-in oficial: 15h00
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário de Saída Estimado
                </label>
                <Select
                  {...register('departureTime')}
                  options={[
                    { value: 'early', label: 'Madrugada (antes 8h)' },
                    { value: 'morning', label: 'Manhã (8h - 11h)' },
                    { value: 'check-out', label: 'Horário check-out (11h)' },
                    { value: 'afternoon', label: 'Tarde (após 11h)' },
                  ]}
                  placeholder="Selecione o horário"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Check-out oficial: 11h00
                </p>
              </div>
            </div>
          </div>

          {/* Preferências de Quarto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bed className="w-5 h-5 mr-2 text-purple-600" />
              Preferências de Acomodação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roomPreferences.map((preference) => (
                <Checkbox
                  key={preference.value}
                  checked={selectedPreferences.includes(preference.value)}
                  onChange={(checked) => handlePreferenceChange(preference.value, checked)}
                  label={preference.label}
                />
              ))}
            </div>

            {groupSize > 1 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4" />
                <p className="text-sm text-blue-800">
                  Para grupos de {groupSize} pessoas, faremos o possível para atender suas preferências
                  de acordo com a disponibilidade no momento do check-in.
                </p>
              </Alert>
            )}
          </div>

          {/* Restrições Alimentares */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Utensils className="w-5 h-5 mr-2 text-purple-600" />
              Alimentação
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Restrições Alimentares ou Dietas Especiais
              </label>
              <Textarea
                {...register('dietaryRestrictions')}
                placeholder="Ex: Vegetariano, vegano, alérgico a glúten, intolerante à lactose..."
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Nosso café da manhã inclui opções variadas, mas podemos adaptar conforme necessário.
              </p>
            </div>
          </div>

          {/* Necessidades de Acessibilidade */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Necessidades de Acessibilidade
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Necessidades Especiais de Acessibilidade
              </label>
              <Textarea
                {...register('accessibilityNeeds')}
                placeholder="Ex: Dificuldade de locomoção, necessidades visuais ou auditivas..."
                rows={2}
              />
            </div>
          </div>

          {/* Celebrações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Gift className="w-5 h-5 mr-2 text-purple-600" />
              Celebrações Especiais
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comemorando algo especial?
              </label>
              <Textarea
                {...register('celebrationDetails')}
                placeholder="Ex: Aniversário, lua de mel, formatura, despedida de solteiro(a)..."
                rows={2}
              />
              {watchedCelebration && (
                <div className="mt-2 p-3 bg-pink-50 border border-pink-200 rounded-lg">
                  <p className="text-sm text-pink-800 flex items-center">
                    <Heart className="w-4 h-4 mr-2" />
                    Que maravilha! Faremos o possível para tornar sua celebração ainda mais especial.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Organização do Grupo */}
          {groupSize > 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-600" />
                Organização do Grupo
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Como vocês gostariam de ser organizados?
                </label>
                <Textarea
                  {...register('groupOrganization')}
                  placeholder="Ex: Casais juntos, amigos próximos, divisão por gênero..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Serviços Adicionais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Serviços Adicionais
            </h3>

            <div className="space-y-3">
              {additionalServices.map((service) => (
                <div key={service.value} className="border border-gray-200 rounded-lg p-4">
                  <Checkbox
                    checked={selectedServices.includes(service.value)}
                    onChange={(checked) => handleServiceChange(service.value, checked)}
                    label={
                      <div>
                        <span className="font-medium">{service.label}</span>
                        <p className="text-sm text-gray-600">{service.description}</p>
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Necessidades de Transporte */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Transporte
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Necessidades de Transporte
              </label>
              <Textarea
                {...register('transportationNeeds')}
                placeholder="Ex: Chegada de aeroporto, estação de ônibus, táxi recomendações..."
                rows={2}
              />
            </div>
          </div>

          {/* Outros Pedidos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Outros Pedidos Especiais
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Algo mais que possamos fazer para melhorar sua estadia?
              </label>
              <Textarea
                {...register('specialRequests')}
                placeholder="Qualquer outro pedido ou informação importante..."
                rows={3}
              />
            </div>
          </div>

          {/* Informações de Emergência */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Informações Médicas/Emergência
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Informações médicas importantes (opcional)
              </label>
              <Textarea
                {...register('emergencyInformation')}
                placeholder="Ex: Medicamentos essenciais, condições médicas relevantes..."
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Essas informações são confidenciais e usadas apenas em emergências.
              </p>
            </div>
          </div>

          {/* Confirmação */}
          <Alert className="bg-emerald-50 border-emerald-200">
            <CheckCircle className="w-4 h-4" />
            <div>
              <h4 className="font-semibold text-emerald-900 mb-1">
                Quase pronto!
              </h4>
              <p className="text-sm text-emerald-800">
                Nossa equipe revisará todos os seus pedidos e entrará em contato para confirmar 
                os detalhes. Faremos o possível para atender suas necessidades especiais.
              </p>
            </div>
          </Alert>

          {/* Botões */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className="px-6"
            >
              Voltar
            </Button>

            <Button
              type="submit"
              disabled={isLoading}
              className="px-8 bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? 'Salvando...' : 'Finalizar Pedidos'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
