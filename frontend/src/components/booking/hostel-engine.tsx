'use client';
// frontend/src/components/booking/hostel-engine.tsx
// Orquestador slim — estado global, API, navegación, Step 4, éxito, expirado, CSS, footer.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, CreditCard, Clock, Tag, Zap, MessageCircle, AlertTriangle, KeyRound, DoorOpen, FileText, Ban, CigaretteOff } from 'lucide-react';
import { bookingAPI, availabilityAPI } from '@/lib/api';
import { useCurrency, convertBRL } from '@/hooks/use-currency';
import {
  Lang, Phase, PayMethod, RoomDef, FormState, FormErrors,
  T, DEFAULT_ROOMS,
} from './hostel-engine.types';
import {
  getSeason, calcPrice, validateCPF, fmtDate, fmtMoney,
} from './hostel-engine.utils';
import { HostelCalendar }      from './hostel-calendar';
import { HostelRoomSelector }  from './hostel-room-selector';
import { HostelGuestForm }     from './hostel-guest-form';

// ─── CSS global del motor ────────────────────────────────
const CSS = `
.he-wrap{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:url('/img/adoquines.png') center/cover;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:0 1rem 3rem}
.he-header{background:url('/img/arcos-lapa.png') center/cover;color:#fff;padding:1.5rem 1.5rem 1.25rem;text-align:center;width:100%;max-width:500px;margin-bottom:1.5rem;border-radius:0 0 14px 14px;position:relative;overflow:hidden}
.he-header::before{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.18),rgba(0,0,0,.32));z-index:0;pointer-events:none}
.he-brand-loc{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:.65rem;position:relative;z-index:1;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.he-brand{font-family:var(--font-cormorant),Georgia,serif;font-size:clamp(2.4rem,6vw,3.8rem);font-weight:600;letter-spacing:.01em;line-height:1.0;margin-bottom:0;position:relative;z-index:1;text-transform:none;text-shadow:0 2px 12px rgba(0,0,0,.8)}
.he-brand span{font-family:var(--font-cormorant),Georgia,serif;font-weight:300;font-style:italic;text-transform:none;color:#C8870A;display:block;font-size:.62em;letter-spacing:.06em;margin-top:.12em;opacity:.95}
.he-lang-sw{display:flex;gap:.3rem;margin-top:.45rem;justify-content:center;position:relative;z-index:1}
.he-lang-btn{font-size:.6rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:.18em .5em;border-radius:4px;border:1.5px solid rgba(255,255,255,.25);background:transparent;color:rgba(255,255,255,.95);cursor:pointer;transition:all .12s}
.he-lang-btn.active{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.6)}
.he-card{background:rgba(14,24,16,.88);border-radius:14px;box-shadow:0 2px 4px rgba(0,0,0,.25),0 8px 32px rgba(0,0,0,.45);width:100%;max-width:500px;overflow:hidden;backdrop-filter:blur(6px)}
.he-steps{display:flex;align-items:flex-start;padding:1rem 1.25rem;background:#1A2E1E;gap:0}
.he-step-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0}
.he-step-item.active .he-step-lbl{color:#fff}
.he-step-item.done .he-step-lbl{color:rgba(255,255,255,.85)}
.he-step-conn{flex:1;height:2px;background:rgba(255,255,255,.45);margin-top:14px;transition:background .35s}
.he-step-conn.done{background:#C8870A}
.he-step-badge{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.65);background:rgba(255,255,255,.1);color:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;transition:all .35s}
.he-step-badge.active{background:#C8870A;border-color:#C8870A;color:#fff}
.he-step-badge.done{border-color:rgba(255,255,255,.8);color:#fff;background:rgba(255,255,255,.18)}
.he-step-lbl{font-size:.75rem;font-weight:500;letter-spacing:.03em;color:rgba(255,255,255,.95);text-align:center;white-space:nowrap;transition:color .35s}
.he-toast{margin:.75rem 1.5rem 0;padding:.55rem .85rem;background:rgba(200,50,50,.18);border:1px solid rgba(252,165,165,.4);border-radius:8px;font-size:.75rem;color:#FCA5A5}
.he-panel{padding:1.5rem 1.5rem 1rem}
.he-panel-title{font-size:1rem;font-weight:700;color:#F0EDE0;margin-bottom:.2rem}
.he-panel-sub{font-size:.78rem;color:rgba(255,255,255,.95);margin-bottom:1.25rem}
.he-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.he-cal-month{font-size:.9rem;font-weight:700;color:#F0EDE0;text-transform:capitalize}
.he-cal-nav-btn{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.95);cursor:pointer;background:none;border:none;transition:background .15s,color .15s}
.he-cal-nav-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.he-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.he-cal-dlbl{font-size:.62rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.95);text-align:center;padding:.3rem 0 .5rem}
.he-cal-cell{text-align:center;padding:.1rem 0;position:relative}
.he-cal-day{width:34px;height:34px;border-radius:50%;margin:auto;display:flex;align-items:center;justify-content:center;font-size:.78rem;color:#F0EDE0;position:relative;z-index:1;cursor:pointer;background:none;border:none;font-family:inherit;transition:background .12s,color .12s}
.he-cal-day:hover:not(:disabled){background:rgba(255,255,255,.14);color:#fff}
.he-cal-day:disabled{color:rgba(255,255,255,.22);cursor:not-allowed}
.he-cal-cell.in-range::before{content:'';position:absolute;inset:0;background:rgba(255,255,255,.09);top:50%;transform:translateY(-50%);height:34px;z-index:0}
.he-cal-cell.range-start::before{left:50%}.he-cal-cell.range-end::before{right:50%}
.he-cal-cell.range-start.range-end::before{display:none}
.he-cal-cell.range-start .he-cal-day,.he-cal-cell.range-end .he-cal-day{background:#2A5234;color:#fff}
.he-cal-cell.is-today .he-cal-day{border:1.5px solid #C8870A;color:#C8870A}
.he-cal-cell.is-today.in-range .he-cal-day{color:#2A5234}
.he-cal-cell.s-alta .he-cal-day:not(:disabled){color:#B45309}
.he-cal-cell.s-carnaval .he-cal-day:not(:disabled){color:#9333EA}
.he-cal-cell.s-baixa .he-cal-day:not(:disabled){color:#1D4ED8}
.he-cal-cell.s-alta::after,.he-cal-cell.s-carnaval::after,.he-cal-cell.s-baixa::after{content:'';position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%}
.he-cal-cell.s-alta::after{background:#F59E0B}.he-cal-cell.s-carnaval::after{background:#A855F7}.he-cal-cell.s-baixa::after{background:#60A5FA}
.he-dates-sel{display:flex;gap:1rem;margin-top:1rem;padding:.75rem 1rem;background:rgba(255,255,255,.07);border-radius:8px;border:1px solid rgba(255,255,255,.15)}
.he-date-col{flex:1}.he-date-lbl{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.95);margin-bottom:.15rem}
.he-date-val{font-size:.88rem;font-weight:700;color:#7BC47F}
.he-nights-c{text-align:center;font-size:.72rem;color:#C8870A;font-weight:700;align-self:center;white-space:nowrap}
.he-min-warn{background:rgba(200,100,40,.15);border:1px solid rgba(226,155,114,.35);border-radius:8px;padding:.55rem .85rem;font-size:.75rem;color:#E29B72;margin-top:.6rem}
.he-season-info{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.85rem;padding-top:.85rem;border-top:1px solid rgba(255,255,255,.12)}
.he-chip{font-size:.68rem;padding:.2em .55em;border-radius:4px;font-weight:600}
.he-chip.media{background:#EBF4EC;color:#1D6B34}.he-chip.alta{background:#FEF3E2;color:#B45309}
.he-chip.carnaval{background:#FEE2E2;color:#B91C1C}.he-chip.baixa{background:#EFF6FF;color:#1D4ED8}
.he-rooms{display:flex;flex-direction:column;gap:.65rem}
.he-room{border:1.5px solid rgba(255,255,255,.15);border-radius:12px;padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;transition:border-color .15s}
.he-room.has-beds{border-color:#C8870A}
.he-stripe{width:3px;border-radius:2px;align-self:stretch;flex-shrink:0}
.he-stripe-mixed{background:#4A90D9}.he-stripe-female{background:#E87AA8}
.he-ri{flex:1;min-width:0}
.he-rn{font-size:.85rem;font-weight:700;color:#F0EDE0}
.he-rm{display:flex;gap:.5rem;align-items:center;margin-top:.15rem;flex-wrap:wrap}
.he-rbadge{font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:.15em .5em;border-radius:4px}
.he-rbadge-m{background:rgba(29,78,216,.3);color:#93C5FD}.he-rbadge-f{background:rgba(157,23,77,.3);color:#F9A8D4}
.he-ravail{font-size:.68rem;color:rgba(255,255,255,.95)}
.he-rprice{font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.2rem}
.he-rprice strong{color:#F0EDE0;font-size:.82rem}
.he-stepper{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
.he-sbtn{width:28px;height:28px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#F0EDE0;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.he-sbtn:hover:not(:disabled){border-color:#2A5234;background:#2A5234;color:#fff}
.he-sbtn:disabled{color:rgba(255,255,255,.2);cursor:not-allowed}
.he-scnt{font-size:.95rem;font-weight:700;min-width:1.25rem;text-align:center;color:#F0EDE0}
.he-flex-notice{background:rgba(42,82,52,.25);border:1px solid rgba(123,196,127,.25);border-radius:8px;padding:.6rem .8rem;font-size:.72rem;color:#A7DFB8;margin-top:.5rem}
.he-disc-strip{display:flex;align-items:center;gap:.5rem;padding:.55rem .8rem;background:rgba(42,82,52,.4);border:1px solid rgba(167,223,184,.25);border-radius:8px;font-size:.73rem;color:#A7DFB8;font-weight:600;margin-top:.75rem}
.he-form-row{margin-bottom:.85rem}
.he-form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.85rem}
.he-label{display:block;font-size:.83rem;font-weight:600;color:rgba(255,255,255,.95);margin-bottom:.3rem}
.he-req{color:#C8870A}
.he-inp{width:100%;border:1.5px solid rgba(255,255,255,.15);border-radius:8px;padding:.6rem .85rem;background:rgba(255,255,255,.07);color:#F0EDE0;font-size:.95rem;transition:border-color .15s;font-family:inherit}
.he-inp:focus{border-color:#7BC47F;outline:none}
.he-inp.err{border-color:#F87171}.he-inp.ok{border-color:#4ADE80}
.he-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235A5E50' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}
.he-textarea{resize:vertical;min-height:64px}
.he-ferr{font-size:.68rem;color:#C0393B;margin-top:.25rem}
.he-ffb{font-size:.68rem;margin-top:.2rem}
.he-ffb.ok{color:#1D8A55}.he-ffb.err{color:#C0393B}
.he-rules{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:.75rem .9rem;margin-bottom:.85rem;background:rgba(255,255,255,.05)}
.he-rules-title{font-size:.83rem;font-weight:600;color:rgba(255,255,255,.70);margin-bottom:.45rem;display:flex;align-items:center;gap:.4rem}
.he-rule{font-size:.75rem;color:#F0EDE0;display:flex;align-items:center;gap:.5rem;padding:.25rem 0}
.he-cancel{border:1px solid rgba(255,255,255,.12);border-radius:12px;overflow:hidden;margin-bottom:.85rem}
.he-cancel-btn{width:100%;display:flex;align-items:center;justify-content:space-between;padding:.65rem .9rem;font-size:.83rem;font-weight:600;color:#F0EDE0;background:rgba(255,255,255,.05);text-align:left;cursor:pointer;border:none;font-family:inherit}
.he-cancel-btn:hover{background:rgba(255,255,255,.10)}
.he-chevron{color:rgba(255,255,255,.95);transition:transform .2s;display:flex}
.he-chevron.open{transform:rotate(180deg)}
.he-cancel-body{border-top:1px solid rgba(255,255,255,.10);padding:.65rem .9rem}
.he-cancel-row{display:flex;gap:.6rem;align-items:flex-start;font-size:.75rem;color:#F0EDE0;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.08)}
.he-cancel-row:last-child{border-bottom:none}
.he-cbadge{font-size:.62rem;font-weight:700;padding:.15em .55em;border-radius:4px;white-space:nowrap;flex-shrink:0;margin-top:.1rem}
.he-cbadge-g{background:#D5E8D4;color:#1E5E40}.he-cbadge-r{background:#FEE2E2;color:#991B1B}
.he-sum-sec{border:1px solid rgba(255,255,255,.12);border-radius:12px;overflow:hidden;margin-bottom:.75rem}
.he-sum-head{background:rgba(255,255,255,.08);padding:.5rem .9rem;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:rgba(255,255,255,.95)}
.he-sum-rows{padding:.5rem .9rem}
.he-sum-row{display:flex;justify-content:space-between;align-items:baseline;padding:.4rem 0;font-size:.82rem;border-bottom:1px solid rgba(255,255,255,.08);color:#F0EDE0}
.he-sum-row:last-child{border-bottom:none}
.he-sum-row.total{font-weight:700;font-size:.9rem;color:#7BC47F;border-top:2px solid rgba(255,255,255,.12);padding-top:.55rem;margin-top:.1rem}
.he-sum-row.disc{color:#4ADE80}
.he-dep-box{background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14);border-radius:12px;padding:.85rem 1rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem}
.he-dep-half{text-align:center}
.he-dep-lbl{font-size:.62rem;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.95);margin-bottom:.2rem}
.he-dep-amt{font-size:1.05rem;font-weight:800;color:#7BC47F}
.he-dep-note{font-size:.65rem;color:rgba(255,255,255,.95);margin-top:.1rem}
.he-ota{background:rgba(42,82,52,.3);border:1px solid rgba(123,196,127,.25);border-radius:8px;padding:.6rem .85rem;font-size:.75rem;color:#A7DFB8;margin-bottom:.85rem;display:flex;align-items:center;gap:.45rem}
.he-pay-methods{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.85rem}
.he-pay-m{display:flex;align-items:center;gap:.75rem;border:1.5px solid rgba(255,255,255,.15);border-radius:12px;padding:.65rem .9rem;cursor:pointer;transition:border-color .15s;background:rgba(255,255,255,.06);width:100%;text-align:left;font-family:inherit}
.he-pay-m.selected{border-color:#7BC47F}
.he-pm-info{flex:1;min-width:0}
.he-pm-name{font-size:.82rem;font-weight:700;color:#F0EDE0;display:flex;align-items:center;gap:.35rem}
.he-pm-detail{font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.1rem}
.he-pm-instant{font-size:.62rem;font-weight:700;padding:.15em .5em;border-radius:4px;background:#D5E8D4;color:#1E5E40;white-space:nowrap;flex-shrink:0}
.he-btn-confirm{padding:.75rem 1.5rem;border-radius:8px;font-size:1.05rem;font-weight:700;background:#2A5234;color:#fff;width:100%;display:block;text-align:center;letter-spacing:.02em;cursor:pointer;border:none;font-family:inherit;transition:background .15s}
.he-btn-confirm:hover:not(:disabled){background:#3A6844}
.he-btn-confirm:disabled{background:#5A5E50;cursor:not-allowed}
.he-btn-wa{display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;text-align:center;padding:.65rem;border-radius:8px;font-size:.85rem;font-weight:600;color:#fff;background:#25D366;text-decoration:none;margin-top:.5rem;transition:background .12s;cursor:pointer;border:none;font-family:inherit}
.he-btn-wa:hover{background:#1DAE55}
.he-foot{padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.10);display:flex;align-items:center;gap:1rem;background:rgba(0,0,0,.28)}
.he-price-main{font-size:.95rem;font-weight:800;color:#7BC47F;font-variant-numeric:tabular-nums}
.he-price-sub{font-size:.68rem;color:rgba(255,255,255,.95)}
.he-conv{font-size:.65rem;color:rgba(255,255,255,.60);font-weight:500;margin-top:.1rem;font-variant-numeric:tabular-nums}
.he-conv-inline{font-size:.72rem;color:rgba(255,255,255,.55);font-weight:400;margin-left:.35rem;font-variant-numeric:tabular-nums}
.he-direct-banner{display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.55rem .85rem;background:rgba(42,82,52,.35);border-bottom:1px solid rgba(123,196,127,.2);font-size:.72rem;font-weight:600;color:#A7DFB8;letter-spacing:.02em;text-align:center}
.he-foot-btns{display:flex;gap:.5rem;flex-shrink:0;margin-left:auto}
.he-btn-back{padding:.55rem 1rem;border-radius:8px;font-size:.85rem;font-weight:600;color:rgba(255,255,255,.70);border:1.5px solid rgba(255,255,255,.20);background:rgba(255,255,255,.06);cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s}
.he-btn-back:hover{border-color:#7BC47F;color:#7BC47F}
.he-btn-next{padding:.55rem 1.25rem;border-radius:8px;font-size:.85rem;font-weight:700;background:#2A5234;color:#fff;cursor:pointer;border:none;font-family:inherit;transition:background .15s}
.he-btn-next:hover:not(:disabled){background:#3A6844}
.he-btn-next:disabled{background:#5A5E50;cursor:not-allowed}
.he-success-panel{padding:2rem 1.5rem;text-align:center}
.he-success-check{width:56px;height:56px;border-radius:50%;background:rgba(42,82,52,.4);border:2px solid rgba(167,223,184,.5);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem}
.he-success-title{font-family:var(--font-cormorant),Georgia,serif;font-size:1.15rem;font-weight:600;color:#7BC47F;margin-bottom:.3rem}
.he-success-sub{font-size:.8rem;color:rgba(255,255,255,.95);margin-bottom:1.25rem}
.he-booking-code{font-family:ui-monospace,'Cascadia Code',monospace;font-size:1.1rem;font-weight:700;letter-spacing:.12em;color:#A7DFB8;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;padding:.6rem 1.25rem;display:inline-block;margin-bottom:1.25rem}
.he-pay-box{border:1.5px solid rgba(255,255,255,.15);border-radius:12px;padding:1rem;display:inline-flex;flex-direction:column;align-items:center;gap:.5rem}
.he-pix-qr{width:96px;height:96px;background:#0D1C12;border-radius:4px;display:flex;align-items:center;justify-content:center}
.he-pix-lbl{font-size:.68rem;color:rgba(255,255,255,.95);letter-spacing:.06em;text-transform:uppercase}
.he-pix-amt{font-size:.95rem;font-weight:800;color:#7BC47F}
.he-timer{font-size:.8rem;color:rgba(255,255,255,.95);margin-top:.25rem}
.he-timer strong{color:#7BC47F;font-weight:800}
.he-success-note{font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.75rem;line-height:1.5}
.he-expired-panel{padding:2.5rem 1rem;text-align:center}
.he-expired-icon{display:flex;justify-content:center;margin-bottom:.5rem}
.he-expired-title{font-size:1.15rem;font-weight:700;color:#F0EDE0;margin-bottom:.4rem}
.he-expired-sub{font-size:.8rem;color:rgba(255,255,255,.95);max-width:22rem;margin:0 auto .75rem;line-height:1.5}
.he-info-box{background:#FBE9DB;border:1.5px solid #E29B72;border-radius:12px;padding:1rem 1.25rem;width:100%;max-width:500px;margin-bottom:1rem;box-sizing:border-box}
.he-info-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3D1005;margin-bottom:.75rem;display:flex;align-items:center;gap:.4rem}
.he-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:.55rem .9rem}
.he-info-item{display:flex;align-items:flex-start;gap:.45rem;font-size:.78rem;color:#3D1005;line-height:1.45}
.he-info-item svg{flex-shrink:0;margin-top:.12rem;color:#7A2E0A}
.he-info-item strong{font-weight:700;color:#1E0800}
@media(max-width:400px){.he-form-row-2{grid-template-columns:1fr}.he-dates-sel{flex-direction:column}.he-dep-box{grid-template-columns:1fr}.he-info-grid{grid-template-columns:1fr}}
`;

// ─── Reglas de info (con JSX bold) por idioma ────────────
const INFO_RULES: Record<string, Array<{ Icon: React.ElementType; text: React.ReactNode }>> = {
  pt: [
    { Icon: KeyRound,     text: <>Check-in (entrada): <strong>14h às 22h</strong> — para chegar antes, reserve também o dia anterior</> },
    { Icon: DoorOpen,     text: <>Check-out (saída): até as <strong>12h</strong> — para sair mais tarde, reserve um dia a mais</> },
    { Icon: FileText,     text: <>O envio da foto do documento é <strong>obrigatório</strong>, sem exceção</> },
    { Icon: CigaretteOff, text: <>Proibido fumar no hostel e nas áreas comuns</> },
    { Icon: Ban,          text: <>Somente para <strong>maiores de 18 anos</strong></> },
  ],
  es: [
    { Icon: KeyRound,     text: <>Check-in (entrada): <strong>14h a 22h</strong> — para llegar antes, reservá también el día anterior</> },
    { Icon: DoorOpen,     text: <>Check-out (salida): hasta las <strong>12h</strong> — para salir más tarde, mejor reservá un día más</> },
    { Icon: FileText,     text: <>El envío de la foto del documento es <strong>obligatorio</strong>, sin excepción</> },
    { Icon: CigaretteOff, text: <>Prohibido fumar en el hostel y en las áreas comunes</> },
    { Icon: Ban,          text: <>Solo para <strong>mayores de 18 años</strong></> },
  ],
  en: [
    { Icon: KeyRound,     text: <>Check-in: <strong>2 pm to 10 pm</strong> — arriving earlier? Book the previous night</> },
    { Icon: DoorOpen,     text: <>Check-out: by <strong>12 pm</strong> — need more time? Book one extra night</> },
    { Icon: FileText,     text: <>Sending a photo of your ID is <strong>mandatory</strong>, no exceptions</> },
    { Icon: CigaretteOff, text: <>Smoking in the hostel and common areas is prohibited</> },
    { Icon: Ban,          text: <>Guests must be <strong>18 or older</strong></> },
  ],
};
const INFO_TITLE: Record<string, string> = {
  pt: 'INFORMAÇÃO IMPORTANTE',
  es: 'INFORMACIÓN IMPORTANTE',
  en: 'IMPORTANT INFORMATION',
};

// ─── PIX QR pattern (igual que el prototipo) ──────────────
const PIX_PAT = [0,1,1,0,1,0,1,1,0,1,1,1,0,1,0,1,1,0,0,1,1,0,1,0,1,0,1,1,0,1,0,0,1,1,0,1,1,0,0,1,0,1,0,1,0,1,0,1,1];

// ─── Props ────────────────────────────────────────────────
interface HostelEngineProps { locale?: string; }

// ─── Component ────────────────────────────────────────────
export function HostelEngine({ locale = 'pt' }: HostelEngineProps) {
  const initLang: Lang = (['pt','es','en','fr','de','it'] as Lang[]).includes(locale as Lang) ? locale as Lang : 'pt';
  const [lang, setLang]       = useState<Lang>(initLang);
  const t = T[lang];
  const currency = useCurrency();
  const TODAY = useRef((() => { const d = new Date(); d.setHours(0,0,0,0); return d; })());

  // ─ Estado del wizard ─
  const [step, setStep]               = useState(1);
  const [calMonth, setCalMonth]       = useState(() => new Date(TODAY.current.getFullYear(), TODAY.current.getMonth(), 1));
  const [checkIn, setCheckIn]         = useState<Date | null>(null);
  const [checkOut, setCheckOut]       = useState<Date | null>(null);
  const [hoverDate, setHoverDate]     = useState<Date | null>(null);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [beds, setBeds]               = useState<Record<string, number>>({ cuarto1:0, cuarto3:0, cuarto4:0, cuarto5:0, cuarto6:0 });
  const [revealed, setRevealed]       = useState({ cuarto3: false, cuarto5: false });
  const [rooms, setRooms]             = useState<RoomDef[]>(DEFAULT_ROOMS);
  const [toast, setToast]             = useState('');
  const [cancelOpen, setCancelOpen]   = useState(false);
  const [payMethod, setPayMethod]     = useState<PayMethod>('pix');
  const [phase, setPhase]             = useState<Phase>('wizard');
  const [bookingCode, setBookingCode] = useState('');
  const [timerSecs, setTimerSecs]     = useState(300);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─ Estado del formulario ─
  const [form, setForm]               = useState<FormState>({ name:'', email:'', email2:'', phone:'', country:'BR', doc:'', arrival:'', requests:'' });
  const [formErrors, setFormErrors]   = useState<FormErrors>({});
  const [docFeedback, setDocFeedback] = useState('');
  const [emailFb, setEmailFb]         = useState('');
  const [phoneFb, setPhoneFb]         = useState('');

  // ─ Fetch cuartos reales cuando hay fechas ─
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    const ci = checkIn.toISOString().slice(0, 10);
    const co = checkOut.toISOString().slice(0, 10);
    availabilityAPI.check({ checkIn: ci, checkOut: co, beds: 1 }).then(res => {
      const apiRooms: any[] = res.data?.rooms || [];
      if (!apiRooms.length) return;
      setRooms(DEFAULT_ROOMS.map(dr => {
        const match = apiRooms.find((ar: any) =>
          ar.name?.toLowerCase() === dr.name.toLowerCase() ||
          (ar.name || '').replace(/\D/g, '') === dr.id.replace(/\D/g, '')
        );
        if (!match) return dr;
        return { ...dr, realId: match.roomId, available: match.availableBeds ?? dr.available, price: match.basePrice || dr.price };
      }));
    }).catch(() => { /* fallback a defaults */ });
  }, [checkIn, checkOut]);

  // ─ Valores derivados ─
  const price      = calcPrice(checkIn, checkOut, beds);
  const totalBeds  = Object.values(beds).reduce((s, n) => s + n, 0);
  const season     = getSeason(checkIn ?? TODAY.current);

  // Cuartos visibles (reveal progresivo)
  const visibleRooms = rooms.filter(r => {
    if (r.id === 'cuarto3') return revealed.cuarto3;
    if (r.id === 'cuarto5') return revealed.cuarto5;
    return true;
  });

  // ─ Calendario ─
  const handleCalClick = useCallback((date: Date) => {
    if (!checkIn || (checkIn && checkOut) || date < checkIn) {
      setCheckIn(date); setCheckOut(null); setSelectingEnd(true);
    } else {
      setCheckOut(date); setSelectingEnd(false); setHoverDate(null);
    }
  }, [checkIn, checkOut]);

  const handleMonthChange = useCallback((delta: number) => {
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }, []);

  // ─ Camas / reveal ─
  const changeBeds = useCallback((id: string, delta: number) => {
    setRevealed(prev => {
      const r1 = rooms.find(r => r.id === 'cuarto1');
      const r4 = rooms.find(r => r.id === 'cuarto4');
      const newRev = { ...prev };
      setBeds(prevBeds => {
        const cur  = prevBeds[id] ?? 0;
        const room = rooms.find(r => r.id === id)!;
        const next = { ...prevBeds };
        if (delta > 0) {
          if (cur < room.available) { next[id] = cur + 1; }
          else if (id === 'cuarto1' && !newRev.cuarto3) { newRev.cuarto3 = true; }
          else if (id === 'cuarto4' && !newRev.cuarto5) { newRev.cuarto5 = true; }
        } else {
          next[id] = Math.max(0, cur - 1);
        }
        // Collapse progresivo: si el cuarto principal baja del máximo
        if ((next['cuarto1'] ?? 0) < (r1?.available ?? 12)) { newRev.cuarto3 = false; next['cuarto3'] = 0; }
        if ((next['cuarto4'] ?? 0) < (r4?.available ?? 7))  { newRev.cuarto5 = false; next['cuarto5'] = 0; }
        if (id === 'cuarto5' && delta < 0 && (next['cuarto5'] ?? 0) === 0) newRev.cuarto5 = false;
        return next;
      });
      return newRev;
    });
  }, [rooms]);

  // ─ Scroll suave al tope de la card (step tracker) ─
  const scrollToCard = useCallback(() => {
    // Pequeño delay para que React renderice el nuevo step antes de animar
    setTimeout(() => {
      const el = document.querySelector('.he-steps') as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, []);

  // ─ Toast ─
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  // ─ Formulario ─
  const handleFormChange = useCallback((patch: Partial<FormState>) => {
    setForm(f => ({ ...f, ...patch }));
  }, []);

  const handleFormErrors = useCallback((patch: Partial<FormErrors>) => {
    setFormErrors(fe => ({ ...fe, ...patch }));
  }, []);

  // ─ Validación completa (Step 3 → Step 4) ─
  const validateForm = useCallback((): boolean => {
    const isBR    = form.country === 'BR';
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const email2Ok = emailOk && form.email2 === form.email;
    const digits   = form.doc.replace(/\D/g, '');
    const docOk    = isBR ? (digits.length === 11 && validateCPF(digits)) : form.doc.trim().length > 4;

    const errs: FormErrors = {};
    if (form.name.trim().length <= 2)                  errs.name    = t.errName;
    if (!emailOk)                                      errs.email   = t.errEmail;
    if (!email2Ok)                                     errs.email2  = t.errEmail2;
    if (form.phone.replace(/\D/g, '').length < 10)     errs.phone   = t.errPhone;
    if (!form.country)                                 errs.country = t.errCountry;
    if (!docOk)                                        errs.doc     = isBR ? t.errCPF : t.errDocForeign;
    if (!form.arrival)                                 errs.arrival = t.errArrival;

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0] ?? '';
      const fieldMap: Record<string, string> = {
        name:'he-f-name', email:'he-f-email', email2:'he-f-email2',
        phone:'he-f-phone', country:'he-f-country', doc:'he-f-doc', arrival:'he-f-arrival',
      };
      const el = document.getElementById(fieldMap[firstKey] ?? '');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => el.focus(), 350);
        }, 60);
      }
      return false;
    }
    return true;
  }, [form, t]);

  // ─ Navegación ─
  const goNext = useCallback(() => {
    if (step === 1) {
      if (!checkIn)  { showToast(t.tToastCheckin);  scrollToCard(); return; }
      if (!checkOut) { showToast(t.tToastCheckout); scrollToCard(); return; }
      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
      const s = getSeason(checkIn);
      if (s.minNights > 1 && nights < s.minNights) {
        showToast(`${s.label}: ${t.tToastMinNights} ${s.minNights} ${t.tToastNights}`);
        scrollToCard();
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (totalBeds === 0) { showToast(t.tToastBeds); scrollToCard(); return; }
      setStep(3);
    } else if (step === 3) {
      if (!validateForm()) return; // validateForm ya hace scroll al primer campo con error
      setStep(4);
    }
    // Al avanzar: scroll suave al indicador de pasos, sin ir al tope de la página
    scrollToCard();
  }, [step, checkIn, checkOut, totalBeds, t, showToast, validateForm, scrollToCard]);

  // ─ Confirmar reserva ─
  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    setBookingError('');
    try {
      const nameParts  = form.name.trim().split(/\s+/);
      const firstName  = nameParts[0] ?? form.name;
      const lastName   = nameParts.slice(1).join(' ') || firstName;
      const selectedRooms = rooms.filter(r => (beds[r.id] ?? 0) > 0);
      const c6    = beds['cuarto6'] ?? 0;
      const gender = c6 > 0 && totalBeds === c6 ? 'female' : 'mixed';

      const response = await bookingAPI.create({
        checkIn:  checkIn!.toISOString().slice(0, 10),
        checkOut: checkOut!.toISOString().slice(0, 10),
        rooms: selectedRooms.map(r => ({ roomId: r.realId || r.id, bedsCount: beds[r.id] ?? 0 })),
        guest: { firstName, lastName, email: form.email, phone: form.phone, country: form.country, document: form.doc },
        specialRequests: form.requests,
        arrivalTime: form.arrival,
        language: lang,
        source: 'direct',
        guestGender: gender,
      });
      const code = response.data?.booking?.id || response.data?.bookingId || 'LCH-' + Math.random().toString(36).slice(2,8).toUpperCase();
      setBookingCode(code);
      setPhase('success');
      startTimer();
    } catch (err: any) {
      setBookingError(err?.response?.data?.error || err?.message || t.errorBooking);
    } finally {
      setIsProcessing(false);
    }
  }, [form, beds, rooms, checkIn, checkOut, lang, t, totalBeds]);

  // ─ Timer 5 minutos ─
  const startTimer = useCallback(() => {
    let secs = 300;
    setTimerSecs(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      secs--;
      setTimerSecs(secs);
      if (secs <= 0) { clearInterval(timerRef.current!); setPhase('expired'); }
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  const timerStr = `${Math.floor(timerSecs / 60)}:${String(timerSecs % 60).padStart(2, '0')}`;

  // ─ Precio en footer ─
  const footerPrice = (() => {
    if (price) {
      const disc = price.disc > 0 ? ` (${price.disc * 100}% desc.)` : '';
      return {
        main: fmtMoney(price.total),
        sub:  `${price.beds} ${price.beds === 1 ? t.tBed : t.tBeds} · ${price.nights} ${price.nights === 1 ? t.tNight : t.tNights2} · ${price.season.label}${disc}`,
      };
    }
    if (checkIn && !checkOut) return { main: t.tSelectCheckout, sub: t.tClickCheckout };
    const s = getSeason(TODAY.current);
    return { main: fmtMoney(85 * s.mult) + '/' + t.tBed + '/' + t.tNight, sub: `${s.label} ${t.tInProgress}` };
  })();

  // ─ Link WhatsApp ─
  const waLink = (() => {
    if (!checkIn || !checkOut || !price) return '#';
    const selR     = rooms.filter(r => (beds[r.id] ?? 0) > 0);
    const roomsStr = selR.map(r => {
      const cnt = beds[r.id] ?? 0;
      return `${r.name}: ${cnt} ${cnt > 1 ? t.tBeds : t.tBed}`;
    }).join(', ');
    const msg = encodeURIComponent(`Olá! Quero reservar no Lapa Casa.\n\nCheck-in: ${fmtDate(checkIn)}\nCheck-out: ${fmtDate(checkOut)}\n${price.nights} ${price.nights > 1 ? t.tNights2 : t.tNight} · ${roomsStr}\n\nTotal: ${fmtMoney(price.total)}\n${t.tDepositNow} (30%): ${fmtMoney(price.deposit)}\n70% ${t.tAtCheckin}: ${fmtMoney(price.total - price.deposit)}\n\nAguardo confirmação!`);
    return `https://wa.me/5521999999999?text=${msg}`;
  })();

  // ─ Datos del resumen (Step 4) ─
  const summaryDates = (() => {
    if (!checkIn || !checkOut || !price) return [];
    const selR = rooms.filter(r => (beds[r.id] ?? 0) > 0);
    return [
      ['Check-in',  fmtDate(checkIn)],
      ['Check-out', fmtDate(checkOut)],
      [t.tNights,   String(price.nights)],
      ...selR.map(r => {
        const cnt = beds[r.id] ?? 0;
        return [r.name, `${cnt} ${cnt > 1 ? t.tBeds : t.tBed}`];
      }),
      [t.tTotalBeds, String(price.beds)],
    ];
  })();

  // ─── JSX ────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="he-wrap">

        {/* Volver al home */}
        <div style={{ width: '100%', maxWidth: 500, padding: '.6rem 0 .1rem' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', fontSize: '.75rem', color: 'rgba(255,255,255,.7)', textDecoration: 'none', fontWeight: 600, letterSpacing: '.04em' }}>
            ← Home
          </Link>
        </div>

        {/* Header */}
        <div className="he-header">
          <div className="he-brand-loc">Santa Teresa · Rio de Janeiro</div>
          <div className="he-brand">
            Lapa Casa
            <span>Hostel</span>
          </div>
          <div className="he-lang-sw">
            {(['pt','es','en','fr','de','it'] as Lang[]).map(l => (
              <button key={l} className={`he-lang-btn${lang === l ? ' active' : ''}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Info importante ── */}
        <div className="he-info-box">
          <div className="he-info-title">
            <AlertTriangle size={13} aria-hidden />
            {INFO_TITLE[lang]}
          </div>
          <div className="he-info-grid">
            {(INFO_RULES[lang] ?? []).map(({ Icon, text }, i) => (
              <div key={i} className="he-info-item">
                <Icon size={14} aria-hidden />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel Wizard ── */}
        {phase === 'wizard' && (
          <div className="he-card">

            {/* Step tracker — horizontal badges + connectors */}
            <div className="he-steps">
              {[t.step1, t.step2, t.step3, t.step4].map((lbl, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div className={`he-step-conn${step > i ? ' done' : ''}`} />
                  )}
                  <div className={`he-step-item${step === i+1 ? ' active' : step > i+1 ? ' done' : ''}`}>
                    <div className={`he-step-badge${step === i+1 ? ' active' : step > i+1 ? ' done' : ''}`}>
                      {i+1}
                    </div>
                    <div className="he-step-lbl">{lbl}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Banner precio directo */}
            <div className="he-direct-banner">
              <Tag size={12} aria-hidden />
              {t.directBanner}
            </div>

            {toast && <div className="he-toast">{toast}</div>}

            {/* Step 1 — Calendario */}
            {step === 1 && (
              <HostelCalendar
                lang={lang}
                calMonth={calMonth}
                checkIn={checkIn}
                checkOut={checkOut}
                hoverDate={hoverDate}
                selectingEnd={selectingEnd}
                today={TODAY.current}
                onCalClick={handleCalClick}
                onMonthChange={handleMonthChange}
                onHoverDate={setHoverDate}
              />
            )}

            {/* Step 2 — Cuartos */}
            {step === 2 && (
              <HostelRoomSelector
                lang={lang}
                rooms={visibleRooms}
                beds={beds}
                revealed={revealed}
                season={season}
                totalBeds={totalBeds}
                onChangeBeds={changeBeds}
              />
            )}

            {/* Step 3 — Formulario del huésped */}
            {step === 3 && (
              <HostelGuestForm
                lang={lang}
                form={form}
                formErrors={formErrors}
                docFeedback={docFeedback}
                emailFb={emailFb}
                phoneFb={phoneFb}
                cancelOpen={cancelOpen}
                onFormChange={handleFormChange}
                onFormErrors={handleFormErrors}
                onDocFeedback={setDocFeedback}
                onEmailFb={setEmailFb}
                onPhoneFb={setPhoneFb}
                onCancelToggle={() => setCancelOpen(o => !o)}
              />
            )}

            {/* Step 4 — Resumen */}
            {step === 4 && price && (
              <div className="he-panel">
                <div className="he-panel-title">{t.p4title}</div>
                <div className="he-panel-sub">{t.p4sub}</div>

                <div className="he-sum-sec">
                  <div className="he-sum-head">{t.sumDatesHead}</div>
                  <div className="he-sum-rows">
                    {summaryDates.map(([k, v], i) => (
                      <div key={i} className="he-sum-row"><span>{k}</span><span>{v}</span></div>
                    ))}
                  </div>
                </div>

                <div className="he-sum-sec">
                  <div className="he-sum-head">{t.sumPriceHead}</div>
                  <div className="he-sum-rows">
                    <div className="he-sum-row">
                      <span>R$ 85/{t.tBed} × {price.season.mult}x ({price.season.label})</span>
                      <span>{fmtMoney(price.pbn)}/{t.tBed}/nt</span>
                    </div>
                    <div className="he-sum-row">
                      <span>Subtotal ({price.beds} {t.tBeds} × {price.nights} {t.tNights2})</span>
                      <span>{fmtMoney(price.subtotal)}</span>
                    </div>
                    {price.disc > 0 && (
                      <div className="he-sum-row disc">
                        <span>{t.tGroupDisc} ({price.disc * 100}%)</span>
                        <span>− {fmtMoney(price.discAmt)}</span>
                      </div>
                    )}
                    <div className="he-sum-row total">
                      <span>{t.tTotal}</span>
                      <span>
                        {fmtMoney(price.total)}
                        {currency && <span className="he-conv-inline">{convertBRL(price.total, currency)}</span>}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="he-dep-box">
                  <div className="he-dep-half">
                    <div className="he-dep-lbl">{t.tDepositNow}</div>
                    <div className="he-dep-amt">{fmtMoney(price.deposit)}</div>
                    {currency && <div className="he-conv">{convertBRL(price.deposit, currency)}</div>}
                    <div className="he-dep-note">30%</div>
                  </div>
                  <div className="he-dep-half">
                    <div className="he-dep-lbl">70% {t.tAtCheckin}</div>
                    <div className="he-dep-amt">{fmtMoney(price.total - price.deposit)}</div>
                    {currency && <div className="he-conv">{convertBRL(price.total - price.deposit, currency)}</div>}
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
                  <Tag size={14} aria-hidden />
                  <span>{t.otaDirect} <strong>{fmtMoney(price.total * 0.15)}</strong> {t.otaVs}</span>
                </div>

                <div className="he-pay-methods">
                  {(['pix', 'card'] as PayMethod[]).map(m => (
                    <button key={m} type="button" className={`he-pay-m${payMethod === m ? ' selected' : ''}`} onClick={() => setPayMethod(m)}>
                      <input type="radio" name="he-pay" value={m} checked={payMethod === m} readOnly style={{ flexShrink: 0, accentColor: '#2A5234' }} />
                      <div className="he-pm-info">
                        <div className="he-pm-name">
                          {m === 'pix'
                            ? <><Zap size={13} aria-hidden />{t.pmPix}</>
                            : <><CreditCard size={13} aria-hidden />{t.pmCard}</>
                          }
                        </div>
                        <div className="he-pm-detail">{fmtMoney(price.deposit)} · {fmtMoney(price.total - price.deposit)} {t.tAtCheckin}</div>
                      </div>
                      {m === 'pix' && <span className="he-pm-instant">{t.pmPixApproval}</span>}
                    </button>
                  ))}
                </div>

                {bookingError && <div className="he-toast" style={{ margin: '0 0 .75rem' }}>{bookingError}</div>}

                <button className="he-btn-confirm" onClick={handleConfirm} disabled={isProcessing}>
                  {isProcessing ? '...' : t.btnConfirm}
                </button>
                <button className="he-btn-wa" onClick={() => window.open(waLink, '_blank')}>
                  <MessageCircle size={16} aria-hidden />
                  {t.btnWhatsApp}
                </button>
              </div>
            )}

            {/* Footer con precio y navegación */}
            <div className="he-foot">
              <div>
                <div className="he-price-main">{footerPrice.main}</div>
                <div className="he-price-sub">{footerPrice.sub}</div>
                {currency && price && <div className="he-conv">{convertBRL(price.total, currency)}</div>}
              </div>
              <div className="he-foot-btns">
                {step > 1 && <button className="he-btn-back" onClick={() => setStep(s => Math.max(1, s - 1))}>{t.btnBack}</button>}
                {step < 4 && <button className="he-btn-next" onClick={goNext}>{t.btnNext}</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── Panel Éxito ── */}
        {phase === 'success' && (
          <div className="he-card">
            <div className="he-success-panel">
              <div className="he-success-check">
                <CheckCircle2 size={28} color="#1E5E40" aria-hidden />
              </div>
              <div className="he-success-title">{t.successTitle}</div>
              <div className="he-success-sub">{t.successSub}</div>
              <div className="he-booking-code">{bookingCode}</div>
              <div className="he-pay-box">
                {payMethod === 'pix' ? (
                  <>
                    <div className="he-pix-lbl">{t.pixDepLabel}</div>
                    <div className="he-pix-qr">
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,8px)', gridTemplateRows:'repeat(7,8px)', gap:'1px' }}>
                        {PIX_PAT.map((b, i) => <div key={i} style={{ background: b ? '#fff' : 'transparent', width:'8px', height:'8px' }} />)}
                      </div>
                    </div>
                    <div className="he-pix-amt">{price ? fmtMoney(price.deposit) : ''}</div>
                    <div className="he-timer">{t.timerLabel}: <strong>{timerStr}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="he-pix-lbl">{t.cardDepLabel}</div>
                    <div style={{ margin:'.4rem 0', display:'flex', justifyContent:'center' }}>
                      <CreditCard size={40} color="#2A5234" aria-hidden />
                    </div>
                    <div className="he-pix-amt">{price ? fmtMoney(price.deposit) : ''}</div>
                    <div style={{ fontSize:'.72rem', color:'#5A5E50', marginTop:'.2rem' }}>{t.cardInstruction}</div>
                    <div className="he-timer">{t.timerLabel}: <strong>{timerStr}</strong></div>
                  </>
                )}
              </div>
              <div className="he-success-note">
                {payMethod === 'pix' && <>{t.pixKey}<br /></>}{t.restNote}
              </div>
              <button className="he-btn-confirm" style={{ marginTop:'1.25rem' }} onClick={() => window.location.reload()}>
                {t.btnNewBooking}
              </button>
            </div>
          </div>
        )}

        {/* ── Panel Expirado ── */}
        {phase === 'expired' && (
          <div className="he-card">
            <div className="he-expired-panel">
              <div className="he-expired-icon">
                <Clock size={44} color="#C8870A" aria-hidden />
              </div>
              <div className="he-expired-title">{t.expiredTitle}</div>
              <div className="he-expired-sub">{t.expiredSub}</div>
              <button className="he-btn-confirm" onClick={() => window.location.reload()}>{t.btnTryAgain}</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
