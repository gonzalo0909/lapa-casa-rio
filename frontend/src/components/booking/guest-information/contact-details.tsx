// src/components/booking/guest-information/contact-details.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Phone, Mail, MapPin, Clock, Wifi, Coffee } from 'lucide-react';

const contactSchema = z.object({
  primaryPhone: z.string().min(10, 'Telefone principal obrigatório'),
  secondaryPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  preferredContact: z.enum(['phone', 'email', 'whatsapp']),
  communicationLanguage: z.enum(['pt', 'en', 'es']),
  receiveSMS: z.boolean().default(true),
  receiveWhatsApp: z.boolean().default(true),
  receiveEmail: z.boolean().default(true),
  receivePromotions: z.boolean().default(false),
  emergencyContactName: z.string().min(2, 'Nome do contato de emergência obrigatório'),
  emergencyContactPhone: z.string().min(10, 'Telefone de emergência obrigatório'),
  emergencyContactRelation: z.string().min(2, 'Parentesco obrigatório'),
});

type ContactDetailsData = z.infer<typeof contactSchema>;

interface ContactDetailsProps {
  onSubmit: (data: ContactDetailsData) => void;
  onBack: () => void;
  isLoading?: boolean;
  initialData?: Partial<ContactDetailsData>;
}

const contactPreferences = [
  { value: 'phone', label: 'Telefone', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
];

const languages = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const relations = [
  { value: 'mae', label: 'Mãe' },
  { value: 'pai', label: 'Pai' },
  { value: 'irmao', label: 'Irmão(ã)' },
  { value: 'conjuge', label: 'Cônjuge' },
  { value: 'filho', label: 'Filho(a)' },
  { value: 'amigo', label: 'Amigo(a)' },
  { value: 'outro', label: 'Outro' },
];

export function ContactDetails({ 
  onSubmit, 
  onBack, 
  isLoading = false, 
  initialData 
}: ContactDetailsProps) {
  const [showPhoneValidation, setShowPhoneValidation] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<ContactDetailsData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      preferredContact: 'whatsapp',
      communicationLanguage: 'pt',
      receiveSMS: true,
      receiveWhatsApp: true,
      receiveEmail: true,
      receivePromotions: false,
      ...initialData,
    },
  });

  const watchedPreferredContact = watch('preferredContact');
  const watchedPrimaryPhone = watch('primaryPhone');

  const handleFormSubmit = (data: ContactDetailsData) => {
    onSubmit(data);
  };

  const validateBrazilianPhone = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Detalhes de Contato
            </h2>
            <p className="text-gray-600 mt-1">
              Como você prefere que entremos em contato?
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs">
              Passo 2 de 3
            </Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Números de Telefone */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-emerald-600" />
              Números de Telefone
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone Principal *
                </label>
                <Input
                  {...register('primaryPhone')}
                  placeholder="+55 21 99999-9999"
                  error={errors.primaryPhone?.message}
                  onBlur={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setValue('primaryPhone', formatted);
                    setShowPhoneValidation(!validateBrazilianPhone(e.target.value));
                  }}
                />
                {showPhoneValidation && watchedPrimaryPhone && (
                  <p className="text-sm text-amber-600 mt-1">
                    Verifique se o número está correto (DDD + número)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone Secundário
                </label>
                <Input
                  {...register('secondaryPhone')}
                  placeholder="+55 21 88888-8888"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp (se diferente do principal)
                </label>
                <Input
                  {...register('whatsappNumber')}
                  placeholder="+55 21 77777-7777"
                />
              </div>
            </div>
          </div>

          {/* Preferências de Comunicação */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-emerald-600" />
              Preferências de Comunicação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meio de Contato Preferido *
                </label>
                <Select
                  {...register('preferredContact')}
                  options={contactPreferences.map(pref => ({
                    value: pref.value,
                    label: pref.label,
                  }))}
                  placeholder="Selecione"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma de Comunicação *
                </label>
                <Select
                  {...register('communicationLanguage')}
                  options={languages}
                  placeholder="Selecione o idioma"
                />
              </div>
            </div>

            {/* Checkbox de Notificações */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                Receber notificações por:
              </h4>
              
              <div className="space-y-2">
                <Checkbox
                  {...register('receiveSMS')}
                  label="SMS (confirmações e lembretes importantes)"
                />
                
                <Checkbox
                  {...register('receiveWhatsApp')}
                  label="WhatsApp (atualizações em tempo real)"
                />
                
                <Checkbox
                  {...register('receiveEmail')}
                  label="Email (confirmações e recibos)"
                />
                
                <Checkbox
                  {...register('receivePromotions')}
                  label="Ofertas promocionais e descontos especiais"
                />
              </div>
            </div>
          </div>

          {/* Contato de Emergência */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Contato de Emergência
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <Input
                  {...register('emergencyContactName')}
                  placeholder="Maria Silva Santos"
                  error={errors.emergencyContactName?.message}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <Input
                  {...register('emergencyContactPhone')}
                  placeholder="+55 21 88888-8888"
                  error={errors.emergencyContactPhone?.message}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parentesco *
                </label>
                <Select
                  {...register('emergencyContactRelation')}
                  options={relations}
                  placeholder="Selecione"
                  error={errors.emergencyContactRelation?.message}
                />
              </div>
            </div>
          </div>

          {/* Informações do Hostel */}
          <Alert className="bg-emerald-50 border-emerald-200">
            <div className="space-y-3">
              <h4 className="font-semibold text-emerald-900 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Lapa Casa Hostel - Informações de Contato
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-emerald-800">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    Rua Silvio Romero 22, Santa Teresa, RJ
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    +55 21 2507-0100
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    reservas@lapacasahostel.com
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Recepção 24h
                  </div>
                  <div className="flex items-center">
                    <Wifi className="w-4 h-4 mr-2" />
                    WiFi gratuito
                  </div>
                  <div className="flex items-center">
                    <Coffee className="w-4 h-4 mr-2" />
                    Café da manhã incluso
                  </div>
                </div>
              </div>
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
              disabled={!isValid || isLoading}
              className="px-8 bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? 'Salvando...' : 'Continuar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
