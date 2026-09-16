'use client';

// TourConfigurator — configurador de tour personalizado con precio dinámico
// Permite elegir personas, días, hospedaje y atracciones.
// El precio se calcula en tiempo real. El botón WhatsApp arma el mensaje automáticamente.

import { useState, useCallback } from 'react';
import { Hotel, Check } from 'lucide-react';

// ─── Pricing constants ──────────────────────────────────────────────────────

const GUIDE_DAY         = 250;   // R$/día (guía privado)
const VAN_DAY           = 1000;  // R$/día (Sprinter hasta 13 pax)
const HOSTEL_COMMISSION = 40;    // R$/persona (comisión fija hostel)
const HOSTEL_NIGHT      = 65;    // R$/noche/persona
const HOSTEL_NIGHTS     = 2;     // noches incluidas en el paquete
const MIN_PEOPLE        = 6;
const MAX_PEOPLE        = 12;
const WHATSAPP_NUMBER   = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';

// ─── Attractions data ────────────────────────────────────────────────────────

interface Attraction {
  id: string;
  cat: 'Cultura' | 'Playa' | 'Ícono' | 'Experiencia' | 'Deporte' | 'Naturaleza';
  nameKey: string;
  descKey: string;
  price: number; // R$/persona (0 = gratis)
}

const ATTRACTIONS: Attraction[] = [
  { id: 'selaron',     cat: 'Cultura',     nameKey: 'selaron',     descKey: 'selaron_d',     price: 0   },
  { id: 'santateresa', cat: 'Cultura',     nameKey: 'santateresa', descKey: 'santateresa_d', price: 0   },
  { id: 'praias',      cat: 'Playa',       nameKey: 'praias',      descKey: 'praias_d',      price: 0   },
  { id: 'centro',      cat: 'Cultura',     nameKey: 'centro',      descKey: 'centro_d',      price: 0   },
  { id: 'favela',      cat: 'Experiencia', nameKey: 'favela',      descKey: 'favela_d',      price: 0   },
  { id: 'cristo',      cat: 'Ícono',       nameKey: 'cristo',      descKey: 'cristo_d',      price: 134 },
  { id: 'bondinho',    cat: 'Ícono',       nameKey: 'bondinho',    descKey: 'bondinho_d',    price: 155 },
  { id: 'maracana',    cat: 'Deporte',     nameKey: 'maracana',    descKey: 'maracana_d',    price: 94  },
  { id: 'amanha',      cat: 'Cultura',     nameKey: 'amanha',      descKey: 'amanha_d',      price: 40  },
  { id: 'botanico',    cat: 'Naturaleza',  nameKey: 'botanico',    descKey: 'botanico_d',    price: 40  },
];

// ─── Translations ────────────────────────────────────────────────────────────

type Locale = 'pt' | 'en' | 'es' | 'de' | 'fr' | 'it';

interface Strings {
  heading: string;
  subheading: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  days1: string;
  days2: string;
  hostelLabel: string;
  hostelDesc: string;
  stopsHeading: string;
  summaryTitle: string;
  people: string;
  days: string;
  guide: string;
  van: string;
  commission: string;
  hostelLine: string;
  ingressos: string;
  totalPer: string;
  totalGroup: string;
  wappBtn: string;
  wappNote: string;
  noStops: string;
  free: string;
  perPerson: string;
  nationalPrice: string;
  promoLabel: string;
  minMax: string;
  guideVanNote: (cost: number, people: number) => string;
  daysNote: (d: number) => string;
  // attraction names
  selaron: string; selaron_d: string;
  santateresa: string; santateresa_d: string;
  praias: string; praias_d: string;
  centro: string; centro_d: string;
  favela: string; favela_d: string;
  cristo: string; cristo_d: string;
  bondinho: string; bondinho_d: string;
  maracana: string; maracana_d: string;
  amanha: string; amanha_d: string;
  botanico: string; botanico_d: string;
}

const T: Record<Locale, Strings> = {
  es: {
    heading: 'Armá tu tour a medida',
    subheading: 'Elegí las paradas, el guía se adapta. El precio se calcula solo.',
    step1: 'Paso 1 · ¿Cuántas personas?',
    step2: 'Paso 2 · ¿Cuántos días?',
    step3: 'Paso 3 · ¿Incluir hospedaje?',
    step4: 'Paso 4 · Elegí las paradas',
    days1: '1 día', days2: '2 días',
    hostelLabel: '2 noches en Lapa Casa Rio',
    hostelDesc: 'Cama en habitación compartida · R$ 65/noche',
    stopsHeading: 'Atracciones',
    summaryTitle: 'Tu tour',
    people: 'Personas', days: 'Días', guide: 'Guía', van: 'Transporte (van)',
    commission: 'Comisión hostel', hostelLine: 'Hospedaje (2 noches)',
    ingressos: 'Ingresos', totalPer: 'Total/persona', totalGroup: 'Total grupo',
    wappBtn: 'Reservar por WhatsApp', wappNote: 'El guía confirma en menos de 2 hs',
    noStops: 'Sin paradas seleccionadas',
    free: 'Gratis', perPerson: '/persona', nationalPrice: 'ingreso nacional', promoLabel: 'Promo Brasil',
    minMax: 'Mínimo 6 · máximo 12 · Sprinter 15 plazas',
    guideVanNote: (cost, people) => `Guía + van: R$${cost}/persona con ${people} — a más personas, menos por cabeza`,
    daysNote: (d) => d === 1 ? 'Guía + van por 1 día' : 'Guía + van por 2 días (precio doble)',
    selaron: 'Escadaria Selarón + Lapa', selaron_d: 'Salida desde el hostel, a pie',
    santateresa: 'Santa Teresa', santateresa_d: 'Barrio histórico y arte callejero',
    praias: 'Ipanema / Copacabana', praias_d: 'Las playas más icónicas del mundo',
    centro: 'Centro Histórico', centro_d: 'Arquitectura colonial y museos',
    favela: 'Favela Santa Marta', favela_d: 'Experiencia comunitaria auténtica',
    cristo: 'Cristo Redentor', cristo_d: 'Trem do Corcovado · vista 360° sobre Rio',
    bondinho: 'Pão de Açúcar', bondinho_d: 'Bondinho · Baía de Guanabara',
    maracana: 'Maracanã Tour', maracana_d: 'Visita guiada al templo del fútbol',
    amanha: 'Museu do Amanhã', amanha_d: 'Ciencia y futuro en el Porto Maravilha',
    botanico: 'Jardim Botânico', botanico_d: '140 ha · 9.000 especies vegetales',
  },
  pt: {
    heading: 'Monte seu tour personalizado',
    subheading: 'Escolha as paradas, o guia se adapta. O preço é calculado na hora.',
    step1: 'Passo 1 · Quantas pessoas?',
    step2: 'Passo 2 · Quantos dias?',
    step3: 'Passo 3 · Incluir hospedagem?',
    step4: 'Passo 4 · Escolha as paradas',
    days1: '1 dia', days2: '2 dias',
    hostelLabel: '2 noites no Lapa Casa Rio',
    hostelDesc: 'Cama em quarto compartilhado · R$ 65/noite',
    stopsHeading: 'Atrações',
    summaryTitle: 'Seu tour',
    people: 'Pessoas', days: 'Dias', guide: 'Guia', van: 'Transporte (van)',
    commission: 'Comissão hostel', hostelLine: 'Hospedagem (2 noites)',
    ingressos: 'Ingressos', totalPer: 'Total/pessoa', totalGroup: 'Total grupo',
    wappBtn: 'Reservar pelo WhatsApp', wappNote: 'O guia confirma em menos de 2h',
    noStops: 'Nenhuma parada selecionada',
    free: 'Grátis', perPerson: '/pessoa', nationalPrice: 'ingresso nacional', promoLabel: 'Promo Brasil',
    minMax: 'Mínimo 6 · máximo 12 · Sprinter 15 lugares',
    guideVanNote: (cost, people) => `Guia + van: R$${cost}/pessoa com ${people} — quanto mais pessoas, menos por cabeça`,
    daysNote: (d) => d === 1 ? 'Guia + van por 1 dia' : 'Guia + van por 2 dias (preço dobrado)',
    selaron: 'Escadaria Selarón + Lapa', selaron_d: 'Saída do hostel, a pé',
    santateresa: 'Santa Teresa', santateresa_d: 'Bairro histórico e arte de rua',
    praias: 'Ipanema / Copacabana', praias_d: 'As praias mais icônicas do mundo',
    centro: 'Centro Histórico', centro_d: 'Arquitetura colonial e museus',
    favela: 'Favela Santa Marta', favela_d: 'Experiência comunitária autêntica',
    cristo: 'Cristo Redentor', cristo_d: 'Trem do Corcovado · vista 360° do Rio',
    bondinho: 'Pão de Açúcar', bondinho_d: 'Bondinho · Baía de Guanabara',
    maracana: 'Tour Maracanã', maracana_d: 'Visita guiada ao templo do futebol',
    amanha: 'Museu do Amanhã', amanha_d: 'Ciência e futuro no Porto Maravilha',
    botanico: 'Jardim Botânico', botanico_d: '140 ha · 9.000 espécies vegetais',
  },
  en: {
    heading: 'Build your custom tour',
    subheading: 'Pick your stops, the guide adapts. Price calculates in real time.',
    step1: 'Step 1 · How many people?',
    step2: 'Step 2 · How many days?',
    step3: 'Step 3 · Include accommodation?',
    step4: 'Step 4 · Choose your stops',
    days1: '1 day', days2: '2 days',
    hostelLabel: '2 nights at Lapa Casa Rio',
    hostelDesc: 'Bed in shared room · R$ 65/night',
    stopsHeading: 'Attractions',
    summaryTitle: 'Your tour',
    people: 'People', days: 'Days', guide: 'Guide', van: 'Transport (van)',
    commission: 'Hostel commission', hostelLine: 'Accommodation (2 nights)',
    ingressos: 'Entry fees', totalPer: 'Total/person', totalGroup: 'Group total',
    wappBtn: 'Book via WhatsApp', wappNote: 'Guide confirms in under 2 hours',
    noStops: 'No stops selected yet',
    free: 'Free', perPerson: '/person', nationalPrice: 'national ticket', promoLabel: 'Promo Brasil',
    minMax: 'Min 6 · max 12 · 15-seat Sprinter',
    guideVanNote: (cost, people) => `Guide + van: R$${cost}/person for ${people} — more people, less per head`,
    daysNote: (d) => d === 1 ? 'Guide + van for 1 day' : 'Guide + van for 2 days (double price)',
    selaron: 'Selarón Steps + Lapa', selaron_d: 'Walking distance from the hostel',
    santateresa: 'Santa Teresa', santateresa_d: 'Historic neighbourhood & street art',
    praias: 'Ipanema / Copacabana', praias_d: "The world's most iconic beaches",
    centro: 'Historic Center', centro_d: 'Colonial architecture & museums',
    favela: 'Santa Marta Favela', favela_d: 'Authentic community experience',
    cristo: 'Christ the Redeemer', cristo_d: 'Corcovado train · 360° view of Rio',
    bondinho: 'Sugarloaf Mountain', bondinho_d: 'Cable car · Guanabara Bay views',
    maracana: 'Maracanã Tour', maracana_d: 'Guided visit to the legendary stadium',
    amanha: 'Museum of Tomorrow', amanha_d: 'Science & future at Porto Maravilha',
    botanico: 'Botanical Garden', botanico_d: '140 ha · 9,000 plant species',
  },
  de: {
    heading: 'Stell deine Tour zusammen',
    subheading: 'Wähle deine Stopps, der Guide passt sich an. Preis wird live berechnet.',
    step1: 'Schritt 1 · Wie viele Personen?',
    step2: 'Schritt 2 · Wie viele Tage?',
    step3: 'Schritt 3 · Unterkunft einschließen?',
    step4: 'Schritt 4 · Wähle deine Stopps',
    days1: '1 Tag', days2: '2 Tage',
    hostelLabel: '2 Nächte im Lapa Casa Rio',
    hostelDesc: 'Bett im Schlafsaal · R$ 65/Nacht',
    stopsHeading: 'Sehenswürdigkeiten',
    summaryTitle: 'Deine Tour',
    people: 'Personen', days: 'Tage', guide: 'Guide', van: 'Transport (Van)',
    commission: 'Hostel-Provision', hostelLine: 'Unterkunft (2 Nächte)',
    ingressos: 'Eintritte', totalPer: 'Gesamt/Person', totalGroup: 'Gruppengesamt',
    wappBtn: 'Per WhatsApp buchen', wappNote: 'Guide bestätigt in unter 2 Stunden',
    noStops: 'Noch keine Stopps gewählt',
    free: 'Kostenlos', perPerson: '/Person', nationalPrice: 'Nationaltarif', promoLabel: 'Promo Brasil',
    minMax: 'Min 6 · max 12 · Sprinter 15 Sitze',
    guideVanNote: (cost, people) => `Guide + Van: R$${cost}/Person für ${people} — mehr Personen, weniger pro Kopf`,
    daysNote: (d) => d === 1 ? 'Guide + Van für 1 Tag' : 'Guide + Van für 2 Tage (doppelter Preis)',
    selaron: 'Selarón-Treppe + Lapa', selaron_d: 'Zu Fuß vom Hostel erreichbar',
    santateresa: 'Santa Teresa', santateresa_d: 'Historisches Viertel & Straßenkunst',
    praias: 'Ipanema / Copacabana', praias_d: 'Die bekanntesten Strände der Welt',
    centro: 'Historisches Zentrum', centro_d: 'Koloniale Architektur & Museen',
    favela: 'Favela Santa Marta', favela_d: 'Authentisches Gemeinschaftserlebnis',
    cristo: 'Christusstatue', cristo_d: 'Corcovado-Zug · 360°-Blick über Rio',
    bondinho: 'Zuckerhut', bondinho_d: 'Seilbahn · Guanabara-Bucht',
    maracana: 'Maracanã-Tour', maracana_d: 'Geführter Besuch im legendären Stadion',
    amanha: 'Museum of Tomorrow', amanha_d: 'Wissenschaft & Zukunft am Porto Maravilha',
    botanico: 'Botanischer Garten', botanico_d: '140 ha · 9.000 Pflanzenarten',
  },
  fr: {
    heading: 'Créez votre tour sur mesure',
    subheading: 'Choisissez vos étapes, le guide s\'adapte. Prix calculé en temps réel.',
    step1: 'Étape 1 · Combien de personnes ?',
    step2: 'Étape 2 · Combien de jours ?',
    step3: 'Étape 3 · Inclure l\'hébergement ?',
    step4: 'Étape 4 · Choisissez vos étapes',
    days1: '1 jour', days2: '2 jours',
    hostelLabel: '2 nuits au Lapa Casa Rio',
    hostelDesc: 'Lit en dortoir · R$ 65/nuit',
    stopsHeading: 'Attractions',
    summaryTitle: 'Votre tour',
    people: 'Personnes', days: 'Jours', guide: 'Guide', van: 'Transport (van)',
    commission: 'Commission auberge', hostelLine: 'Hébergement (2 nuits)',
    ingressos: 'Entrées', totalPer: 'Total/personne', totalGroup: 'Total groupe',
    wappBtn: 'Réserver via WhatsApp', wappNote: 'Le guide confirme en moins de 2h',
    noStops: 'Aucune étape sélectionnée',
    free: 'Gratuit', perPerson: '/personne', nationalPrice: 'tarif national', promoLabel: 'Promo Brasil',
    minMax: 'Min 6 · max 12 · Sprinter 15 places',
    guideVanNote: (cost, people) => `Guide + van : R$${cost}/personne pour ${people} — plus on est, moins c'est cher`,
    daysNote: (d) => d === 1 ? 'Guide + van pour 1 jour' : 'Guide + van pour 2 jours (prix doublé)',
    selaron: 'Escalier Selarón + Lapa', selaron_d: 'À pied depuis l\'auberge',
    santateresa: 'Santa Teresa', santateresa_d: 'Quartier historique & art de rue',
    praias: 'Ipanema / Copacabana', praias_d: 'Les plages les plus célèbres du monde',
    centro: 'Centre Historique', centro_d: 'Architecture coloniale & musées',
    favela: 'Favela Santa Marta', favela_d: 'Expérience communautaire authentique',
    cristo: 'Christ Rédempteur', cristo_d: 'Train du Corcovado · vue 360° sur Rio',
    bondinho: 'Pain de Sucre', bondinho_d: 'Téléphérique · Baie de Guanabara',
    maracana: 'Tour Maracanã', maracana_d: 'Visite guidée du stade légendaire',
    amanha: 'Musée du Lendemain', amanha_d: 'Sciences & avenir au Porto Maravilha',
    botanico: 'Jardin Botanique', botanico_d: '140 ha · 9 000 espèces végétales',
  },
  it: {
    heading: 'Costruisci il tuo tour su misura',
    subheading: 'Scegli le tappe, la guida si adatta. Il prezzo si calcola in tempo reale.',
    step1: 'Passo 1 · Quante persone?',
    step2: 'Passo 2 · Quanti giorni?',
    step3: 'Passo 3 · Includere alloggio?',
    step4: 'Passo 4 · Scegli le tappe',
    days1: '1 giorno', days2: '2 giorni',
    hostelLabel: '2 notti al Lapa Casa Rio',
    hostelDesc: 'Posto letto in dormitorio · R$ 65/notte',
    stopsHeading: 'Attrazioni',
    summaryTitle: 'Il tuo tour',
    people: 'Persone', days: 'Giorni', guide: 'Guida', van: 'Trasporto (van)',
    commission: 'Commissione hostel', hostelLine: 'Alloggio (2 notti)',
    ingressos: 'Ingressi', totalPer: 'Totale/persona', totalGroup: 'Totale gruppo',
    wappBtn: 'Prenota via WhatsApp', wappNote: 'La guida conferma in meno di 2 ore',
    noStops: 'Nessuna tappa selezionata',
    free: 'Gratis', perPerson: '/persona', nationalPrice: 'biglietto nazionale', promoLabel: 'Promo Brasil',
    minMax: 'Min 6 · max 12 · Sprinter 15 posti',
    guideVanNote: (cost, people) => `Guida + van: R$${cost}/persona per ${people} — più persone, meno a testa`,
    daysNote: (d) => d === 1 ? 'Guida + van per 1 giorno' : 'Guida + van per 2 giorni (prezzo doppio)',
    selaron: 'Scalinata Selarón + Lapa', selaron_d: 'A piedi dall\'ostello',
    santateresa: 'Santa Teresa', santateresa_d: 'Quartiere storico e arte di strada',
    praias: 'Ipanema / Copacabana', praias_d: 'Le spiagge più famose del mondo',
    centro: 'Centro Storico', centro_d: 'Architettura coloniale e musei',
    favela: 'Favela Santa Marta', favela_d: 'Esperienza comunitaria autentica',
    cristo: 'Cristo Redentore', cristo_d: 'Treno del Corcovado · vista 360° su Rio',
    bondinho: 'Pan di Zucchero', bondinho_d: 'Funivia · Baia di Guanabara',
    maracana: 'Tour Maracanã', maracana_d: 'Visita guidata allo stadio leggendario',
    amanha: 'Museo del Domani', amanha_d: 'Scienza e futuro al Porto Maravilha',
    botanico: 'Giardino Botanico', botanico_d: '140 ha · 9.000 specie vegetali',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
}

interface Calc {
  guide: number;
  van: number;
  hostelAmt: number;
  attrSum: number;
  total: number;
  totalGroup: number;
}

function calc(people: number, days: number, hostel: boolean, selected: Set<string>): Calc {
  const guide   = (GUIDE_DAY * days) / people;
  const van     = (VAN_DAY * days) / people;
  const hostelAmt = hostel ? HOSTEL_NIGHT * HOSTEL_NIGHTS : 0;
  const attrSum = [...selected].reduce((s, id) => {
    const a = ATTRACTIONS.find((x) => x.id === id);
    return s + (a ? a.price : 0);
  }, 0);
  const total = guide + van + HOSTEL_COMMISSION + hostelAmt + attrSum;
  return { guide, van, hostelAmt, attrSum, total, totalGroup: total * people };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TourConfiguratorProps {
  locale: string;
}

export function TourConfigurator({ locale }: TourConfiguratorProps) {
  const t = T[(locale as Locale) in T ? (locale as Locale) : 'es'];

  const [people,   setPeople]   = useState(6);
  const [days,     setDays]     = useState(1);
  const [hostel,   setHostel]   = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set(['selaron', 'santateresa']));

  const toggleAttr = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const result = calc(people, days, hostel, selected);
  const fixedPerP = Math.round((GUIDE_DAY * days + VAN_DAY * days) / people);

  const selectedAttrs = ATTRACTIONS.filter((a) => selected.has(a.id));

  // WhatsApp message
  const stops = selectedAttrs.length > 0
    ? selectedAttrs.map((a) => (t as unknown as Record<string, string>)[a.nameKey]).join(', ')
    : '—';
  const waMsg = encodeURIComponent(
    `Hola! Quiero armar un tour personalizado:\n\n👥 Personas: ${people}\n📅 Días: ${days}\n📍 Paradas: ${stops}\n🏨 Hospedaje: ${hostel ? '2 noches incluidas' : 'No'}\n💰 Estimado: ${Math.round(result.total).toLocaleString('pt-BR')} R$/persona\n\n¿Tienen disponibilidad?`
  );

  return (
    <section className="py-12 border-t border-border">
      {/* heading */}
      <h2 className="font-display font-semibold text-xl text-foreground mb-1 tracking-tight">
        {t.heading}
      </h2>
      <p className="text-sm text-muted-foreground mb-8">{t.subheading}</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

        {/* ── LEFT: steps ── */}
        <div className="space-y-4">

          {/* Step 1: people */}
          <div className="border border-border rounded-xl bg-card p-5">
            <p className="text-xs font-display font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-1">
              {t.step1}
            </p>
            <div className="flex items-center gap-5 mt-3">
              <button
                onClick={() => setPeople((p) => Math.max(MIN_PEOPLE, p - 1))}
                disabled={people <= MIN_PEOPLE}
                aria-label="Menos personas"
                className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-lg font-display hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="font-serif font-semibold text-4xl text-primary min-w-[3rem] text-center tabular-nums leading-none">
                {people}
              </span>
              <button
                onClick={() => setPeople((p) => Math.min(MAX_PEOPLE, p + 1))}
                disabled={people >= MAX_PEOPLE}
                aria-label="Más personas"
                className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-lg font-display hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t.minMax}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t.guideVanNote(fixedPerP, people)}
            </p>
          </div>

          {/* Step 2: days */}
          <div className="border border-border rounded-xl bg-card p-5">
            <p className="text-xs font-display font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">
              {t.step2}
            </p>
            <div className="flex gap-3">
              {[1, 2].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={[
                    'flex-1 flex flex-col items-center py-4 rounded-lg border transition-colors',
                    days === d
                      ? 'border-primary bg-primary/8 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted/40',
                  ].join(' ')}
                >
                  <span className="font-serif font-semibold text-3xl leading-none">{d}</span>
                  <span className="text-xs font-display font-semibold uppercase tracking-wide mt-1.5 opacity-70">
                    {d === 1 ? t.days1.split(' ')[1] ?? t.days1 : t.days2.split(' ')[1] ?? t.days2}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t.daysNote(days)}</p>
          </div>

          {/* Step 3: hostel */}
          <div className="border border-border rounded-xl bg-card p-5">
            <p className="text-xs font-display font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">
              {t.step3}
            </p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
                  <Hotel className="h-3.5 w-3.5 text-primary" />
                  {t.hostelLabel}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.hostelDesc}</p>
              </div>
              {/* toggle */}
              <button
                role="switch"
                aria-checked={hostel}
                onClick={() => setHostel((h) => !h)}
                className={[
                  'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
                  hostel ? 'bg-primary' : 'bg-border',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    hostel ? 'translate-x-6' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>

          {/* Step 4: attractions */}
          <div className="border border-border rounded-xl bg-card p-5">
            <p className="text-xs font-display font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">
              {t.step4}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ATTRACTIONS.map((a) => {
                const isSelected = selected.has(a.id);
                const name = (t as unknown as Record<string, string>)[a.nameKey] ?? a.nameKey;
                const desc = (t as unknown as Record<string, string>)[a.descKey] ?? '';
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAttr(a.id)}
                    className={[
                      'text-left rounded-lg border p-3.5 transition-colors relative',
                      isSelected
                        ? 'border-primary bg-primary/8'
                        : 'border-border bg-card hover:bg-muted/30',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                    <p className="text-[10px] font-display font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                      {a.cat}
                    </p>
                    <p className="text-xs font-display font-semibold text-foreground pr-5">{name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                    <span
                      className={[
                        'inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-display font-semibold',
                        a.price === 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
                      ].join(' ')}
                    >
                      {a.price === 0 ? t.free : `${fmt(a.price)}${t.perPerson}`}
                    </span>
                    {a.price > 0 && (
                      <span className="block text-[10px] text-muted-foreground mt-0.5 italic">
                        {a.id === 'bondinho' ? t.promoLabel : t.nationalPrice}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: sticky summary ── */}
        <aside className="lg:sticky lg:top-6 border border-border rounded-xl bg-card p-5 space-y-0">
          <h3 className="font-serif font-semibold text-lg text-foreground mb-4">{t.summaryTitle}</h3>

          {/* rows */}
          <div className="space-y-0 text-sm">
            <Row label={t.people} value={`${people}`} />
            <Row label={t.days}   value={`${days}`} />
            <div className="h-px bg-border my-2" />
            <Row label={t.guide}      value={`${fmt(result.guide)}/p`}   indent />
            <Row label={t.van}        value={`${fmt(result.van)}/p`}     indent />
            <Row label={t.commission} value={`${fmt(HOSTEL_COMMISSION)}/p`} indent />
            {hostel && (
              <Row label={t.hostelLine} value={`${fmt(result.hostelAmt)}/p`} indent />
            )}

            {selectedAttrs.length > 0 && (
              <>
                <div className="h-px bg-border my-2" />
                <p className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground py-1">
                  {t.ingressos}
                </p>
                {selectedAttrs.map((a) => (
                  <Row
                    key={a.id}
                    label={(t as unknown as Record<string, string>)[a.nameKey] ?? a.id}
                    value={a.price === 0 ? t.free : `${fmt(a.price)}/p`}
                    indent
                  />
                ))}
              </>
            )}
          </div>

          <div className="h-px bg-border my-4" />

          {/* total */}
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground">
              {t.totalPer}
            </span>
            <span className="font-serif font-semibold text-3xl text-primary leading-none tabular-nums">
              {fmt(result.total)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1 tabular-nums">
            {t.totalGroup} ({people}): {fmt(result.totalGroup)}
          </p>

          {/* WhatsApp CTA */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-[#25D366] text-white text-sm font-display font-semibold hover:opacity-90 transition-opacity"
          >
            {/* WhatsApp icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {t.wappBtn}
          </a>
          <p className="text-center text-xs text-muted-foreground mt-2">{t.wappNote}</p>
        </aside>
      </div>
    </section>
  );
}

// ─── Row helper ──────────────────────────────────────────────────────────────

function Row({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline gap-2 py-1 ${indent ? 'pl-3' : ''}`}>
      <span className={`text-muted-foreground text-xs ${indent ? 'before:content-["·"] before:mr-1.5' : ''}`}>
        {label}
      </span>
      <span className="text-foreground text-xs font-medium tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}
