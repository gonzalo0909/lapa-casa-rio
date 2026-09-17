// frontend/src/components/booking/hostel-engine.styles.ts
// CSS global del motor de reservas (hostel-engine y sus sub-componentes).
// Se inyecta como <style> crudo en hostel-engine.tsx (dangerouslySetInnerHTML);
// el aislamiento del resto del sitio es por convención de nombres (todo
// selector empieza con ".he-"), no por CSS Module.
//
// TOKENS DEL DESIGN-SYSTEM (auditoría sección 3):
//   MIGRADO:    hsl(var(--primary-foreground)) → hsl(var(--primary-foreground))  [crema sobre verde oscuro]
//   TODO:       #1A2E1E, #2A5234, #35673F, #3A6844, #33623E, #3E7448
//               → verde hostel (sin equivalente exacto en --primary global)
//   TODO:       #C8870A → dorado/ámbar hostel (--accent global es rosa 307°, incompatible)
//   TODO:       #7BC47F, #A7DFB8, #4ADE80 → verdes claros/éxito
//   TODO:       #FCA5A5, #F87171, #C0393B → rojos error/alerta
//   TODO:       #1D8A55 → verde feedback OK
//   TODO:       #93C5FD, #4A90D9 → azules (camas mixtas / badge mixto)
//   TODO:       #F9A8D4, #E87AA8 → rosas (camas femeninas)
//   TODO:       #B45309, #F59E0B → ámbar temporada alta
//   TODO:       #9333EA, #A855F7 → púrpura temporada carnaval
//   TODO:       #1D4ED8, #60A5FA → azul temporada baixa
//   TODO:       #25D366, #1DAE55 → verde WhatsApp (color de marca externo)
//   TODO:       #635BFF, #7B74FF → índigo Stripe (color de marca externo)
//   TODO:       #FBE9DB, #E29B72, #3D1005, #7A2E0A, #1E0800 → paleta info-box cálida
//   TODO:       #D5E8D4, #1E5E40 → verde badge cancelación OK
//   TODO:       #FEE2E2, #991B1B → rojo badge cancelación
//   TODO:       #4A5248, #5A5E50 → grises deshabilitados

export const HOSTEL_ENGINE_CSS = `
.he-wrap{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:url('/img/adoquines.png') center/cover;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:0 1rem 3rem}
.he-header{background:url('/img/arcos-lapa.png') center/cover;color:#fff;padding:1.5rem 1.5rem 1.25rem;text-align:center;width:100%;max-width:500px;margin-bottom:1.5rem;border-radius:0 0 18px 18px;position:relative;overflow:hidden}
.he-header::before{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.18),rgba(0,0,0,.32));z-index:0;pointer-events:none}
.he-brand-loc{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:.65rem;position:relative;z-index:1;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.he-brand{font-family:var(--font-cormorant),Georgia,serif;font-size:clamp(2.4rem,6vw,3.8rem);font-weight:600;letter-spacing:.01em;line-height:1.0;margin-bottom:0;position:relative;z-index:1;text-transform:none;text-shadow:0 2px 12px rgba(0,0,0,.8)}
.he-brand span{font-family:var(--font-cormorant),Georgia,serif;font-weight:300;font-style:italic;text-transform:none;color:#C8870A;display:block;font-size:.62em;letter-spacing:.06em;margin-top:.12em;opacity:.95}
.he-lang-sw{display:flex;gap:.3rem;margin-top:.45rem;justify-content:center;position:relative;z-index:1}
.he-lang-btn{font-size:.6rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:.18em .5em;border-radius:4px;border:1.5px solid rgba(255,255,255,.25);background:transparent;color:rgba(255,255,255,.95);cursor:pointer;transition:all .2s ease}
.he-lang-btn.active{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.6)}
@keyframes he-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.he-card{position:relative;z-index:51;background:rgba(14,24,16,.90);border-radius:16px;box-shadow:0 2px 4px rgba(0,0,0,.2),0 8px 24px rgba(0,0,0,.38),0 28px 72px rgba(0,0,0,.28);width:100%;max-width:500px;overflow:hidden;backdrop-filter:blur(9px);animation:he-rise .32s ease-out}
.he-steps{display:flex;align-items:flex-start;padding:1rem 1.25rem;background:#1A2E1E;gap:0}
.he-step-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0}
.he-step-item.active .he-step-lbl{color:#fff}
.he-step-item.done .he-step-lbl{color:rgba(255,255,255,.85)}
.he-step-conn{flex:1;height:2px;background:rgba(255,255,255,.3);margin-top:14px;transition:background .4s ease}
.he-step-conn.done{background:#C8870A}
.he-step-badge{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.08);color:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;transition:all .4s ease}
.he-step-badge.active{background:#C8870A;border-color:#C8870A;color:#fff;box-shadow:0 0 0 4px rgba(200,135,10,.22)}
.he-step-badge.done{border-color:rgba(255,255,255,.7);color:#fff;background:rgba(255,255,255,.15)}
.he-step-lbl{font-size:.75rem;font-weight:500;letter-spacing:.03em;color:rgba(255,255,255,.95);text-align:center;white-space:nowrap;transition:color .35s}
.he-toast{margin:.75rem 1.5rem 0;padding:.55rem .85rem;background:rgba(200,50,50,.18);border:1px solid rgba(252,165,165,.4);border-radius:8px;font-size:.75rem;color:#FCA5A5}
.he-panel{padding:1.75rem 1.5rem 1.1rem}
.he-panel-title{font-size:1rem;font-weight:700;color:hsl(var(--primary-foreground));margin-bottom:.2rem}
.he-panel-sub{font-size:.78rem;color:rgba(255,255,255,.95);margin-bottom:1.25rem}
.he-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.he-cal-month{font-size:.9rem;font-weight:700;color:hsl(var(--primary-foreground));text-transform:capitalize}
.he-cal-nav-btn{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.95);cursor:pointer;background:none;border:none;transition:background .2s ease,color .2s ease}
.he-cal-nav-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.he-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.he-cal-dlbl{font-size:.62rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.95);text-align:center;padding:.3rem 0 .5rem}
.he-cal-cell{text-align:center;padding:.1rem 0;position:relative}
.he-cal-day{width:34px;height:34px;border-radius:50%;margin:auto;display:flex;align-items:center;justify-content:center;font-size:.78rem;color:hsl(var(--primary-foreground));position:relative;z-index:1;cursor:pointer;background:none;border:none;font-family:inherit;transition:background .18s ease,color .18s ease}
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
.he-chip{font-size:.68rem;padding:.25em .65em;border-radius:6px;font-weight:600}
.he-chip.media{background:#EBF4EC;color:#1D6B34}.he-chip.alta{background:#FEF3E2;color:#B45309}
.he-chip.carnaval{background:#FEE2E2;color:#B91C1C}.he-chip.baixa{background:#EFF6FF;color:#1D4ED8}
.he-rooms{display:flex;flex-direction:column;gap:.65rem}
.he-room{border:1.5px solid rgba(255,255,255,.14);border-radius:12px;padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;transition:border-color .22s ease,background .22s ease,box-shadow .22s ease}
.he-room.has-beds{border-color:#C8870A;background:rgba(200,135,10,.04);box-shadow:0 0 0 1px rgba(200,135,10,.15)}
.he-stripe{width:3px;border-radius:2px;align-self:stretch;flex-shrink:0}
.he-stripe-mixed{background:#4A90D9}.he-stripe-female{background:#E87AA8}
.he-ri{flex:1;min-width:0}
.he-rn{font-size:.85rem;font-weight:700;color:hsl(var(--primary-foreground))}
.he-rm{display:flex;gap:.5rem;align-items:center;margin-top:.15rem;flex-wrap:wrap}
.he-rbadge{font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:.15em .5em;border-radius:4px}
.he-rbadge-m{background:rgba(29,78,216,.3);color:#93C5FD}.he-rbadge-f{background:rgba(157,23,77,.3);color:#F9A8D4}
.he-ravail{font-size:.68rem;color:rgba(255,255,255,.95)}
.he-rprice{font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.2rem}
.he-rprice strong{color:hsl(var(--primary-foreground));font-size:.82rem}
.he-stepper{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
.he-sbtn{width:28px;height:28px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:hsl(var(--primary-foreground));display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;transition:background .2s ease,border-color .2s ease,color .2s ease,transform .15s ease}
.he-sbtn:hover:not(:disabled){border-color:#2A5234;background:#2A5234;color:#fff;transform:scale(1.1)}
.he-sbtn:disabled{color:rgba(255,255,255,.2);cursor:not-allowed}
.he-scnt{font-size:.95rem;font-weight:700;min-width:1.25rem;text-align:center;color:hsl(var(--primary-foreground))}
.he-flex-notice{background:rgba(42,82,52,.25);border:1px solid rgba(123,196,127,.25);border-radius:8px;padding:.6rem .8rem;font-size:.72rem;color:#A7DFB8;margin-top:.5rem}
.he-disc-strip{display:flex;align-items:center;gap:.5rem;padding:.55rem .8rem;background:rgba(42,82,52,.4);border:1px solid rgba(167,223,184,.25);border-radius:8px;font-size:.73rem;color:#A7DFB8;font-weight:600;margin-top:.75rem}
.he-form-row{margin-bottom:.85rem}
.he-form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.85rem}
.he-label{display:block;font-size:.83rem;font-weight:600;color:rgba(255,255,255,.95);margin-bottom:.3rem}
.he-req{color:#C8870A}
.he-inp{width:100%;border:1.5px solid rgba(255,255,255,.17);border-radius:10px;padding:.65rem .9rem;background:rgba(255,255,255,.09);color:hsl(var(--primary-foreground));font-size:.95rem;transition:border-color .2s ease,box-shadow .2s ease;font-family:inherit}
.he-inp:focus{border-color:#7BC47F;outline:none;box-shadow:0 0 0 3px rgba(123,196,127,.13)}
.he-inp.err{border-color:#F87171}.he-inp.ok{border-color:#4ADE80}
.he-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235A5E50' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}
.he-textarea{resize:vertical;min-height:64px}
.he-ferr{font-size:.68rem;color:#C0393B;margin-top:.25rem}
.he-ffb{font-size:.68rem;margin-top:.2rem}
.he-ffb.ok{color:#1D8A55}.he-ffb.err{color:#C0393B}
.he-rules{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:.75rem .9rem;margin-bottom:.85rem;background:rgba(255,255,255,.05)}
.he-rules-title{font-size:.83rem;font-weight:600;color:rgba(255,255,255,.70);margin-bottom:.45rem;display:flex;align-items:center;gap:.4rem}
.he-rule{font-size:.75rem;color:hsl(var(--primary-foreground));display:flex;align-items:center;gap:.5rem;padding:.25rem 0}
.he-cancel{border:1px solid rgba(255,255,255,.12);border-radius:12px;overflow:hidden;margin-bottom:.85rem}
.he-cancel-btn{width:100%;display:flex;align-items:center;justify-content:space-between;padding:.65rem .9rem;font-size:.83rem;font-weight:600;color:hsl(var(--primary-foreground));background:rgba(255,255,255,.05);text-align:left;cursor:pointer;border:none;font-family:inherit}
.he-cancel-btn:hover{background:rgba(255,255,255,.10)}
.he-chevron{color:rgba(255,255,255,.95);transition:transform .2s;display:flex}
.he-chevron.open{transform:rotate(180deg)}
.he-cancel-body{border-top:1px solid rgba(255,255,255,.10);padding:.65rem .9rem}
.he-cancel-row{display:flex;gap:.6rem;align-items:flex-start;font-size:.75rem;color:hsl(var(--primary-foreground));padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.08)}
.he-cancel-row:last-child{border-bottom:none}
.he-cbadge{font-size:.62rem;font-weight:700;padding:.15em .55em;border-radius:4px;white-space:nowrap;flex-shrink:0;margin-top:.1rem}
.he-cbadge-g{background:#D5E8D4;color:#1E5E40}.he-cbadge-r{background:#FEE2E2;color:#991B1B}
.he-sum-sec{border:1px solid rgba(255,255,255,.12);border-radius:12px;overflow:hidden;margin-bottom:.75rem}
.he-sum-head{background:rgba(255,255,255,.08);padding:.5rem .9rem;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:rgba(255,255,255,.95)}
.he-sum-rows{padding:.5rem .9rem}
.he-sum-row{display:flex;justify-content:space-between;align-items:baseline;padding:.4rem 0;font-size:.82rem;border-bottom:1px solid rgba(255,255,255,.08);color:hsl(var(--primary-foreground))}
.he-sum-row:last-child{border-bottom:none}
.he-sum-row.total{font-weight:700;font-size:.9rem;color:#7BC47F;border-top:2px solid rgba(255,255,255,.12);padding-top:.55rem;margin-top:.1rem}
.he-sum-row.disc{color:#4ADE80}
.he-dep-box{background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14);border-radius:12px;padding:.85rem 1rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem}
.he-dep-half{text-align:center}
.he-dep-lbl{font-size:.62rem;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.95);margin-bottom:.2rem}
.he-dep-amt{font-size:1.05rem;font-weight:800;color:#7BC47F}
.he-dep-note{font-size:.65rem;color:rgba(255,255,255,.95);margin-top:.1rem}
.he-pay-methods{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.5rem}
.he-pay-m{display:flex;align-items:center;gap:.75rem;border:1.5px solid rgba(255,255,255,.14);border-radius:12px;padding:.65rem .9rem;cursor:pointer;transition:border-color .22s ease,background .22s ease,box-shadow .22s ease;background:rgba(255,255,255,.06);width:100%;text-align:left;font-family:inherit}
.he-pay-m.selected{border-color:#7BC47F;background:rgba(123,196,127,.06);box-shadow:0 0 0 2px rgba(123,196,127,.12)}
.he-pay-m-disabled{opacity:.45;cursor:not-allowed}
.he-pm-unavail{font-size:.63rem;color:rgba(255,255,255,.58);margin-top:.15rem;font-style:italic}
.he-pm-note{font-size:.68rem;color:rgba(255,255,255,.58);margin-bottom:.85rem;padding:0 .1rem}
.he-pm-info{flex:1;min-width:0}
.he-pm-name{font-size:.82rem;font-weight:700;color:hsl(var(--primary-foreground));display:flex;align-items:center;gap:.35rem}
.he-pm-detail{font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.1rem}
.he-btn-confirm{padding:.78rem 1.5rem;border-radius:10px;font-size:1.05rem;font-weight:700;background:linear-gradient(135deg,#2A5234 0%,#35673F 100%);color:#fff;width:100%;display:block;text-align:center;letter-spacing:.02em;cursor:pointer;border:none;font-family:inherit;transition:background .22s ease,transform .15s ease,box-shadow .22s ease}
.he-btn-confirm:hover:not(:disabled){background:linear-gradient(135deg,#33623E 0%,#3E7448 100%);transform:translateY(-1px);box-shadow:0 6px 20px rgba(42,82,52,.45)}
.he-btn-confirm:active:not(:disabled){transform:translateY(0)}
.he-btn-confirm:disabled{background:#4A5248;cursor:not-allowed}
.he-btn-wa{display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;text-align:center;padding:.65rem;border-radius:10px;font-size:.85rem;font-weight:600;color:#fff;background:#25D366;text-decoration:none;margin-top:.5rem;transition:background .2s ease,transform .15s ease;cursor:pointer;border:none;font-family:inherit}
.he-btn-wa:hover{background:#1DAE55;transform:translateY(-1px)}
.he-foot{padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.10);display:flex;align-items:center;gap:1rem;background:rgba(0,0,0,.28)}
.he-price-main{font-size:.95rem;font-weight:800;color:#7BC47F;font-variant-numeric:tabular-nums}
.he-price-sub{font-size:.68rem;color:rgba(255,255,255,.95)}
.he-conv{font-size:.65rem;color:rgba(255,255,255,.60);font-weight:500;margin-top:.1rem;font-variant-numeric:tabular-nums}
.he-conv-inline{font-size:.72rem;color:rgba(255,255,255,.55);font-weight:400;margin-left:.35rem;font-variant-numeric:tabular-nums}
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
.he-pix-qr-img{width:128px;height:128px;border-radius:6px;border:3px solid #fff;display:block}
.he-pix-copy-btn{font-size:.72rem;font-weight:600;letter-spacing:.04em;padding:.35em .8em;border-radius:6px;border:1.5px solid #7BC47F;background:transparent;color:#7BC47F;cursor:pointer;transition:background .12s,color .12s}
.he-pix-copy-btn:hover{background:#7BC47F;color:#0D1C12}
.he-pix-copy-btn:disabled{opacity:.6;cursor:default}
.he-pix-qr-error{width:180px;padding:.75rem;background:rgba(220,38,38,.12);border:1.5px solid rgba(248,113,113,.5);border-radius:8px;display:flex;flex-direction:column;align-items:center;gap:.5rem;color:#FCA5A5}
.he-pix-qr-error p{font-size:.7rem;line-height:1.3;text-align:center;margin:0;color:rgba(255,255,255,.85)}
.he-pix-key{font-size:.65rem;color:rgba(255,255,255,.55);margin-top:-.1rem}
.he-stripe-link{font-size:.78rem;font-weight:700;padding:.4em 1em;border-radius:8px;background:#635BFF;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:.3rem;transition:background .12s}
.he-stripe-link:hover{background:#7B74FF}
.he-pix-lbl{font-size:.68rem;color:rgba(255,255,255,.95);letter-spacing:.06em;text-transform:uppercase}
.he-pix-amt{font-size:.95rem;font-weight:800;color:#7BC47F}
.he-timer{font-size:.8rem;color:rgba(255,255,255,.95);margin-top:.25rem}
.he-timer strong{color:#7BC47F;font-weight:800}
.he-success-note{font-size:.72rem;color:rgba(255,255,255,.95);margin-top:.75rem;line-height:1.5}
.he-expired-panel{padding:2.5rem 1rem;text-align:center}
.he-expired-icon{display:flex;justify-content:center;margin-bottom:.5rem}
.he-expired-title{font-size:1.15rem;font-weight:700;color:hsl(var(--primary-foreground));margin-bottom:.4rem}
.he-expired-sub{font-size:.8rem;color:rgba(255,255,255,.95);max-width:22rem;margin:0 auto .75rem;line-height:1.5}
.he-info-box{background:#FBE9DB;border:1.5px solid #E29B72;border-radius:12px;padding:1rem 1.25rem;width:100%;max-width:500px;margin-bottom:1rem;box-sizing:border-box}
.he-info-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3D1005;margin-bottom:.75rem;display:flex;align-items:center;gap:.4rem}
.he-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:.55rem .9rem}
.he-info-item{display:flex;align-items:flex-start;gap:.45rem;font-size:.78rem;color:#3D1005;line-height:1.45}
.he-info-item svg{flex-shrink:0;margin-top:.12rem;color:#7A2E0A}
.he-info-item strong{font-weight:700;color:#1E0800}
@media(max-width:400px){.he-form-row-2{grid-template-columns:1fr}.he-dates-sel{flex-direction:column}.he-dep-box{grid-template-columns:1fr}.he-info-grid{grid-template-columns:1fr}}
.he-or-divider{display:flex;align-items:center;gap:.75rem;margin:1rem 0;color:rgba(255,255,255,.58);font-size:.7rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
.he-or-divider::before,.he-or-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.12)}
.he-group-box{border:1.5px solid rgba(255,255,255,.14);border-radius:12px;padding:1rem 1.1rem;background:rgba(255,255,255,.04)}
.he-group-title{font-size:.95rem;font-weight:700;color:hsl(var(--primary-foreground));margin-bottom:.35rem}
.he-group-desc{font-size:.76rem;color:rgba(255,255,255,.7);line-height:1.58;margin-bottom:.75rem}
.he-group-meta{font-size:.73rem;color:rgba(255,255,255,.58);margin-bottom:.8rem}
.he-btn-group{padding:.68rem 1.5rem;border-radius:10px;font-size:.95rem;font-weight:700;background:transparent;color:hsl(var(--primary-foreground));width:100%;display:block;text-align:center;letter-spacing:.02em;cursor:pointer;border:1.5px solid rgba(255,255,255,.22);font-family:inherit;transition:background .2s ease,border-color .2s ease}
.he-btn-group:hover:not(:disabled){background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.42)}
.he-btn-group:disabled{opacity:.48;cursor:not-allowed}
.he-group-err{font-size:.72rem;color:#F87171;margin:.35rem 0;text-align:center}
.he-group-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.16);border-radius:8px;color:hsl(var(--primary-foreground));font-size:.82rem;font-family:inherit;padding:.55rem .75rem;margin-bottom:.55rem;outline:none;transition:border-color .18s ease}
.he-group-input::placeholder{color:rgba(255,255,255,.35)}
.he-group-input:focus{border-color:rgba(255,255,255,.45)}
.he-glink-panel{padding:2rem 1.5rem;text-align:center}
.he-glink-title{font-family:var(--font-cormorant),Georgia,serif;font-size:1.15rem;font-weight:600;color:#7BC47F;margin-bottom:.35rem}
.he-glink-desc{font-size:.8rem;color:rgba(255,255,255,.75);line-height:1.58;margin-bottom:1.25rem}
.he-glink-code{font-family:ui-monospace,'Cascadia Code',monospace;font-size:1rem;font-weight:700;letter-spacing:.1em;color:#A7DFB8;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;padding:.5rem 1rem;display:inline-block;margin-bottom:.85rem}
.he-glink-btns{display:flex;flex-direction:column;gap:.5rem;margin-bottom:.75rem}
.he-glink-wa{display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.62rem 1rem;border-radius:8px;font-size:.9rem;font-weight:600;color:#fff;background:#25D366;text-decoration:none;transition:background .15s}
.he-glink-wa:hover{background:#1DAE55}
.he-glink-meta{font-size:.72rem;color:rgba(255,255,255,.58);line-height:1.55}
`;
