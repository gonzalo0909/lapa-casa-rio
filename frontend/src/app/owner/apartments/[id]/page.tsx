'use client';

//
// Editar um apartamento (campos editoriais do painel do proprietário):
// nome, endereço completo com busca automática de CEP (ViaCEP), bairro,
// descrição, quartos, banheiros, comodidades, e gerenciamento de fotos.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OwnerCalendar } from '@/components/owner/owner-calendar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import {
  ownerApartmentsAPI,
  type Apartment,
  type ApartmentPhoto,
  type ApartmentBlock,
  type OwnerBooking,
  type HolidayBlockPreset,
} from '@/lib/owner-api';
import { handleAPIError, APIError } from '@/lib/api';

// ─── ViaCEP lookup ───────────────────────────────────────────────────────────

interface ViaCEPResult {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

async function lookupCep(cep: string): Promise<ViaCEPResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) {return null;}
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) {return null;}
    const data: ViaCEPResult = await res.json();
    if (data.erro) {return null;}
    return data;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD en hora local -- mismo formato que start_date/endDate de blocks. */
function todayLocalISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seletor de hora em formato 24 h (14h, 14h30) -- no lugar do campo de hora nativo,
 *  que em alguns navegadores mostra AM/PM. Valor no formato 'HH:MM' ('' = vazio). */
const pad2 = (n: number) => String(n).padStart(2, '0');

function HourSelect({ label, value, onChange, helperText }: {
  label: string; value: string; onChange: (v: string) => void; helperText?: string;
}) {
  const options: { value: string; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += 30) {
    const hh = pad2(Math.floor(m / 60));
    const mm = pad2(m % 60);
    options.push({ value: `${hh}:${mm}`, label: mm === '00' ? `${hh}h` : `${hh}h${mm}` });
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}

/** Comodidades selecionáveis. O valor guardado (value) é o mesmo da lista do admin
 *  para que as opções marquem igual nos dois painéis; o texto mostrado é em português. */
const AMENITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'Wifi', label: 'Wi-Fi' },
  { value: 'Aire acondicionado', label: 'Ar-condicionado' },
  { value: 'Cocina equipada', label: 'Cozinha equipada' },
  { value: 'Lavadora', label: 'Máquina de lavar' },
  { value: 'Secadora', label: 'Secadora' },
  { value: 'TV', label: 'TV' },
  { value: 'Balcon', label: 'Varanda' },
  { value: 'Vista a la calle', label: 'Vista para a rua' },
  { value: 'Bano privado', label: 'Banheiro privativo' },
  { value: 'Calefaccion', label: 'Aquecimento' },
  { value: 'Microondas', label: 'Micro-ondas' },
  { value: 'Nevera', label: 'Geladeira' },
  { value: 'Congelador', label: 'Freezer' },
  { value: 'Horno', label: 'Forno' },
  { value: 'Cafetera', label: 'Cafeteira' },
  { value: 'Ropa de cama', label: 'Roupa de cama' },
  { value: 'Toallas', label: 'Toalhas' },
  { value: 'Parking', label: 'Estacionamento' },
  { value: 'Ascensor', label: 'Elevador' },
  { value: 'Piscina', label: 'Piscina' },
  { value: 'Terraza', label: 'Terraço' },
  { value: 'Parrilla / Churrasqueira', label: 'Churrasqueira' },
  { value: 'Escritorio', label: 'Escritório' },
  { value: 'Cuna disponible', label: 'Berço disponível' },
  { value: 'Primera linea de playa', label: 'Frente para a praia' },
  { value: 'Vista al mar', label: 'Vista para o mar' },
  { value: 'Jardin', label: 'Jardim' },
];

/** Avisos que ve el huésped por defecto (mismos del sitio) -- se precargan
 *  para que el owner los edite o los reemplace. **texto** = negrita. */
const DEFAULT_NOTICES = [
  'O envio de foto do documento de identificação é **obrigatório** antes do check-in, sem exceção.',
  'As unidades são destinadas exclusivamente a **maiores de 18 anos**.',
];

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OwnerApartmentEditPage() {
  const params = useParams<{ id: string }>();
  const { profile, loading: authLoading } = useOwnerAuth();

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [photos, setPhotos] = useState<ApartmentPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitReviewMessage, setSubmitReviewMessage] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);

  // Bloqueios de datas
  const [blocks, setBlocks] = useState<ApartmentBlock[] | null>(null);
  const [calBookings, setCalBookings] = useState<OwnerBooking[]>([]);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Bloques festivos (Carnaval, Réveillon, etc.)
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [holidayPresets, setHolidayPresets] = useState<HolidayBlockPreset[]>([]);
  const [holidayPresetKey, setHolidayPresetKey] = useState('');
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');
  const [applyingHoliday, setApplyingHoliday] = useState(false);

  // Form state — informações gerais
  const [aptName, setAptName] = useState('');
  const [description, setDescription] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [cep, setCep] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [noticesText, setNoticesText] = useState('');
  const [checkinFrom, setCheckinFrom] = useState('');
  const [checkinTo, setCheckinTo] = useState('');
  const [checkoutTo, setCheckoutTo] = useState('');

  // Form state — preços dinâmicos
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [botEnabled, setBotEnabled] = useState(true);

  // Ref to avoid duplicate CEP lookups on rapid typing
  const cepLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockFormRef = useRef<HTMLFormElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [aptRes, photosRes, pricingRes] = await Promise.all([
        ownerApartmentsAPI.getById(params.id),
        ownerApartmentsAPI.listPhotos(params.id),
        ownerApartmentsAPI.getPricing(params.id),
      ]);
      const apt = aptRes.data;
      setApartment(apt);
      setAptName(apt.name ?? '');
      setDescription(apt.description ?? '');
      setNeighborhood(apt.neighborhood ?? '');
      setBedrooms(apt.bedrooms?.toString() ?? '');
      setBathrooms(apt.bathrooms?.toString() ?? '');
      setAmenities(Array.isArray(apt.amenities) ? (apt.amenities as string[]) : []);
      setAddress(apt.address ?? '');
      setAddressNumber(apt.address_number ?? '');
      setCep(apt.cep ? formatCep(apt.cep) : '');
      setBasePrice(apt.base_price?.toString() ?? '');
      setNoticesText((apt.important_notices ?? DEFAULT_NOTICES).join('\n'));
      setCheckinFrom(apt.checkin_from ?? '');
      setCheckinTo(apt.checkin_to ?? '');
      setCheckoutTo(apt.checkout_to ?? '');
      setPhotos(photosRes.data.photos);
      const pricing = pricingRes.data;
      if (pricing) {
        setMinPrice(pricing.min_price_brl?.toString() ?? '');
        setMaxPrice(pricing.max_price_brl?.toString() ?? '');
        setBotEnabled(pricing.bot_enabled);
      }
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  }, [params.id]);

  useEffect(() => {
    if (!profile) {return;}
    loadData();
  }, [profile, loadData]);

  const loadBlocks = useCallback(async () => {
    try {
      const res = await ownerApartmentsAPI.listBlocks(params.id);
      setBlocks(res.data);
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    }
  }, [params.id]);

  useEffect(() => {
    if (!profile) {return;}
    loadBlocks();
    // Reservas para mostrar no calendário (somente leitura)
    ownerApartmentsAPI
      .listBookings(params.id)
      .then((res) => setCalBookings(res.data.bookings))
      .catch(() => { /* o calendário funciona só com os bloqueios */ });
  }, [profile, loadBlocks, params.id]);

  const handleCalendarCreate = async (start: string, endExclusive: string) => {
    setBlockError(null);
    try {
      await ownerApartmentsAPI.createBlock(params.id, {
        start_date: start,
        end_date: endExclusive,
        block_type: 'other',
        reason: 'Bloqueio do proprietário',
      });
      await loadBlocks();
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    }
  };

  const handleCalendarDelete = async (blockId: string) => {
    setBlockError(null);
    try {
      await ownerApartmentsAPI.deleteBlock(blockId);
      setBlocks((prev) => prev?.filter((b) => b.id !== blockId) ?? null);
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    }
  };

  useEffect(() => {
    // Trae el año elegido + el siguiente -- si solo trajera holidayYear, en
    // la segunda mitad del año el combo se iba quedando cada vez más corto
    // (en diciembre solo quedaría Réveillon) en vez de seguir mostrando lo
    // que viene el año que entra.
    Promise.all([
      ownerApartmentsAPI.holidayPresets(holidayYear),
      ownerApartmentsAPI.holidayPresets(holidayYear + 1),
    ]).then(([resA, resB]) => {
      // El "key" de cada preset (ej. "carnaval") no incluye el año -- se
      // repite entre los dos años traídos, así que hay que hacerlo único
      // antes de mezclarlos o el <select> y el .find() de abajo confunden
      // Carnaval de un año con el del otro.
      const combined = [...resA.data.presets, ...resB.data.presets].map((p) => ({
        ...p,
        key: `${p.startDate}-${p.key}`,
      }));

      // Solo feriados que todavía no pasaron -- el combo listaba todo el año
      // elegido (ej. Carnaval en septiembre), aunque ya no tuviera sentido
      // bloquearlo.
      const today = todayLocalISODate();
      const futurePresets = combined
        .filter((p) => p.startDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      setHolidayPresets(futurePresets);
      setHolidayPresetKey((prev) =>
        futurePresets.some((p) => p.key === prev) ? prev : futurePresets[0]?.key || '',
      );
    }).catch((err) => setBlockError(handleAPIError(err, 'pt')));
  }, [holidayYear]);

  useEffect(() => {
    const preset = holidayPresets.find((p) => p.key === holidayPresetKey);
    if (preset) {
      setHolidayStart(preset.startDate);
      setHolidayEnd(preset.endDate);
    }
  }, [holidayPresetKey, holidayPresets]);

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError(null);
    setSavingBlock(true);
    try {
      // Editar = borrar el bloqueo viejo y crear uno nuevo con los valores
      // del form -- no existe un PUT /blocks/:id en el backend.
      if (editingBlockId) {
        await ownerApartmentsAPI.deleteBlock(editingBlockId);
      }
      await ownerApartmentsAPI.createBlock(params.id, {
        start_date: blockStart,
        end_date: blockEnd,
        block_type: 'other',
        reason: blockReason || undefined,
      });
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      setEditingBlockId(null);
      await loadBlocks();
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    } finally {
      setSavingBlock(false);
    }
  };

  const handleEditBlockClick = (b: ApartmentBlock) => {
    setBlockError(null);
    setEditingBlockId(b.id);
    setBlockStart(b.start_date);
    setBlockEnd(b.end_date);
    setBlockReason(b.reason ?? '');
    // El form de edición está arriba de la lista -- sin este scroll, clickear
    // "Editar" en un bloqueio más abajo en la lista no muestra ningún cambio
    // visible en pantalla y parece que el botón no hizo nada.
    blockFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCancelEditBlock = () => {
    setEditingBlockId(null);
    setBlockStart('');
    setBlockEnd('');
    setBlockReason('');
  };

  const handleApplyHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError(null);
    setApplyingHoliday(true);
    try {
      const preset = holidayPresets.find((p) => p.key === holidayPresetKey);
      await ownerApartmentsAPI.createBlock(params.id, {
        start_date: holidayStart,
        end_date: holidayEnd,
        block_type: 'seasonal',
        reason: preset?.name ?? holidayPresetKey,
      });
      await loadBlocks();
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    } finally {
      setApplyingHoliday(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Remover este bloqueio? O apartamento voltará a ficar disponível nessas datas.')) {return;}
    setBlockError(null);
    try {
      await ownerApartmentsAPI.deleteBlock(blockId);
      setBlocks((prev) => prev?.filter((b) => b.id !== blockId) ?? null);
      if (editingBlockId === blockId) {handleCancelEditBlock();}
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    }
  };

  // Auto-fill address from CEP using ViaCEP
  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    setCepError(null);

    if (cepLookupTimer.current) {
      clearTimeout(cepLookupTimer.current);
    }

    const digits = formatted.replace(/\D/g, '');
    if (digits.length !== 8) {return;}

    cepLookupTimer.current = setTimeout(async () => {
      setCepLoading(true);
      const result = await lookupCep(digits);
      setCepLoading(false);
      if (!result) {
        setCepError('CEP não encontrado');
        return;
      }
      // Fill street address and neighborhood if they are empty or match the
      // previously fetched value (don't overwrite what the user typed).
      if (result.logradouro) {
        setAddress((prev) => prev.trim() === '' ? result.logradouro! : prev);
      }
      if (result.bairro) {
        setNeighborhood((prev) => prev.trim() === '' ? result.bairro! : prev);
      }
    }, 600);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      const cepDigits = cep.replace(/\D/g, '');
      const notices = noticesText.split('\n').map((l) => l.trim()).filter(Boolean);

      await ownerApartmentsAPI.update(params.id, {
        name: aptName.trim() || undefined,
        description: description || undefined,
        neighborhood: neighborhood || undefined,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
        bathrooms: bathrooms ? parseInt(bathrooms, 10) : undefined,
        amenities,
        address: address || undefined,
        address_number: addressNumber || undefined,
        cep: cepDigits || undefined,
        base_price: basePrice ? parseFloat(basePrice) : undefined,
        important_notices: notices.length > 0 ? notices : null,
        checkin_from: checkinFrom || null,
        checkin_to: checkinTo || null,
        checkout_to: checkoutTo || null,
      });
      setSaveMessage('Alterações salvas com sucesso.');
      // Update heading if name changed
      if (aptName.trim() && apartment) {
        setApartment({ ...apartment, name: aptName.trim() });
      }
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPricingMessage(null);
    setSavingPricing(true);
    try {
      await ownerApartmentsAPI.updatePricing(params.id, {
        min_price_brl: minPrice ? parseFloat(minPrice) : null,
        max_price_brl: maxPrice ? parseFloat(maxPrice) : null,
        bot_enabled: botEnabled,
      });
      setPricingMessage('Configuração de preços salva.');
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setSavingPricing(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Clear the input so the same file(s) can be re-selected if needed
    e.target.value = '';
    if (files.length === 0) {return;}

    setError(null);
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });

    // Una foto a la vez -- el backend decide is_primary/display_order según
    // COUNT(*) al momento de cada request (owner-apartments.routes.ts), así
    // que subirlas en paralelo haría que varias se lean con el mismo
    // contador y compitan por ser la primaria / el mismo display_order.
    const failedNames: string[] = [];
    const duplicateNames: string[] = [];
    for (const file of files) {
      try {
        await ownerApartmentsAPI.uploadPhoto(params.id, file);
      } catch (err) {
        if (err instanceof APIError && err.code === 'DUPLICATE_PHOTO') {
          duplicateNames.push(file.name);
        } else {
          failedNames.push(file.name);
        }
      }
      setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }

    try {
      const photosRes = await ownerApartmentsAPI.listPhotos(params.id);
      setPhotos(photosRes.data.photos);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }

    const messages: string[] = [];
    if (duplicateNames.length > 0) {
      messages.push(`Já foram enviadas antes (puladas): ${duplicateNames.join(', ')}`);
    }
    if (failedNames.length > 0) {
      messages.push(`Não foi possível enviar: ${failedNames.join(', ')}`);
    }
    if (messages.length > 0) {
      setError(messages.join(' · '));
    }

    setUploading(false);
    setUploadProgress(null);
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      await ownerApartmentsAPI.setPrimaryPhoto(photoId);
      const photosRes = await ownerApartmentsAPI.listPhotos(params.id);
      setPhotos(photosRes.data.photos);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Excluir esta foto?')) {return;}
    try {
      await ownerApartmentsAPI.deletePhoto(photoId);
      setPhotos((prev) => prev?.filter((p) => p.id !== photoId) ?? null);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  };

  const handleSubmitForReview = async () => {
    setError(null);
    setSubmitReviewMessage(null);
    setSubmittingReview(true);
    try {
      const res = await ownerApartmentsAPI.submitForReview(params.id);
      setApartment((prev) => (prev ? { ...prev, listing_status: 'pending_review', listing_review_notes: null } : prev));
      setSubmitReviewMessage(res.message || 'Anúncio enviado para análise.');
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setSubmittingReview(false);
    }
  };

  if (authLoading || (!apartment && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/owner" className="mb-6 inline-block text-sm text-blue-600 hover:underline">
        ← Voltar para meus apartamentos
      </Link>

      {error && !apartment && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {apartment && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{apartment.name}</h1>
            <Link
              href={`/owner/apartments/${params.id}/bookings`}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Ver reservas →
            </Link>
          </div>

          {/* Estado de moderación del anuncio (0051_apartment_listing_approval.sql):
              cualquier edición de contenido o de fotos manda de vuelta a
              "pending_review" -- el site público sigue mostrando la última
              versión aprobada hasta que un admin apruebe esta edición nueva. */}
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
              apartment.listing_status === 'approved'
                ? 'border-green-200 bg-green-50 text-green-800'
                : apartment.listing_status === 'rejected'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <p className="font-semibold">
              {apartment.listing_status === 'approved'
                ? '✓ Anúncio aprovado'
                : apartment.listing_status === 'rejected'
                  ? '✗ Anúncio rejeitado'
                  : '⏳ Anúncio em revisão'}
            </p>
            <p className="mt-0.5 font-normal opacity-80">
              {apartment.listing_status === 'approved'
                ? 'Este é o conteúdo que os hóspedes veem hoje no site.'
                : apartment.listing_status === 'rejected'
                  ? 'Corrija o motivo abaixo e salve de novo para reenviar para revisão.'
                  : 'Sua equipe está revisando fotos/descrição antes de publicar. Enquanto isso, o site mostra a última versão já aprovada (se houver).'}
            </p>
            {apartment.listing_review_notes && (
              <p className="mt-2 italic">Motivo: {apartment.listing_review_notes}</p>
            )}
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle size="sm">Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                {/* Nome do apartamento */}
                <Input
                  label="Nome do apartamento"
                  value={aptName}
                  onChange={(e) => setAptName(e.target.value)}
                  maxLength={100}
                />

                {/* CEP com auto-preenchimento */}
                <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <Input
                    label="CEP"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    helperText={
                      cepLoading
                        ? 'Buscando CEP...'
                        : cepError
                          ? cepError
                          : 'Preenchimento automático do endereço'
                    }
                  />
                </div>

                {/* Endereço e número */}
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <Input
                    label="Endereço (rua)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua das Palmeiras"
                  />
                  <div className="w-24">
                    <Input
                      label="Número"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      placeholder="42"
                      maxLength={20}
                    />
                  </div>
                </div>

                {/* Bairro */}
                <Input
                  label="Bairro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />

                {/* Descrição */}
                <Textarea
                  label="Descrição"
                  placeholder="Descrição do apartamento (aparece no site e nos mecanismos de busca)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />

                {/* Quartos e banheiros */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Quartos"
                    type="number"
                    min={0}
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                  />
                  <Input
                    label="Banheiros"
                    type="number"
                    min={0}
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                  />
                </div>

                {/* Comodidades: seleção por opções */}
                <div>
                  <p className="mb-2 text-sm font-medium">Comodidades</p>
                  <div className="flex flex-wrap gap-2">
                    {[...AMENITY_OPTIONS.map((o) => o.value), ...amenities.filter((a) => !AMENITY_OPTIONS.some((o) => o.value === a))].map((value) => {
                      const selected = amenities.includes(value);
                      const label = AMENITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setAmenities((prev) =>
                              prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                            selected
                              ? 'border-green-600 bg-green-50 font-medium text-green-800'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Toque para marcar ou desmarcar as comodidades do apartamento.</p>
                </div>

                {/* Preço base */}
                <Input
                  label="Preço base (R$)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  helperText="Valor cobrado do hóspede por noite -- sem ajustes automáticos"
                />

                {/* Horários de check-in / check-out deste apartamento */}
                <div className="grid grid-cols-2 gap-4">
                  <HourSelect label="Check-in a partir de" value={checkinFrom} onChange={setCheckinFrom} helperText="Ex: 14h ou 16h" />
                  <HourSelect label="Check-in até" value={checkinTo} onChange={setCheckinTo} helperText="Vazio = 22h" />
                  <HourSelect label="Check-out até" value={checkoutTo} onChange={setCheckoutTo} helperText="Ex: 10h ou 12h" />
                  <p className="col-span-2 text-xs text-muted-foreground">
                    O hóspede escolhe o horário de chegada dentro da janela de check-in e vê os horários na tela de reserva. Deixe vazio para usar o padrão do site.
                  </p>
                </div>

                {/* Informações importantes (visíveis ao hóspede ao reservar) */}
                <Textarea
                  label="Informações importantes para o hóspede"
                  value={noticesText}
                  onChange={(e) => setNoticesText(e.target.value)}
                  rows={6}
                  helperText="Uma por linha. Aparecem na tela de reserva deste apartamento (ex: horários de check-in/check-out, regras). Use **texto** para negrito. Deixe vazio para usar o padrão do site."
                />

                {error && (
                  <Alert variant="danger">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {saveMessage && (
                  <Alert variant="success">
                    <AlertDescription>{saveMessage}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={saving} className="w-full justify-center">
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Preços dinâmicos */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle size="sm">Preços dinâmicos</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePricing} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Preço mínimo (R$)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    helperText="Deixe vazio para sem limite"
                  />
                  <Input
                    label="Preço máximo (R$)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    helperText="Deixe vazio para sem limite"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={botEnabled}
                    onChange={(e) => setBotEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                  />
                  <span className="text-sm text-neutral-700">Habilitar ajuste automático de preços</span>
                </label>

                {pricingMessage && (
                  <Alert variant="success">
                    <AlertDescription>{pricingMessage}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={savingPricing} className="w-full justify-center">
                  {savingPricing ? 'Salvando...' : 'Salvar configuração de preços'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Bloqueios de datas */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle size="sm">Datas bloqueadas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <OwnerCalendar
                blocks={blocks ?? []}
                bookings={calBookings}
                onCreateBlock={handleCalendarCreate}
                onDeleteBlock={handleCalendarDelete}
              />
              <p className="text-sm text-neutral-500">
                Por padrão, seu apartamento fica bloqueado nas datas reais de cada feriado
                (Carnaval, Réveillon, etc.). Remova um bloqueio abaixo se quiser aceitar
                reservas nessas datas.
              </p>

              {blockError && (
                <Alert variant="danger">
                  <AlertDescription>{blockError}</AlertDescription>
                </Alert>
              )}

              {/* Bloque festivo de un click */}
              <form onSubmit={handleApplyHoliday} className="flex flex-col gap-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Bloquear feriado</p>
                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <div className="w-24">
                    <Input
                      label="Ano"
                      type="number"
                      value={holidayYear}
                      onChange={(e) => setHolidayYear(parseInt(e.target.value, 10) || holidayYear)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="holiday-preset" className="text-sm font-medium">Feriado</label>
                    <select
                      id="holiday-preset"
                      value={holidayPresetKey}
                      onChange={(e) => setHolidayPresetKey(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {holidayPresets.map((p) => (
                        <option key={p.key} value={p.key}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Desde"
                    type="date"
                    value={holidayStart}
                    onChange={(e) => setHolidayStart(e.target.value)}
                  />
                  <Input
                    label="Até"
                    type="date"
                    value={holidayEnd}
                    onChange={(e) => setHolidayEnd(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={applyingHoliday || !holidayStart || !holidayEnd} className="w-full justify-center">
                  {applyingHoliday ? 'Bloqueando...' : 'Bloquear estas datas'}
                </Button>
              </form>

              {/* Bloqueo manual */}
              <form
                ref={blockFormRef}
                onSubmit={handleCreateBlock}
                className={`flex flex-col gap-3 rounded-lg border p-4 ${
                  editingBlockId ? 'border-neutral-900 ring-1 ring-neutral-900' : ''
                }`}
              >
                <p className="text-sm font-medium">
                  {editingBlockId ? 'Editar bloqueio' : 'Bloquear outras datas'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Desde"
                    type="date"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    required
                  />
                  <Input
                    label="Até"
                    type="date"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="Motivo (opcional)"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Manutenção, uso próprio..."
                />
                <div className="flex gap-3">
                  <Button type="submit" disabled={savingBlock} className="w-full justify-center">
                    {savingBlock
                      ? 'Salvando...'
                      : editingBlockId ? 'Salvar edição' : 'Bloquear'}
                  </Button>
                  {editingBlockId && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingBlock}
                      onClick={handleCancelEditBlock}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>

              {/* Lista de bloqueios */}
              <div className="flex flex-col gap-2">
                {blocks === null && <p className="text-sm text-neutral-500">Carregando...</p>}
                {blocks?.length === 0 && (
                  <p className="text-sm text-neutral-500">Nenhuma data bloqueada.</p>
                )}
                {blocks?.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                      editingBlockId === b.id ? 'border-neutral-900' : ''
                    }`}
                  >
                    <span>
                      {new Date(`${b.start_date}T00:00:00`).toLocaleDateString('pt-BR')} –{' '}
                      {new Date(`${b.end_date}T00:00:00`).toLocaleDateString('pt-BR')}
                      {b.reason && <span className="text-neutral-500"> · {b.reason}</span>}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditBlockClick(b)}
                        className="text-xs font-medium text-neutral-700 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(b.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle size="sm">Fotos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos?.map((photo) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border">
                    <div className="relative aspect-square">
                      <Image
                        src={photo.image_url}
                        alt={photo.alt_text ?? apartment.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    {photo.is_primary && (
                      <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white">
                        Principal
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!photo.is_primary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(photo.id)}
                          className="flex-1 rounded bg-white/90 px-1 py-0.5 text-xs hover:bg-white"
                        >
                          Tornar principal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="rounded bg-white/90 px-1 py-0.5 text-xs text-red-600 hover:bg-white"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  {uploading
                    ? `Enviando foto ${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? 0}...`
                    : 'Adicionar fotos'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadPhoto}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                />
              </label>
              {uploading && <p className="mt-2 text-sm text-gray-500">Aguarde, enviando...</p>}
            </CardContent>
          </Card>

          {/* Envío explícito a revisión -- las ediciones de arriba ya vuelven
              el anuncio a "pendente" solas, este botón es para cuando el
              owner terminó todo y quiere avisar/reenviar sin cambiar nada más
              (ej. después de corregir lo que un rechazo pidió). */}
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-gray-600">
                Terminou de editar as informações, fotos e preço? Envie o anúncio inteiro para
                nossa equipe analisar antes de publicar.
              </p>
              {submitReviewMessage && (
                <Alert variant="success" className="w-full">
                  <AlertDescription>{submitReviewMessage}</AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                disabled={submittingReview}
                onClick={handleSubmitForReview}
                className="w-full justify-center sm:w-auto"
              >
                {submittingReview ? 'Enviando...' : 'Enviar anúncio para análise'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
