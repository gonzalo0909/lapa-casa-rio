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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import {
  ownerApartmentsAPI,
  type Apartment,
  type ApartmentPhoto,
  type ApartmentBlock,
  type HolidayBlockPreset,
} from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';

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
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);

  // Bloqueios de datas
  const [blocks, setBlocks] = useState<ApartmentBlock[] | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

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
  const [amenitiesText, setAmenitiesText] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [cep, setCep] = useState('');
  const [basePrice, setBasePrice] = useState('');

  // Form state — preços dinâmicos
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [botEnabled, setBotEnabled] = useState(true);

  // Ref to avoid duplicate CEP lookups on rapid typing
  const cepLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setAmenitiesText(Array.isArray(apt.amenities) ? apt.amenities.join(', ') : '');
      setAddress(apt.address ?? '');
      setAddressNumber(apt.address_number ?? '');
      setCep(apt.cep ? formatCep(apt.cep) : '');
      setBasePrice(apt.base_price?.toString() ?? '');
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
  }, [profile, loadBlocks]);

  useEffect(() => {
    ownerApartmentsAPI.holidayPresets(holidayYear).then((res) => {
      setHolidayPresets(res.data.presets);
      setHolidayPresetKey((prev) => prev || res.data.presets[0]?.key || '');
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
      await ownerApartmentsAPI.createBlock(params.id, {
        start_date: blockStart,
        end_date: blockEnd,
        block_type: 'other',
        reason: blockReason || undefined,
      });
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      await loadBlocks();
    } catch (err) {
      setBlockError(handleAPIError(err, 'pt'));
    } finally {
      setSavingBlock(false);
    }
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
      const amenities = amenitiesText
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      const cepDigits = cep.replace(/\D/g, '');

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
    const file = e.target.files?.[0];
    // Clear the input so the same file can be re-selected if needed
    e.target.value = '';
    if (!file) {return;}

    setError(null);
    setUploading(true);
    try {
      await ownerApartmentsAPI.uploadPhoto(params.id, file);
      const photosRes = await ownerApartmentsAPI.listPhotos(params.id);
      setPhotos(photosRes.data.photos);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setUploading(false);
    }
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

                {/* Comodidades */}
                <Input
                  label="Comodidades"
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  helperText="Separadas por vírgula, ex: Wi-Fi, Ar condicionado, Cozinha"
                />

                {/* Preço base */}
                <Input
                  label="Preço base (R$)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  helperText="Valor usado no cálculo de novas reservas"
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
              <p className="text-sm text-neutral-500">
                Por padrão, seu apartamento fica bloqueado ±7 dias ao redor de cada feriado
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
              <form onSubmit={handleCreateBlock} className="flex flex-col gap-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Bloquear outras datas</p>
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
                <Button type="submit" disabled={savingBlock} className="w-full justify-center">
                  {savingBlock ? 'Bloqueando...' : 'Bloquear'}
                </Button>
              </form>

              {/* Lista de bloqueios */}
              <div className="flex flex-col gap-2">
                {blocks === null && <p className="text-sm text-neutral-500">Carregando...</p>}
                {blocks?.length === 0 && (
                  <p className="text-sm text-neutral-500">Nenhuma data bloqueada.</p>
                )}
                {blocks?.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>
                      {new Date(`${b.start_date}T00:00:00`).toLocaleDateString('pt-BR')} –{' '}
                      {new Date(`${b.end_date}T00:00:00`).toLocaleDateString('pt-BR')}
                      {b.reason && <span className="text-neutral-500"> · {b.reason}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(b.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remover
                    </button>
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
                  {uploading ? 'Enviando foto...' : 'Adicionar foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                />
              </label>
              {uploading && <p className="mt-2 text-sm text-gray-500">Aguarde, enviando...</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
