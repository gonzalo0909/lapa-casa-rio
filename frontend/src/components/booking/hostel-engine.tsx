'use client';
// lapa-casa-hostel/frontend/src/components/booking/hostel-engine.tsx
// Puerto fiel de docs/MaquetaMrh.html → React/Next.js
// Incluye: trilingual PT/ES/EN, calendario, rooms progresivos,
// validación CPF/pasaporte, timer 5min, panel expirado, política de cancelación.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { bookingAPI, availabilityAPI } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────
type Lang = 'pt' | 'es' | 'en';
type Phase = 'wizard' | 'success' | 'expired';
type PayMethod = 'pix' | 'card';

interface RoomDef {
  id: string;
  realId?: string;
  name: string;
  type: 'mixed' | 'female';
  capacity: number;
  available: number;
  price: number;
  isFlexible: boolean;
}

interface FormState {
  name: string; email: string; email2: string; phone: string;
  country: string; doc: string; arrival: string; requests: string;
}

interface FormErrors {
  name?: string; email?: string; email2?: string; phone?: string;
  country?: string; doc?: string; arrival?: string;
}

// ─── Translations ───────────────────────────────────────
const T = {
  pt: {
    step1:'Datas',step2:'Quartos',step3:'Hóspede',step4:'Resumo',
    p1title:'Escolha suas datas',p1sub:'Selecione entrada e saída',
    checkin:'Check-in',checkout:'Check-out',
    calPrev:'Mês anterior',calNext:'Próximo mês',
    seasonMedia:'⛅ Média: ×1.0',seasonAlta:'☀️ Alta (Dez–Mar, Jul–Ago): ×1.5',
    seasonCarnaval:'🎉 Carnaval (mín. 5 noites): ×2.0',seasonBaixa:'🌧 Baixa (Jun, Set): ×0.8',
    p2title:'Selecione os quartos',p2sub:'Quantas camas você precisa?',
    p3title:'Dados do hóspede',p3sub:'Responsável pela reserva',
    lblName:'Nome completo',errName:'Nome completo é obrigatório',
    lblEmail:'E-mail',errEmail:'E-mail inválido',
    lblEmail2:'Confirmar e-mail',errEmail2:'E-mails não coincidem',noPaste:'(não colar)',
    lblPhone:'WhatsApp',errPhone:'Telefone obrigatório',
    lblCountry:'País',errCountry:'País obrigatório',
    selectPlaceholder:'Selecione',optOther:'Outro',
    lblCPF:'CPF',lblPassport:'Passaporte / Documento',
    errCPF:'CPF inválido',errDocForeign:'Documento inválido (mín. 5 caracteres)',
    phCPF:'000.000.000-00',phPassport:'Número do passaporte',
    fbCPFok:'✓ CPF válido',fbCPFerr:'✗ CPF inválido',fbDocOk:'✓ Documento aceito',
    lblArrival:'Horário de chegada',errArrival:'Horário de chegada obrigatório',
    arrivalPlaceholder:'Selecione (14h–22h)',
    lblRequests:'Solicitações especiais',optional:'(opcional)',
    rulesTitle:'⚠️ Regras da casa',
    rule1:'Check-in: 14h–22h. Fora do horário, avisar com antecedência.',
    rule2:'Check-out: até 11h. Late check-out sujeito à disponibilidade.',
    rule3:'Documento de identidade obrigatório no check-in.',
    rule4:'Hospedagem permitida a partir de 18 anos.',
    rule5:'Proibido fumar dentro do hostel.',
    cancelBtn:'🔄 Política de cancelamento',
    cancelFree:'✓ Grátis',cancelFreeText:'Cancele até 48 horas antes do check-in — reembolso integral do depósito.',
    cancelNo:'✗ Não reembolsável',cancelNoText:'Cancelamento nas últimas 48 horas ou no-show — depósito retido.',
    p4title:'Resumo da reserva',p4sub:'Revise antes de confirmar',
    sumDatesHead:'Datas e Quartos',sumPriceHead:'Preço',sumGuestHead:'Hóspede',
    pmPix:'⚡ PIX',pmPixApproval:'Aprovação imediata',pmCard:'💳 Cartão de crédito',
    btnConfirm:'Confirmar reserva',btnWhatsApp:'💬 Confirmar por WhatsApp',
    successTitle:'Reserva confirmada!',successSub:'Enviamos os detalhes por e-mail e WhatsApp',
    pixDepLabel:'Depósito PIX',cardDepLabel:'Pagamento com cartão',
    cardInstruction:'Você receberá o link de pagamento por e-mail.',
    timerLabel:'Expira em',pixKey:'Chave PIX: lapacasa@gmail.com',
    restNote:'O restante (70%) é pago no check-in, em dinheiro ou cartão.',
    btnNewBooking:'Nova reserva',
    expiredTitle:'Reserva não concluída',expiredSub:'O tempo expirou. As vagas foram liberadas.',
    btnTryAgain:'Tentar novamente',
    priceBase:'Base por noite',btnBack:'Voltar',btnNext:'Próximo',
    discountActive:'Desconto de grupo ativo!',
    flexibleNotice:'🔄 Cuarto 6 — Solo Mujeres: quarto feminino por padrão. Converte para misto 48h antes do check-in se necessário.',
    tNights:'Noites',tTotalBeds:'Total de camas',tGroupDisc:'Desconto de grupo',
    tTotal:'Total',tDepositNow:'Depósito agora (PIX/Cartão)',tAtCheckin:'no check-in',
    tNight:'noite',tNights2:'noites',tBed:'cama',tBeds:'camas',
    tSelectCheckout:'Selecione check-out',tClickCheckout:'Clique em uma data de saída',
    tInProgress:'em curso',tCountryLabel:'País',
    tToastCheckin:'Selecione a data de check-in.',tToastCheckout:'Selecione a data de check-out.',
    tToastMinNights:'estadia mínima de',tToastNights:'noites.',
    tToastBeds:'Selecione pelo menos 1 cama.',
    otaDirect:'Reservar direto economiza',otaVs:'em relação ao Airbnb/Booking',
    errorBooking:'Erro ao criar reserva. Tente novamente.',
  },
  es: {
    step1:'Fechas',step2:'Cuartos',step3:'Huésped',step4:'Resumen',
    p1title:'Elige tus fechas',p1sub:'Selecciona entrada y salida',
    checkin:'Check-in',checkout:'Check-out',
    calPrev:'Mes anterior',calNext:'Mes siguiente',
    seasonMedia:'⛅ Media: ×1.0',seasonAlta:'☀️ Alta (Dic–Mar, Jul–Ago): ×1.5',
    seasonCarnaval:'🎉 Carnaval (mín. 5 noches): ×2.0',seasonBaixa:'🌧 Baja (Jun, Sep): ×0.8',
    p2title:'Selecciona los cuartos',p2sub:'¿Cuántas camas necesitas?',
    p3title:'Datos del huésped',p3sub:'Responsable de la reserva',
    lblName:'Nombre completo',errName:'Nombre completo es obligatorio',
    lblEmail:'Correo electrónico',errEmail:'Correo inválido',
    lblEmail2:'Confirmar correo',errEmail2:'Los correos no coinciden',noPaste:'(no pegar)',
    lblPhone:'WhatsApp',errPhone:'Teléfono obligatorio',
    lblCountry:'País',errCountry:'País obligatorio',
    selectPlaceholder:'Seleccionar',optOther:'Otro',
    lblCPF:'CPF',lblPassport:'Pasaporte / Documento',
    errCPF:'CPF inválido',errDocForeign:'Documento inválido (mín. 5 caracteres)',
    phCPF:'000.000.000-00',phPassport:'Número de pasaporte',
    fbCPFok:'✓ CPF válido',fbCPFerr:'✗ CPF inválido',fbDocOk:'✓ Documento aceptado',
    lblArrival:'Hora de llegada',errArrival:'Hora de llegada obligatoria',
    arrivalPlaceholder:'Seleccionar (14h–22h)',
    lblRequests:'Solicitudes especiales',optional:'(opcional)',
    rulesTitle:'⚠️ Normas de la casa',
    rule1:'Check-in: 14h–22h. Fuera del horario, avisar con anticipación.',
    rule2:'Check-out: hasta 11h. Late check-out sujeto a disponibilidad.',
    rule3:'Documento de identidad obligatorio en el check-in.',
    rule4:'Hospedaje permitido a partir de 18 años.',
    rule5:'Prohibido fumar dentro del hostel.',
    cancelBtn:'🔄 Política de cancelación',
    cancelFree:'✓ Gratis',cancelFreeText:'Cancela hasta 48 horas antes del check-in — reembolso total del depósito.',
    cancelNo:'✗ No reembolsable',cancelNoText:'Cancelación en las últimas 48 horas o no-show — depósito retenido.',
    p4title:'Resumen de la reserva',p4sub:'Revisa antes de confirmar',
    sumDatesHead:'Fechas y Cuartos',sumPriceHead:'Precio',sumGuestHead:'Huésped',
    pmPix:'⚡ PIX',pmPixApproval:'Aprobación inmediata',pmCard:'💳 Tarjeta de crédito',
    btnConfirm:'Confirmar reserva',btnWhatsApp:'💬 Confirmar por WhatsApp',
    successTitle:'¡Reserva confirmada!',successSub:'Te enviamos los detalles por e-mail y WhatsApp',
    pixDepLabel:'Depósito PIX',cardDepLabel:'Pago con tarjeta',
    cardInstruction:'Recibirás el enlace de pago por e-mail.',
    timerLabel:'Expira en',pixKey:'Clave PIX: lapacasa@gmail.com',
    restNote:'El resto (70%) se paga en el check-in, en efectivo o tarjeta.',
    btnNewBooking:'Nueva reserva',
    expiredTitle:'Reserva no concretada',expiredSub:'El tiempo expiró. Los espacios fueron liberados.',
    btnTryAgain:'Intentar de nuevo',
    priceBase:'Base por noche',btnBack:'Volver',btnNext:'Siguiente',
    discountActive:'¡Descuento de grupo activo!',
    flexibleNotice:'🔄 Cuarto 6 — Solo Mujeres: habitación femenina por defecto. Se convierte a mixto 48h antes del check-in si es necesario.',
    tNights:'Noches',tTotalBeds:'Total de camas',tGroupDisc:'Descuento de grupo',
    tTotal:'Total',tDepositNow:'Depósito ahora (PIX/Tarjeta)',tAtCheckin:'en el check-in',
    tNight:'noche',tNights2:'noches',tBed:'cama',tBeds:'camas',
    tSelectCheckout:'Seleccionar check-out',tClickCheckout:'Haz clic en una fecha de salida',
    tInProgress:'en curso',tCountryLabel:'País',
    tToastCheckin:'Selecciona la fecha de check-in.',tToastCheckout:'Selecciona la fecha de check-out.',
    tToastMinNights:'estancia mínima de',tToastNights:'noches.',
    tToastBeds:'Selecciona al menos 1 cama.',
    otaDirect:'Reservar directo ahorra',otaVs:'vs Airbnb/Booking',
    errorBooking:'Error al crear la reserva. Inténtalo de nuevo.',
  },
  en: {
    step1:'Dates',step2:'Rooms',step3:'Guest',step4:'Summary',
    p1title:'Choose your dates',p1sub:'Select check-in and check-out',
    checkin:'Check-in',checkout:'Check-out',
    calPrev:'Previous month',calNext:'Next month',
    seasonMedia:'⛅ Mid season: ×1.0',seasonAlta:'☀️ High (Dec–Mar, Jul–Aug): ×1.5',
    seasonCarnaval:'🎉 Carnival (min. 5 nights): ×2.0',seasonBaixa:'🌧 Low (Jun, Sep): ×0.8',
    p2title:'Select your rooms',p2sub:'How many beds do you need?',
    p3title:'Guest details',p3sub:'Booking contact',
    lblName:'Full name',errName:'Full name is required',
    lblEmail:'Email',errEmail:'Invalid email',
    lblEmail2:'Confirm email',errEmail2:'Emails do not match',noPaste:'(no paste)',
    lblPhone:'WhatsApp',errPhone:'Phone number required',
    lblCountry:'Country',errCountry:'Country required',
    selectPlaceholder:'Select',optOther:'Other',
    lblCPF:'CPF',lblPassport:'Passport / ID',
    errCPF:'Invalid CPF',errDocForeign:'Invalid document (min. 5 characters)',
    phCPF:'000.000.000-00',phPassport:'Passport number',
    fbCPFok:'✓ Valid CPF',fbCPFerr:'✗ Invalid CPF',fbDocOk:'✓ Document accepted',
    lblArrival:'Arrival time',errArrival:'Arrival time required',
    arrivalPlaceholder:'Select (2 pm–10 pm)',
    lblRequests:'Special requests',optional:'(optional)',
    rulesTitle:'⚠️ House rules',
    rule1:'Check-in: 2 pm–10 pm. Outside these hours, notify in advance.',
    rule2:'Check-out: by 11 am. Late check-out subject to availability.',
    rule3:'ID required at check-in.',
    rule4:'Guests must be 18 or older.',
    rule5:'Smoking inside the hostel is not allowed.',
    cancelBtn:'🔄 Cancellation policy',
    cancelFree:'✓ Free',cancelFreeText:'Cancel up to 48 hours before check-in — full deposit refund.',
    cancelNo:'✗ Non-refundable',cancelNoText:'Cancellation within 48 hours or no-show — deposit forfeited.',
    p4title:'Booking summary',p4sub:'Review before confirming',
    sumDatesHead:'Dates & Rooms',sumPriceHead:'Price',sumGuestHead:'Guest',
    pmPix:'⚡ PIX',pmPixApproval:'Instant approval',pmCard:'💳 Credit card',
    btnConfirm:'Confirm booking',btnWhatsApp:'💬 Confirm via WhatsApp',
    successTitle:'Booking confirmed!',successSub:'We sent the details to your email and WhatsApp',
    pixDepLabel:'PIX deposit',cardDepLabel:'Card payment',
    cardInstruction:'You will receive the payment link by email.',
    timerLabel:'Expires in',pixKey:'PIX key: lapacasa@gmail.com',
    restNote:'The remaining 70% is due at check-in, in cash or by card.',
    btnNewBooking:'New booking',
    expiredTitle:'Booking not completed',expiredSub:'Time expired. The beds have been released.',
    btnTryAgain:'Try again',
    priceBase:'Base per night',btnBack:'Back',btnNext:'Next',
    discountActive:'Group discount active!',
    flexibleNotice:'🔄 Room 6 — Women Only: female dorm by default. Converts to mixed 48h before check-in if needed.',
    tNights:'Nights',tTotalBeds:'Total beds',tGroupDisc:'Group discount',
    tTotal:'Total',tDepositNow:'Deposit now (PIX/Card)',tAtCheckin:'at check-in',
    tNight:'night',tNights2:'nights',tBed:'bed',tBeds:'beds',
    tSelectCheckout:'Select check-out',tClickCheckout:'Click a check-out date',
    tInProgress:'in progress',tCountryLabel:'Country',
    tToastCheckin:'Select a check-in date.',tToastCheckout:'Select a check-out date.',
    tToastMinNights:'minimum stay of',tToastNights:'nights.',
    tToastBeds:'Select at least 1 bed.',
    otaDirect:'Booking direct saves you',otaVs:'vs Airbnb/Booking',
    errorBooking:'Error creating booking. Please try again.',
  },
} as const;

// ─── Default rooms (fallback if API unavailable) ────────
const DEFAULT_ROOMS: RoomDef[] = [
  { id:'cuarto1', name:'Cuarto 1', type:'mixed',  capacity:12, available:12, price:85, isFlexible:false },
  { id:'cuarto3', name:'Cuarto 3', type:'mixed',  capacity:12, available:12, price:85, isFlexible:false },
  { id:'cuarto4', name:'Cuarto 4', type:'mixed',  capacity:7,  available:7,  price:85, isFlexible:false },
  { id:'cuarto5', name:'Cuarto 5', type:'mixed',  capacity:7,  available:7,  price:85, isFlexible:false },
  { id:'cuarto6', name:'Cuarto 6', type:'female', capacity:7,  available:7,  price:85, isFlexible:true  },
];

// ─── Pure helpers ───────────────────────────────────────
function getSeason(date: Date) {
  const m = date.getMonth(), d = date.getDate(), y = date.getFullYear();
  if (m===1 && ((y===2027 && d>=13 && d<=17)||(y===2026 && d>=28)))
    return { mult:2.0, label:'Carnaval', minNights:5 };
  if (m===11||m===0||m===6||m===7) return { mult:1.5, label:'Alta Temporada', minNights:1 };
  if (m===5||m===8)                 return { mult:0.8, label:'Baixa Temporada', minNights:1 };
  return { mult:1.0, label:'Média Temporada', minNights:1 };
}
function groupDisc(beds: number) { return beds>=13?0.15:beds>=3?0.10:0; }
function calcPrice(ci: Date|null, co: Date|null, beds: Record<string,number>) {
  if (!ci||!co) return null;
  const nights = Math.round((co.getTime()-ci.getTime())/86400000);
  const totalB = Object.values(beds).reduce((s,n)=>s+n,0);
  if (nights<=0||totalB===0) return null;
  const season = getSeason(ci);
  const pbn = 85 * season.mult;
  const subtotal = pbn * totalB * nights;
  const disc = groupDisc(totalB);
  const total = subtotal*(1-disc);
  return { nights, beds:totalB, season, pbn, subtotal, disc, discAmt:subtotal*disc, total, deposit:total*0.3 };
}
function validateCPF(raw: string): boolean {
  const c = raw.replace(/\D/g,'');
  if (c.length!==11||/^(\d)\1{10}$/.test(c)) return false;
  let s=0; for(let i=0;i<9;i++) s+=+c[i]*(10-i);
  let d=(s*10)%11; if(d>=10) d=0; if(d!==+c[9]) return false;
  s=0; for(let i=0;i<10;i++) s+=+c[i]*(11-i);
  d=(s*10)%11; if(d>=10) d=0; return d===+c[10];
}
function formatCPF(v: string): string {
  const d=v.replace(/\D/g,'').slice(0,11);
  if(d.length>9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if(d.length>6) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  if(d.length>3) return `${d.slice(0,3)}.${d.slice(3)}`;
  return d;
}
function formatPhone(raw: string): string {
  const clean=raw.replace(/[^\d+]/g,'');
  const digits=clean.replace(/\D/g,'');
  if(digits.length<=2) return clean;
  if(clean.startsWith('+55')){
    const d=digits.slice(2);
    let f='+55 ';
    if(d.length>0) f+='('+d.slice(0,2)+')';
    if(d.length>2) f+=' '+d.slice(2,7);
    if(d.length>7) f+='-'+d.slice(7,11);
    return f;
  }
  if(!clean.startsWith('+')){
    const local=digits.slice(2,11);
    const sp=local.length>8?5:4;
    let f='('+digits.slice(0,2)+')';
    if(local.length>0) f+=' '+local.slice(0,sp);
    if(local.length>sp) f+='-'+local.slice(sp);
    return f;
  }
  return clean.slice(0,18);
}
function fmtDate(d: Date) { return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.',''); }
function fmtMoney(v: number) { return 'R$ '+v.toFixed(2).replace('.',','); }
function dateOnly(d: Date) { return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function sameDay(a:Date|null,b:Date|null){ return !!a&&!!b&&a.toDateString()===b.toDateString(); }
function dayBefore(a:Date,b:Date){ return dateOnly(a)<dateOnly(b); }
function inRange(d:Date,a:Date|null,b:Date|null){
  if(!a||!b) return false;
  const [s,e]=dayBefore(a,b)?[a,b]:[b,a];
  return dateOnly(d)>dateOnly(s)&&dateOnly(d)<dateOnly(e);
}

const DAY_LBL: Record<Lang,string[]> = {
  pt:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
  es:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};
const MON_LBL: Record<Lang,string[]> = {
  pt:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
};

// ─── Inline CSS ─────────────────────────────────────────
const CSS = `
.he-wrap{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#F7F4EF;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:0 1rem 3rem}
.he-header{background:#1E3A5F;color:#fff;padding:1.25rem 1.5rem 1.1rem;text-align:center;width:100%;max-width:500px;margin-bottom:1.5rem;border-radius:0 0 8px 8px}
.he-brand{font-family:Georgia,'Times New Roman',serif;font-size:1.45rem;font-weight:400;letter-spacing:.04em}
.he-brand-sub{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-top:.1rem}
.he-lang-sw{display:flex;gap:.3rem;margin-top:.45rem;justify-content:center}
.he-lang-btn{font-size:.6rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:.18em .5em;border-radius:3px;border:1.5px solid rgba(255,255,255,.3);background:transparent;color:rgba(255,255,255,.6);cursor:pointer;transition:all .12s}
.he-lang-btn.active{background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.7)}
.he-card{background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(30,58,95,.06),0 8px 24px rgba(30,58,95,.10);width:100%;max-width:500px;overflow:hidden}
.he-steps{display:grid;grid-template-columns:repeat(4,1fr);background:#1E3A5F;position:relative}
.he-step-tab{display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.7rem .25rem .55rem;color:rgba(255,255,255,.45);position:relative;transition:color .2s}
.he-step-tab.active{color:#fff}.he-step-tab.done{color:rgba(255,255,255,.7)}
.he-step-num{font-size:.6rem;font-weight:700;width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;transition:background .2s,border-color .2s}
.he-step-tab.active .he-step-num{background:#C8870A;border-color:#C8870A;color:#fff}
.he-step-tab.done .he-step-num{background:rgba(255,255,255,.2)}
.he-step-lbl{font-size:.65rem;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.he-step-bar{position:absolute;bottom:0;left:0;height:2px;background:#C8870A;width:25%;transition:left .3s cubic-bezier(.4,0,.2,1)}
.he-toast{margin:.75rem 1.5rem 0;padding:.55rem .85rem;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:5px;font-size:.75rem;color:#991B1B}
.he-panel{padding:1.5rem 1.5rem 1rem}
.he-panel-title{font-size:1rem;font-weight:700;color:#1C1814;margin-bottom:.2rem}
.he-panel-sub{font-size:.78rem;color:#7A6E64;margin-bottom:1.25rem}
.he-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.he-cal-month{font-size:.9rem;font-weight:700;color:#1C1814;text-transform:capitalize}
.he-cal-nav-btn{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#7A6E64;cursor:pointer;background:none;border:none;transition:background .15s,color .15s}
.he-cal-nav-btn:hover{background:#E2DDD4;color:#1C1814}
.he-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.he-cal-dlbl{font-size:.62rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7A6E64;text-align:center;padding:.3rem 0 .5rem}
.he-cal-cell{text-align:center;padding:.1rem 0;position:relative}
.he-cal-day{width:34px;height:34px;border-radius:50%;margin:auto;display:flex;align-items:center;justify-content:center;font-size:.78rem;color:#1C1814;position:relative;z-index:1;cursor:pointer;background:none;border:none;font-family:inherit;transition:background .12s,color .12s}
.he-cal-day:hover:not(:disabled){background:#F5E6BE;color:#1E3A5F}
.he-cal-day:disabled{color:#E2DDD4;cursor:not-allowed}
.he-cal-cell.in-range::before{content:'';position:absolute;inset:0;background:#F5E6BE;top:50%;transform:translateY(-50%);height:34px;z-index:0}
.he-cal-cell.range-start::before{left:50%}.he-cal-cell.range-end::before{right:50%}
.he-cal-cell.range-start.range-end::before{display:none}
.he-cal-cell.range-start .he-cal-day,.he-cal-cell.range-end .he-cal-day{background:#1E3A5F;color:#fff}
.he-cal-cell.is-today .he-cal-day{border:1.5px solid #C8870A;color:#C8870A}
.he-cal-cell.is-today.in-range .he-cal-day{color:#1E3A5F}
.he-cal-cell.s-alta .he-cal-day:not(:disabled){color:#B45309}
.he-cal-cell.s-carnaval .he-cal-day:not(:disabled){color:#9333EA}
.he-cal-cell.s-baixa .he-cal-day:not(:disabled){color:#1D4ED8}
.he-cal-cell.s-alta::after,.he-cal-cell.s-carnaval::after,.he-cal-cell.s-baixa::after{content:'';position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%}
.he-cal-cell.s-alta::after{background:#F59E0B}.he-cal-cell.s-carnaval::after{background:#A855F7}.he-cal-cell.s-baixa::after{background:#60A5FA}
.he-dates-sel{display:flex;gap:1rem;margin-top:1rem;padding:.75rem 1rem;background:#FBF4E3;border-radius:6px;border:1px solid #F5E6BE}
.he-date-col{flex:1}.he-date-lbl{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#7A6E64;margin-bottom:.15rem}
.he-date-val{font-size:.88rem;font-weight:700;color:#1E3A5F}
.he-nights-c{text-align:center;font-size:.72rem;color:#C8870A;font-weight:700;align-self:center;white-space:nowrap}
.he-min-warn{background:#FEF3E2;border:1px solid #FCD34D;border-radius:5px;padding:.55rem .85rem;font-size:.75rem;color:#92400E;margin-top:.6rem}
.he-season-info{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.85rem;padding-top:.85rem;border-top:1px solid #E2DDD4}
.he-chip{font-size:.68rem;padding:.2em .55em;border-radius:3px;font-weight:600}
.he-chip.media{background:#EBF4EC;color:#1D6B34}.he-chip.alta{background:#FEF3E2;color:#B45309}
.he-chip.carnaval{background:#FEE2E2;color:#B91C1C}.he-chip.baixa{background:#EFF6FF;color:#1D4ED8}
.he-rooms{display:flex;flex-direction:column;gap:.65rem}
.he-room{border:1.5px solid #E2DDD4;border-radius:6px;padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;transition:border-color .15s}
.he-room.has-beds{border-color:#C8870A}
.he-stripe{width:3px;border-radius:2px;align-self:stretch;flex-shrink:0}
.he-stripe-mixed{background:#4A90D9}.he-stripe-female{background:#E87AA8}
.he-ri{flex:1;min-width:0}
.he-rn{font-size:.85rem;font-weight:700;color:#1C1814}
.he-rm{display:flex;gap:.5rem;align-items:center;margin-top:.15rem;flex-wrap:wrap}
.he-rbadge{font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:.15em .5em;border-radius:3px}
.he-rbadge-m{background:#EBF4FF;color:#1D4ED8}.he-rbadge-f{background:#FEF0F8;color:#9D174D}
.he-ravail{font-size:.68rem;color:#7A6E64}
.he-rprice{font-size:.72rem;color:#7A6E64;margin-top:.2rem}
.he-rprice strong{color:#1C1814;font-size:.82rem}
.he-stepper{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
.he-sbtn{width:28px;height:28px;border-radius:50%;border:1.5px solid #E2DDD4;background:#fff;color:#1C1814;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.he-sbtn:hover:not(:disabled){border-color:#1E3A5F;background:#1E3A5F;color:#fff}
.he-sbtn:disabled{color:#E2DDD4;cursor:not-allowed}
.he-scnt{font-size:.95rem;font-weight:700;min-width:1.25rem;text-align:center;color:#1C1814}
.he-flex-notice{background:#FBF4E3;border:1px solid #F5E6BE;border-radius:5px;padding:.6rem .8rem;font-size:.72rem;color:#1E3A5F;margin-top:.5rem}
.he-disc-strip{display:flex;align-items:center;gap:.5rem;padding:.55rem .8rem;background:#EBF7EF;border:1px solid #A7DFB8;border-radius:5px;font-size:.73rem;color:#145727;font-weight:600;margin-top:.75rem}
.he-form-row{margin-bottom:.85rem}
.he-form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.85rem}
.he-label{display:block;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7A6E64;margin-bottom:.3rem}
.he-req{color:#C8870A}
.he-inp{width:100%;border:1.5px solid #E2DDD4;border-radius:5px;padding:.55rem .75rem;background:#fff;color:#1C1814;font-size:.85rem;transition:border-color .15s;font-family:inherit}
.he-inp:focus{border-color:#1E3A5F;outline:none}
.he-inp.err{border-color:#C0393B}.he-inp.ok{border-color:#1D8A55}
.he-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237A6E64' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}
.he-textarea{resize:vertical;min-height:64px}
.he-ferr{font-size:.68rem;color:#C0393B;margin-top:.25rem}
.he-ffb{font-size:.68rem;margin-top:.2rem}
.he-ffb.ok{color:#1D8A55}.he-ffb.err{color:#C0393B}
.he-rules{border:1px solid #E2DDD4;border-radius:6px;padding:.75rem .9rem;margin-bottom:.85rem;background:#F7F4EF}
.he-rules-title{font-size:.68rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#7A6E64;margin-bottom:.45rem}
.he-rule{font-size:.75rem;color:#1C1814;display:flex;gap:.45rem;padding:.2rem 0}
.he-cancel{border:1px solid #E2DDD4;border-radius:6px;overflow:hidden;margin-bottom:.85rem}
.he-cancel-btn{width:100%;display:flex;align-items:center;justify-content:space-between;padding:.65rem .9rem;font-size:.78rem;font-weight:600;color:#1C1814;background:#fff;text-align:left;cursor:pointer;border:none;font-family:inherit}
.he-cancel-btn:hover{background:#F7F4EF}
.he-chevron{font-size:.7rem;color:#7A6E64;transition:transform .2s;display:inline-block}
.he-chevron.open{transform:rotate(180deg)}
.he-cancel-body{border-top:1px solid #E2DDD4;padding:.65rem .9rem}
.he-cancel-row{display:flex;gap:.6rem;align-items:flex-start;font-size:.75rem;color:#1C1814;padding:.3rem 0;border-bottom:1px solid #E2DDD4}
.he-cancel-row:last-child{border-bottom:none}
.he-cbadge{font-size:.62rem;font-weight:700;padding:.15em .55em;border-radius:3px;white-space:nowrap;flex-shrink:0;margin-top:.1rem}
.he-cbadge-g{background:#EBF7EF;color:#145727}.he-cbadge-r{background:#FEE2E2;color:#991B1B}
.he-sum-sec{border:1px solid #E2DDD4;border-radius:6px;overflow:hidden;margin-bottom:.75rem}
.he-sum-head{background:#F7F4EF;padding:.5rem .9rem;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#7A6E64}
.he-sum-rows{padding:.5rem .9rem}
.he-sum-row{display:flex;justify-content:space-between;align-items:baseline;padding:.4rem 0;font-size:.82rem;border-bottom:1px solid #E2DDD4}
.he-sum-row:last-child{border-bottom:none}
.he-sum-row.total{font-weight:700;font-size:.9rem;color:#1E3A5F;border-top:2px solid #E2DDD4;padding-top:.55rem;margin-top:.1rem}
.he-sum-row.disc{color:#1D8A55}
.he-dep-box{background:#FBF4E3;border:1.5px solid #F5E6BE;border-radius:6px;padding:.85rem 1rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem}
.he-dep-half{text-align:center}
.he-dep-lbl{font-size:.62rem;letter-spacing:.07em;text-transform:uppercase;color:#7A6E64;margin-bottom:.2rem}
.he-dep-amt{font-size:1.05rem;font-weight:800;color:#1E3A5F}
.he-dep-note{font-size:.65rem;color:#7A6E64;margin-top:.1rem}
.he-ota{background:#FBF4E3;border:1px solid #F5E6BE;border-radius:5px;padding:.6rem .85rem;font-size:.75rem;color:#1E3A5F;margin-bottom:.85rem}
.he-pay-methods{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.85rem}
.he-pay-m{display:flex;align-items:center;gap:.75rem;border:1.5px solid #E2DDD4;border-radius:6px;padding:.65rem .9rem;cursor:pointer;transition:border-color .15s;background:#fff;width:100%;text-align:left;font-family:inherit}
.he-pay-m.selected{border-color:#1E3A5F}
.he-pm-info{flex:1;min-width:0}
.he-pm-name{font-size:.82rem;font-weight:700;color:#1C1814}
.he-pm-detail{font-size:.72rem;color:#7A6E64;margin-top:.1rem}
.he-pm-instant{font-size:.62rem;font-weight:700;padding:.15em .5em;border-radius:3px;background:#EBF7EF;color:#145727;white-space:nowrap;flex-shrink:0}
.he-btn-confirm{padding:.7rem 1.5rem;border-radius:5px;font-size:.85rem;font-weight:700;background:#C8870A;color:#fff;width:100%;display:block;text-align:center;letter-spacing:.02em;cursor:pointer;border:none;font-family:inherit;transition:background .12s}
.he-btn-confirm:hover:not(:disabled){background:#A36E07}
.he-btn-confirm:disabled{background:#7A6E64;cursor:not-allowed}
.he-btn-wa{display:block;width:100%;text-align:center;padding:.6rem;border-radius:5px;font-size:.8rem;font-weight:600;color:#fff;background:#25D366;text-decoration:none;margin-top:.5rem;transition:background .12s;cursor:pointer;border:none;font-family:inherit}
.he-btn-wa:hover{background:#1DAE55}
.he-foot{padding:1rem 1.5rem;border-top:1px solid #E2DDD4;display:flex;align-items:center;gap:1rem;background:#fff}
.he-price-main{font-size:.95rem;font-weight:800;color:#1E3A5F;font-variant-numeric:tabular-nums}
.he-price-sub{font-size:.68rem;color:#7A6E64}
.he-foot-btns{display:flex;gap:.5rem;flex-shrink:0;margin-left:auto}
.he-btn-back{padding:.55rem 1rem;border-radius:5px;font-size:.8rem;font-weight:600;color:#7A6E64;border:1.5px solid #E2DDD4;background:#fff;cursor:pointer;font-family:inherit;transition:border-color .12s,color .12s}
.he-btn-back:hover{border-color:#1E3A5F;color:#1E3A5F}
.he-btn-next{padding:.55rem 1.25rem;border-radius:5px;font-size:.8rem;font-weight:700;background:#1E3A5F;color:#fff;cursor:pointer;border:none;font-family:inherit;transition:background .12s}
.he-btn-next:hover:not(:disabled){background:#2A5282}
.he-btn-next:disabled{background:#7A6E64;cursor:not-allowed}
.he-success-panel{padding:2rem 1.5rem;text-align:center}
.he-success-check{width:56px;height:56px;border-radius:50%;background:#EBF7EF;border:2px solid #A7DFB8;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.5rem}
.he-success-title{font-size:1.1rem;font-weight:800;color:#1E3A5F;margin-bottom:.3rem}
.he-success-sub{font-size:.8rem;color:#7A6E64;margin-bottom:1.25rem}
.he-booking-code{font-family:ui-monospace,'Cascadia Code',monospace;font-size:1.1rem;font-weight:700;letter-spacing:.12em;color:#1E3A5F;background:#FBF4E3;border:1.5px solid #F5E6BE;border-radius:6px;padding:.6rem 1.25rem;display:inline-block;margin-bottom:1.25rem}
.he-pay-box{border:1.5px solid #E2DDD4;border-radius:6px;padding:1rem;display:inline-flex;flex-direction:column;align-items:center;gap:.5rem}
.he-pix-qr{width:96px;height:96px;background:#1C1814;border-radius:4px;display:flex;align-items:center;justify-content:center}
.he-pix-lbl{font-size:.68rem;color:#7A6E64;letter-spacing:.06em;text-transform:uppercase}
.he-pix-amt{font-size:.95rem;font-weight:800;color:#1E3A5F}
.he-timer{font-size:.8rem;color:#7A6E64;margin-top:.25rem}
.he-timer strong{color:#1E3A5F;font-weight:800}
.he-success-note{font-size:.72rem;color:#7A6E64;margin-top:.75rem;line-height:1.5}
.he-expired-panel{padding:2.5rem 1rem;text-align:center}
.he-expired-icon{font-size:2.75rem;margin-bottom:.5rem}
.he-expired-title{font-size:1.15rem;font-weight:800;color:#1E3A5F;margin-bottom:.4rem}
.he-expired-sub{font-size:.8rem;color:#7A6E64;max-width:22rem;margin:0 auto .75rem;line-height:1.5}
@media(max-width:400px){.he-form-row-2{grid-template-columns:1fr}.he-dates-sel{flex-direction:column}.he-dep-box{grid-template-columns:1fr}}
`;

// ─── Component ──────────────────────────────────────────
interface HostelEngineProps { locale?: string; }

export function HostelEngine({ locale = 'pt' }: HostelEngineProps) {
  const initLang: Lang = locale==='es'?'es':locale==='en'?'en':'pt';
  const [lang, setLang] = useState<Lang>(initLang);
  const t = T[lang];
  const TODAY = useRef((() => { const d=new Date(); d.setHours(0,0,0,0); return d; })());

  // Wizard state
  const [step, setStep] = useState(1);
  const [calMonth, setCalMonth] = useState(() => new Date(TODAY.current.getFullYear(), TODAY.current.getMonth(), 1));
  const [checkIn, setCheckIn] = useState<Date|null>(null);
  const [checkOut, setCheckOut] = useState<Date|null>(null);
  const [hoverDate, setHoverDate] = useState<Date|null>(null);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [beds, setBeds] = useState<Record<string,number>>({cuarto1:0,cuarto3:0,cuarto4:0,cuarto5:0,cuarto6:0});
  const [revealed, setRevealed] = useState({cuarto3:false,cuarto5:false});
  const [rooms, setRooms] = useState<RoomDef[]>(DEFAULT_ROOMS);
  const [toast, setToast] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('pix');
  const [phase, setPhase] = useState<Phase>('wizard');
  const [bookingCode, setBookingCode] = useState('');
  const [timerSecs, setTimerSecs] = useState(300);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Guest form
  const [form, setForm] = useState<FormState>({name:'',email:'',email2:'',phone:'',country:'BR',doc:'',arrival:'',requests:''});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [docFeedback, setDocFeedback] = useState('');
  const [emailFb, setEmailFb] = useState('');
  const [phoneFb, setPhoneFb] = useState('');

  // Fetch real rooms when dates are set
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    const ci = checkIn.toISOString().slice(0,10);
    const co = checkOut.toISOString().slice(0,10);
    availabilityAPI.check({ checkIn: ci, checkOut: co, beds: 1 }).then(res => {
      const apiRooms: any[] = res.data?.rooms || [];
      if (!apiRooms.length) return;
      setRooms(DEFAULT_ROOMS.map(dr => {
        const match = apiRooms.find((ar: any) =>
          ar.name?.toLowerCase()===dr.name.toLowerCase() ||
          (ar.name||'').replace(/\D/g,'')===dr.id.replace(/\D/g,'')
        );
        if (!match) return dr;
        return { ...dr, realId: match.roomId, available: match.availableBeds ?? dr.available, price: match.basePrice || dr.price };
      }));
    }).catch(() => { /* fallback to defaults */ });
  }, [checkIn, checkOut]);

  // Price calc
  const price = calcPrice(checkIn, checkOut, beds);
  const totalBeds = Object.values(beds).reduce((s,n)=>s+n,0);
  const season = getSeason(checkIn || TODAY.current);

  // Visible rooms (progressive reveal)
  const visibleRooms = rooms.filter(r => {
    if (r.id==='cuarto3') return revealed.cuarto3;
    if (r.id==='cuarto5') return revealed.cuarto5;
    return true;
  });

  // ─ Calendar helpers ─
  const calCells = (() => {
    const m = calMonth;
    const firstDay = new Date(m.getFullYear(), m.getMonth(), 1).getDay();
    const daysInMonth = new Date(m.getFullYear(), m.getMonth()+1, 0).getDate();
    const cells: Array<{ day: number; date: Date; isEmpty?: boolean } | { isEmpty: true }> = [];
    for (let i=0;i<firstDay;i++) cells.push({ isEmpty: true } as any);
    for (let d=1;d<=daysInMonth;d++) {
      cells.push({ day:d, date: new Date(m.getFullYear(),m.getMonth(),d), isEmpty:false });
    }
    return cells;
  })();

  const handleCalClick = useCallback((date: Date) => {
    if (!checkIn || (checkIn&&checkOut) || dayBefore(date,checkIn) || sameDay(date,checkIn)) {
      setCheckIn(date); setCheckOut(null); setSelectingEnd(true);
    } else {
      setCheckOut(date); setSelectingEnd(false); setHoverDate(null);
    }
  }, [checkIn, checkOut]);

  // ─ Beds / reveal ─
  const changeBeds = useCallback((id: string, delta: number) => {
    setRevealed(prev => {
      const r1 = rooms.find(r=>r.id==='cuarto1');
      const r4 = rooms.find(r=>r.id==='cuarto4');
      const newRev = { ...prev };
      setBeds(prevBeds => {
        const cur = prevBeds[id] ?? 0;
        const room = rooms.find(r=>r.id===id)!;
        let next = { ...prevBeds };
        if (delta>0) {
          if (cur < room.available) { next[id] = cur+1; }
          else if (id==='cuarto1' && !newRev.cuarto3) { newRev.cuarto3=true; }
          else if (id==='cuarto4' && !newRev.cuarto5) { newRev.cuarto5=true; }
        } else {
          next[id] = Math.max(0, cur-1);
        }
        // Progressive down: collapse when primary drops below max
        if ((next['cuarto1']??0) < (r1?.available??12)) { newRev.cuarto3=false; next['cuarto3']=0; }
        if ((next['cuarto4']??0) < (r4?.available??7))  { newRev.cuarto5=false; next['cuarto5']=0; }
        if (id==='cuarto5' && delta<0 && next['cuarto5']===0) newRev.cuarto5=false;
        return next;
      });
      return newRev;
    });
  }, [rooms]);

  // ─ Toast ─
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  // ─ Navigation ─
  const goNext = useCallback(() => {
    if (step===1) {
      if (!checkIn) return showToast(t.tToastCheckin);
      if (!checkOut) return showToast(t.tToastCheckout);
      const nights = Math.round((checkOut.getTime()-checkIn.getTime())/86400000);
      const s = getSeason(checkIn);
      if (s.minNights>1&&nights<s.minNights) return showToast(`${s.label}: ${t.tToastMinNights} ${s.minNights} ${t.tToastNights}`);
      setStep(2);
    } else if (step===2) {
      if (totalBeds===0) return showToast(t.tToastBeds);
      setStep(3);
    } else if (step===3) {
      if (!validateForm()) return;
      setStep(4);
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }, [step, checkIn, checkOut, totalBeds, t, showToast]);

  // ─ Form validation ─
  const validateForm = useCallback((): boolean => {
    const isBR = form.country==='BR';
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const email2Ok = emailOk && form.email2===form.email;
    const cpfDigits = form.doc.replace(/\D/g,'');
    const docOk = isBR ? (cpfDigits.length===11&&validateCPF(cpfDigits)) : form.doc.trim().length>4;
    const errs: FormErrors = {};
    if (form.name.trim().length<=2) errs.name=t.errName;
    if (!emailOk) errs.email=t.errEmail;
    if (!email2Ok) errs.email2=t.errEmail2;
    if (form.phone.replace(/\D/g,'').length<10) errs.phone=t.errPhone;
    if (!form.country) errs.country=t.errCountry;
    if (!docOk) errs.doc=isBR?t.errCPF:t.errDocForeign;
    if (!form.arrival) errs.arrival=t.errArrival;
    setFormErrors(errs);
    if (Object.keys(errs).length>0) {
      // scroll to first invalid
      const firstKey = Object.keys(errs)[0];
      const fieldMap: Record<string,string> = {name:'he-f-name',email:'he-f-email',email2:'he-f-email2',phone:'he-f-phone',country:'he-f-country',doc:'he-f-doc',arrival:'he-f-arrival'};
      const el = document.getElementById(fieldMap[firstKey]||'');
      if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>el.focus(),300); }
      return false;
    }
    return true;
  }, [form, t]);

  // ─ Confirm booking ─
  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    setBookingError('');
    try {
      const nameParts = form.name.trim().split(/\s+/);
      const firstName = nameParts[0]||form.name;
      const lastName = nameParts.slice(1).join(' ')||nameParts[0]||form.name;
      const selectedRooms = rooms.filter(r=>(beds[r.id]||0)>0);
      const gender = beds['cuarto6']>0&&totalBeds===beds['cuarto6'] ? 'female' : 'mixed';

      const response = await bookingAPI.create({
        checkIn: checkIn!.toISOString().slice(0,10),
        checkOut: checkOut!.toISOString().slice(0,10),
        rooms: selectedRooms.map(r=>({ roomId: r.realId||r.id, bedsCount: beds[r.id] })),
        guest: { firstName, lastName, email: form.email, phone: form.phone, country: form.country, document: form.doc },
        specialRequests: form.requests,
        arrivalTime: form.arrival,
        language: lang,
        source: 'direct',
        guestGender: gender,
      });
      const code = response.data?.booking?.id || response.data?.bookingId || 'LCH-'+Math.random().toString(36).slice(2,8).toUpperCase();
      setBookingCode(code);
      setPhase('success');
      startTimer();
    } catch (err: any) {
      setBookingError(err?.response?.data?.error || err?.message || t.errorBooking);
    } finally {
      setIsProcessing(false);
    }
  }, [form, beds, rooms, checkIn, checkOut, lang, t, totalBeds]);

  // ─ Timer ─
  const startTimer = useCallback(() => {
    let secs = 300;
    setTimerSecs(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      secs--;
      setTimerSecs(secs);
      if (secs<=0) {
        clearInterval(timerRef.current!);
        setPhase('expired');
      }
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const timerStr = `${Math.floor(timerSecs/60)}:${String(timerSecs%60).padStart(2,'0')}`;

  // ─ Price footer text ─
  const footerPrice = (() => {
    if (price) {
      const disc = price.disc>0?` (${price.disc*100}% desc.)`:'';
      return { main: fmtMoney(price.total), sub: `${price.beds} ${price.beds===1?t.tBed:t.tBeds} · ${price.nights} ${price.nights===1?t.tNight:t.tNights2} · ${price.season.label}${disc}` };
    }
    if (checkIn&&!checkOut) return { main: t.tSelectCheckout, sub: t.tClickCheckout };
    const s=getSeason(TODAY.current);
    return { main: fmtMoney(85*s.mult)+'/'+t.tBed+'/'+t.tNight, sub: `${s.label} ${t.tInProgress}` };
  })();

  // ─ WhatsApp link ─
  const waLink = (() => {
    if (!checkIn||!checkOut||!price) return '#';
    const selR = rooms.filter(r=>(beds[r.id]||0)>0);
    const roomsStr = selR.map(r=>`${r.name}: ${beds[r.id]} ${beds[r.id]>1?t.tBeds:t.tBed}`).join(', ');
    const msg = encodeURIComponent(`Olá! Quero reservar no Lapa Casa Hostel.\nCheck-in: ${fmtDate(checkIn)}\nCheck-out: ${fmtDate(checkOut)}\n${t.tNights}: ${price.nights}\n${t.step2}: ${roomsStr}\nTotal: ${fmtMoney(price.total)}`);
    return `https://wa.me/5521999999999?text=${msg}`;
  })();

  // PIX QR pattern (same as prototype)
  const PIX_PAT = [0,1,1,0,1,0,1,1,0,1,1,1,0,1,0,1,1,0,0,1,1,0,1,0,1,0,1,1,0,1,0,0,1,1,0,1,1,0,0,1,0,1,0,1,0,1,0,1,1];

  // Min nights warning
  const minNightsWarn = (() => {
    if (!checkIn||!checkOut) return null;
    const n = Math.round((checkOut.getTime()-checkIn.getTime())/86400000);
    const s = getSeason(checkIn);
    if (s.minNights>1&&n<s.minNights) return `📅 ${s.label}: ${t.tToastMinNights} ${s.minNights} ${t.tToastNights}`;
    return null;
  })();

  // Summary data
  const summaryDates = (() => {
    if (!checkIn||!checkOut||!price) return [];
    const selR = rooms.filter(r=>(beds[r.id]||0)>0);
    return [
      ['Check-in', fmtDate(checkIn)],
      ['Check-out', fmtDate(checkOut)],
      [t.tNights, String(price.nights)],
      ...selR.map(r=>[r.name, `${beds[r.id]} ${beds[r.id]>1?t.tBeds:t.tBed}`]),
      [t.tTotalBeds, String(price.beds)],
    ];
  })();

  // ─── JSX ────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="he-wrap">
        {/* Header */}
        <div className="he-header">
          <div className="he-brand">Lapa Casa Hostel</div>
          <div className="he-brand-sub">Santa Teresa · Rio de Janeiro</div>
          <div className="he-lang-sw">
            {(['pt','es','en'] as Lang[]).map(l => (
              <button key={l} className={`he-lang-btn${lang===l?' active':''}`} onClick={()=>setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Card */}
        {phase==='wizard' && (
          <div className="he-card">
            {/* Step track */}
            <div className="he-steps">
              {[t.step1,t.step2,t.step3,t.step4].map((lbl,i) => (
                <div key={i} className={`he-step-tab${step===i+1?' active':step>i+1?' done':''}`}>
                  <span className="he-step-num">{i+1}</span>
                  <span className="he-step-lbl">{lbl}</span>
                </div>
              ))}
              <div className="he-step-bar" style={{left:`${(step-1)*25}%`}} />
            </div>

            {toast && <div className="he-toast">{toast}</div>}

            {/* Panel 1: Dates */}
            {step===1 && (
              <div className="he-panel">
                <div className="he-panel-title">{t.p1title}</div>
                <div className="he-panel-sub">{t.p1sub}</div>

                <div className="he-cal-nav">
                  <button className="he-cal-nav-btn" onClick={()=>setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))} aria-label={t.calPrev}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <div className="he-cal-month">{MON_LBL[lang][calMonth.getMonth()]} {calMonth.getFullYear()}</div>
                  <button className="he-cal-nav-btn" onClick={()=>setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))} aria-label={t.calNext}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>

                <div className="he-cal-grid">
                  {DAY_LBL[lang].map(d=><div key={d} className="he-cal-dlbl">{d}</div>)}
                  {calCells.map((cell, i) => {
                    if ((cell as any).isEmpty) return <div key={i} className="he-cal-cell" />;
                    const { date } = cell as any;
                    const isPast = dayBefore(date, TODAY.current) && !sameDay(date, TODAY.current);
                    const isToday = sameDay(date, TODAY.current);
                    const isStart = sameDay(date, checkIn);
                    const isEnd = sameDay(date, checkOut);
                    const refEnd = selectingEnd && hoverDate ? hoverDate : checkOut;
                    const inRng = inRange(date, checkIn, refEnd);
                    const isHover = selectingEnd && sameDay(date, hoverDate);
                    const s = !isPast ? getSeason(date) : null;
                    let cls = 'he-cal-cell';
                    if (isStart) cls += ' in-range range-start';
                    if (isEnd) cls += ' in-range range-end';
                    if (isHover && !isStart) cls += ' in-range range-end';
                    if (inRng) cls += ' in-range';
                    if (isToday) cls += ' is-today';
                    if (s?.label==='Alta Temporada') cls += ' s-alta';
                    else if (s?.label==='Carnaval') cls += ' s-carnaval';
                    else if (s?.label==='Baixa Temporada') cls += ' s-baixa';
                    return (
                      <div key={i} className={cls}>
                        <button
                          className="he-cal-day"
                          disabled={isPast}
                          onClick={()=>!isPast&&handleCalClick(date)}
                          onMouseEnter={()=>selectingEnd&&setHoverDate(date)}
                          onMouseLeave={()=>selectingEnd&&setHoverDate(null)}
                        >
                          {(cell as any).day}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {checkIn && (
                  <div className="he-dates-sel">
                    <div className="he-date-col">
                      <div className="he-date-lbl">{t.checkin}</div>
                      <div className="he-date-val">{fmtDate(checkIn)}</div>
                    </div>
                    <div className="he-nights-c">
                      {checkOut ? `${Math.round((checkOut.getTime()-checkIn.getTime())/86400000)} ${Math.round((checkOut.getTime()-checkIn.getTime())/86400000)===1?t.tNight:t.tNights2}` : ''}
                    </div>
                    <div className="he-date-col" style={{textAlign:'right'}}>
                      <div className="he-date-lbl">{t.checkout}</div>
                      <div className="he-date-val">{checkOut?fmtDate(checkOut):'—'}</div>
                    </div>
                  </div>
                )}
                {minNightsWarn && <div className="he-min-warn">{minNightsWarn}</div>}

                <div className="he-season-info">
                  <span className="he-chip media">{t.seasonMedia}</span>
                  <span className="he-chip alta">{t.seasonAlta}</span>
                  <span className="he-chip carnaval">{t.seasonCarnaval}</span>
                  <span className="he-chip baixa">{t.seasonBaixa}</span>
                </div>
              </div>
            )}

            {/* Panel 2: Rooms */}
            {step===2 && (
              <div className="he-panel">
                <div className="he-panel-title">{t.p2title}</div>
                <div className="he-panel-sub">{t.p2sub}</div>
                <div className="he-rooms">
                  {visibleRooms.map(r => {
                    const cnt = beds[r.id]||0;
                    const pbn = (r.price*season.mult).toFixed(2).replace('.',',');
                    const plusDisabled = r.id==='cuarto1' ? (cnt>=r.available&&revealed.cuarto3) :
                                         r.id==='cuarto4' ? (cnt>=r.available&&revealed.cuarto5) :
                                         cnt>=r.available;
                    return (
                      <div key={r.id} className={`he-room${cnt>0?' has-beds':''}`}>
                        <div className={`he-stripe ${r.type==='female'?'he-stripe-female':'he-stripe-mixed'}`} />
                        <div className="he-ri">
                          <div className="he-rn">{r.name}</div>
                          <div className="he-rm">
                            <span className={`he-rbadge ${r.type==='female'?'he-rbadge-f':'he-rbadge-m'}`}>
                              {r.id==='cuarto6'?'Solo Mujeres':r.type==='female'?'Feminino':'Misto'}
                            </span>
                            <span className="he-ravail">{r.available} de {r.capacity} disp.</span>
                          </div>
                          <div className="he-rprice">R$ <strong>{pbn}</strong>/cama/noite</div>
                        </div>
                        <div className="he-stepper">
                          <button className="he-sbtn" onClick={()=>changeBeds(r.id,-1)} disabled={cnt===0} aria-label={`-`}>−</button>
                          <span className="he-scnt">{cnt}</span>
                          <button className="he-sbtn" onClick={()=>changeBeds(r.id,1)} disabled={plusDisabled} aria-label={`+`}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(beds['cuarto6']||0)>0 && <div className="he-flex-notice">{t.flexibleNotice}</div>}
                {totalBeds>0 && groupDisc(totalBeds)>0 && (
                  <div className="he-disc-strip">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    {groupDisc(totalBeds)*100}% {t.discountActive} — {totalBeds} {t.tBeds}
                  </div>
                )}
              </div>
            )}

            {/* Panel 3: Guest */}
            {step===3 && (
              <div className="he-panel">
                <div className="he-panel-title">{t.p3title}</div>
                <div className="he-panel-sub">{t.p3sub}</div>

                <div className="he-form-row">
                  <label className="he-label" htmlFor="he-f-name"><span>{t.lblName}</span> <span className="he-req">*</span></label>
                  <input id="he-f-name" className={`he-inp${formErrors.name?' err':form.name.trim().length>2?' ok':''}`} value={form.name} placeholder={t.lblName} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onBlur={()=>setFormErrors(fe=>({...fe,name:form.name.trim().length<=2?t.errName:undefined}))} />
                  {formErrors.name && <div className="he-ferr">{formErrors.name}</div>}
                </div>

                <div className="he-form-row">
                  <label className="he-label" htmlFor="he-f-email"><span>{t.lblEmail}</span> <span className="he-req">*</span></label>
                  <input id="he-f-email" className={`he-inp${formErrors.email?' err':!formErrors.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)?' ok':''}`} type="email" value={form.email} placeholder="seu@email.com" autoComplete="off" onPaste={e=>e.preventDefault()} onChange={e=>setForm(f=>({...f,email:e.target.value}))} onBlur={()=>{const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);setEmailFb(form.email?(ok?'✓ E-mail válido':'✗ E-mail inválido'):'');setFormErrors(fe=>({...fe,email:!ok?t.errEmail:undefined}));}} />
                  {formErrors.email && <div className="he-ferr">{formErrors.email}</div>}
                  {emailFb && <div className={`he-ffb ${emailFb.startsWith('✓')?'ok':'err'}`}>{emailFb}</div>}
                </div>

                <div className="he-form-row">
                  <label className="he-label" htmlFor="he-f-email2"><span>{t.lblEmail2}</span> <span className="he-req">*</span> <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:'.65rem'}}>{t.noPaste}</span></label>
                  <input id="he-f-email2" className={`he-inp${formErrors.email2?' err':form.email2&&form.email2===form.email?' ok':''}`} type="email" value={form.email2} placeholder="seu@email.com" autoComplete="off" onPaste={e=>e.preventDefault()} onCut={e=>e.preventDefault()} onChange={e=>setForm(f=>({...f,email2:e.target.value}))} />
                  {formErrors.email2 && <div className="he-ferr">{formErrors.email2}</div>}
                </div>

                <div className="he-form-row-2">
                  <div>
                    <label className="he-label" htmlFor="he-f-phone"><span>{t.lblPhone}</span> <span className="he-req">*</span></label>
                    <input id="he-f-phone" className={`he-inp${formErrors.phone?' err':!formErrors.phone&&form.phone.replace(/\D/g,'').length>=10?' ok':''}`} type="tel" value={form.phone} placeholder="+55 21 9 9999-9999" inputMode="numeric" maxLength={20} onChange={e=>setForm(f=>({...f,phone:formatPhone(e.target.value)}))} onBlur={()=>{const ok=form.phone.replace(/\D/g,'').length>=10;setPhoneFb(form.phone?(ok?'✓ Telefone válido':'✗ Mínimo 10 dígitos'):'');setFormErrors(fe=>({...fe,phone:!ok?t.errPhone:undefined}));}} />
                    {formErrors.phone && <div className="he-ferr">{formErrors.phone}</div>}
                    {phoneFb && <div className={`he-ffb ${phoneFb.startsWith('✓')?'ok':'err'}`}>{phoneFb}</div>}
                  </div>
                  <div>
                    <label className="he-label" htmlFor="he-f-country"><span>{t.lblCountry}</span> <span className="he-req">*</span></label>
                    <select id="he-f-country" className={`he-inp he-sel${formErrors.country?' err':form.country?' ok':''}`} value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value,doc:''}))}>
                      <option value="">{t.selectPlaceholder}</option>
                      <option value="BR">Brasil</option>
                      <option value="AR">Argentina</option>
                      <option value="CO">Colombia</option>
                      <option value="CL">Chile</option>
                      <option value="US">Estados Unidos</option>
                      <option value="DE">Alemanha / Germany</option>
                      <option value="FR">França / France</option>
                      <option value="GB">Reino Unido / UK</option>
                      <option value="PT">Portugal</option>
                      <option value="ES">España / Espanha</option>
                      <option value="IT">Italia / Itália</option>
                      <option value="OTHER">{t.optOther}</option>
                    </select>
                    {formErrors.country && <div className="he-ferr">{formErrors.country}</div>}
                  </div>
                </div>

                <div className="he-form-row-2">
                  <div>
                    <label className="he-label" htmlFor="he-f-doc">
                      <span>{form.country==='BR'?t.lblCPF:t.lblPassport}</span> <span className="he-req">*</span>
                    </label>
                    <input id="he-f-doc" className={`he-inp${formErrors.doc?' err':docFeedback.startsWith('✓')?' ok':''}`} value={form.doc} placeholder={form.country==='BR'?t.phCPF:t.phPassport} maxLength={form.country==='BR'?14:30} onChange={e=>{
                      const v=e.target.value;
                      if(form.country==='BR'&&!/[a-zA-Z]/.test(v)) setForm(f=>({...f,doc:formatCPF(v)}));
                      else setForm(f=>({...f,doc:v}));
                    }} onBlur={()=>{
                      const isBR=form.country==='BR';
                      const digits=form.doc.replace(/\D/g,'');
                      if(isBR){const ok=digits.length===11&&validateCPF(digits);setDocFeedback(digits.length===11?(ok?t.fbCPFok:t.fbCPFerr):'');setFormErrors(fe=>({...fe,doc:!ok?t.errCPF:undefined}));}
                      else{const ok=form.doc.trim().length>4;setDocFeedback(ok?t.fbDocOk:'');setFormErrors(fe=>({...fe,doc:!ok?t.errDocForeign:undefined}));}
                    }} />
                    {formErrors.doc && <div className="he-ferr">{formErrors.doc}</div>}
                    {docFeedback && <div className={`he-ffb ${docFeedback.startsWith('✓')?'ok':'err'}`}>{docFeedback}</div>}
                  </div>
                  <div>
                    <label className="he-label" htmlFor="he-f-arrival"><span>{t.lblArrival}</span> <span className="he-req">*</span></label>
                    <select id="he-f-arrival" className={`he-inp he-sel${formErrors.arrival?' err':form.arrival?' ok':''}`} value={form.arrival} onChange={e=>setForm(f=>({...f,arrival:e.target.value}))}>
                      <option value="">{t.arrivalPlaceholder}</option>
                      {['14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(h=><option key={h}>{h}</option>)}
                    </select>
                    {formErrors.arrival && <div className="he-ferr">{formErrors.arrival}</div>}
                  </div>
                </div>

                <div className="he-form-row">
                  <label className="he-label" htmlFor="he-f-req"><span>{t.lblRequests}</span> <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>{t.optional}</span></label>
                  <textarea id="he-f-req" className="he-inp he-textarea" value={form.requests} placeholder="..." onChange={e=>setForm(f=>({...f,requests:e.target.value}))} />
                </div>

                <div className="he-rules">
                  <div className="he-rules-title">{t.rulesTitle}</div>
                  {[t.rule1,t.rule2,t.rule3,t.rule4,t.rule5].map((r,i)=>(
                    <div key={i} className="he-rule"><span>{'🔑🚪📄🔞🚭'[i]}</span><span>{r}</span></div>
                  ))}
                </div>

                <div className="he-cancel">
                  <button className="he-cancel-btn" type="button" onClick={()=>setCancelOpen(o=>!o)}>
                    <span>{t.cancelBtn}</span>
                    <span className={`he-chevron${cancelOpen?' open':''}`}>▼</span>
                  </button>
                  {cancelOpen && (
                    <div className="he-cancel-body">
                      <div className="he-cancel-row"><span className="he-cbadge he-cbadge-g">{t.cancelFree}</span><span>{t.cancelFreeText}</span></div>
                      <div className="he-cancel-row"><span className="he-cbadge he-cbadge-r">{t.cancelNo}</span><span>{t.cancelNoText}</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Panel 4: Summary */}
            {step===4 && price && (
              <div className="he-panel">
                <div className="he-panel-title">{t.p4title}</div>
                <div className="he-panel-sub">{t.p4sub}</div>

                <div className="he-sum-sec">
                  <div className="he-sum-head">{t.sumDatesHead}</div>
                  <div className="he-sum-rows">
                    {summaryDates.map(([k,v],i)=>(
                      <div key={i} className="he-sum-row"><span>{k}</span><span>{v}</span></div>
                    ))}
                  </div>
                </div>

                <div className="he-sum-sec">
                  <div className="he-sum-head">{t.sumPriceHead}</div>
                  <div className="he-sum-rows">
                    <div className="he-sum-row"><span>R$ 85/{t.tBed} × {price.season.mult}x ({price.season.label})</span><span>{fmtMoney(price.pbn)}/{t.tBed}/nt</span></div>
                    <div className="he-sum-row"><span>Subtotal ({price.beds} {t.tBeds} × {price.nights} {t.tNights2})</span><span>{fmtMoney(price.subtotal)}</span></div>
                    {price.disc>0 && <div className="he-sum-row disc"><span>{t.tGroupDisc} ({price.disc*100}%)</span><span>− {fmtMoney(price.discAmt)}</span></div>}
                    <div className="he-sum-row total"><span>{t.tTotal}</span><span>{fmtMoney(price.total)}</span></div>
                  </div>
                </div>

                <div className="he-dep-box">
                  <div className="he-dep-half">
                    <div className="he-dep-lbl">{t.tDepositNow}</div>
                    <div className="he-dep-amt">{fmtMoney(price.deposit)}</div>
                    <div className="he-dep-note">30%</div>
                  </div>
                  <div className="he-dep-half">
                    <div className="he-dep-lbl">70% {t.tAtCheckin}</div>
                    <div className="he-dep-amt">{fmtMoney(price.total-price.deposit)}</div>
                    <div className="he-dep-note">Check-in</div>
                  </div>
                </div>

                <div className="he-sum-sec">
                  <div className="he-sum-head">{t.sumGuestHead}</div>
                  <div className="he-sum-rows">
                    <div className="he-sum-row"><span>{t.lblName}</span><span>{form.name}</span></div>
                    <div className="he-sum-row"><span>{t.lblEmail}</span><span>{form.email}</span></div>
                    <div className="he-sum-row"><span>{t.lblPhone}</span><span>{form.phone}</span></div>
                    <div className="he-sum-row"><span>{t.tCountryLabel}</span><span>{form.country}</span></div>
                    <div className="he-sum-row"><span>{t.lblArrival}</span><span>{form.arrival}</span></div>
                  </div>
                </div>

                <div className="he-ota">
                  🏷️ {t.otaDirect} <strong>{fmtMoney(price.total*0.15)}</strong> {t.otaVs}
                </div>

                <div className="he-pay-methods">
                  {(['pix','card'] as PayMethod[]).map(m=>(
                    <button key={m} type="button" className={`he-pay-m${payMethod===m?' selected':''}`} onClick={()=>setPayMethod(m)}>
                      <input type="radio" name="he-pay" value={m} checked={payMethod===m} readOnly style={{flexShrink:0,accentColor:'#1E3A5F'}} />
                      <div className="he-pm-info">
                        <div className="he-pm-name">{m==='pix'?t.pmPix:t.pmCard}</div>
                        <div className="he-pm-detail">{fmtMoney(price.deposit)} · {fmtMoney(price.total-price.deposit)} {t.tAtCheckin}</div>
                      </div>
                      {m==='pix' && <span className="he-pm-instant">{t.pmPixApproval}</span>}
                    </button>
                  ))}
                </div>

                {bookingError && <div className="he-toast" style={{margin:'0 0 .75rem'}}>{bookingError}</div>}

                <button className="he-btn-confirm" onClick={handleConfirm} disabled={isProcessing}>
                  {isProcessing ? '...' : t.btnConfirm}
                </button>
                <button className="he-btn-wa" onClick={()=>window.open(waLink,'_blank')}>
                  {t.btnWhatsApp}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="he-foot">
              <div>
                <div className="he-price-main">{footerPrice.main}</div>
                <div className="he-price-sub">{footerPrice.sub}</div>
              </div>
              <div className="he-foot-btns">
                {step>1 && <button className="he-btn-back" onClick={()=>setStep(s=>Math.max(1,s-1))}>{t.btnBack}</button>}
                {step<4 && <button className="he-btn-next" onClick={goNext}>{t.btnNext}</button>}
              </div>
            </div>
          </div>
        )}

        {/* Success panel */}
        {phase==='success' && (
          <div className="he-card">
            <div className="he-success-panel">
              <div className="he-success-check">✓</div>
              <div className="he-success-title">{t.successTitle}</div>
              <div className="he-success-sub">{t.successSub}</div>
              <div className="he-booking-code">{bookingCode}</div>
              <div className="he-pay-box">
                {payMethod==='pix' ? (
                  <>
                    <div className="he-pix-lbl">{t.pixDepLabel}</div>
                    <div className="he-pix-qr">
                      <div style={{display:'grid',gridTemplateColumns:'repeat(7,8px)',gridTemplateRows:'repeat(7,8px)',gap:'1px'}}>
                        {PIX_PAT.map((b,i)=><div key={i} style={{background:b?'#fff':'transparent',width:'8px',height:'8px'}} />)}
                      </div>
                    </div>
                    <div className="he-pix-amt">{price?fmtMoney(price.deposit):''}</div>
                    <div className="he-timer">{t.timerLabel}: <strong>{timerStr}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="he-pix-lbl">{t.cardDepLabel}</div>
                    <div style={{fontSize:'2.25rem',margin:'.4rem 0'}}>💳</div>
                    <div className="he-pix-amt">{price?fmtMoney(price.deposit):''}</div>
                    <div style={{fontSize:'.72rem',color:'#7A6E64',marginTop:'.2rem'}}>{t.cardInstruction}</div>
                    <div className="he-timer">{t.timerLabel}: <strong>{timerStr}</strong></div>
                  </>
                )}
              </div>
              <div className="he-success-note">
                {payMethod==='pix' && <>{t.pixKey}<br/></>}{t.restNote}
              </div>
              <button className="he-btn-confirm" style={{marginTop:'1.25rem',background:'#1E3A5F'}} onClick={()=>window.location.reload()}>
                {t.btnNewBooking}
              </button>
            </div>
          </div>
        )}

        {/* Expired panel */}
        {phase==='expired' && (
          <div className="he-card">
            <div className="he-expired-panel">
              <div className="he-expired-icon">⏰</div>
              <div className="he-expired-title">{t.expiredTitle}</div>
              <div className="he-expired-sub">{t.expiredSub}</div>
              <button className="he-btn-confirm" onClick={()=>window.location.reload()}>{t.btnTryAgain}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
