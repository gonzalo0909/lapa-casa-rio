(function(){
  // ====== Config desde <meta>
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || "";
  const API_BASE = (meta("backend-base-url") || "").replace(/\/$/, "");  // p.ej. "/api"
  const STRIPE_PK = meta("stripe-pk") || "";

  // ====== Endpoints (usa /api o lo que pongas en <meta>)
  const endpoint = (p) => (API_BASE ? API_BASE + p : p);
  const MP_PREFERENCE_ENDPOINT  = endpoint("/payments/mp/preference");
  const BOOKINGS_ENDPOINT       = endpoint("/bookings");
  const STRIPE_SESSION_ENDPOINT = endpoint("/payments/stripe/session");
  const HOLDS_START_ENDPOINT    = endpoint("/holds/start");
  const HOLDS_RELEASE_ENDPOINT  = endpoint("/holds/release");
  const HOLDS_CONFIRM_ENDPOINT  = endpoint("/holds/confirm");
  const AVAILABILITY_ENDPOINT   = endpoint("/availability");
  const PAY_STATUS_ENDPOINT     = endpoint("/bookings/status"); // opcional

  // ====== Stripe (lazy)
  let __stripeInst=null; const getStripe=()=>{ if(!window.Stripe) return null; return __stripeInst ||= window.Stripe(STRIPE_PK); };

  // ====== Rooms (precios base)
  const ROOMS = {
    1:{ name:"Cuarto 1 (12 mixto)", cap:12, basePrice:55, femaleOnly:false },
    3:{ name:"Cuarto 3 (12 mixto)", cap:12, basePrice:55, femaleOnly:false },
    5:{ name:"Cuarto 5 (7 mixto)",  cap:7,  basePrice:55, femaleOnly:false },
    6:{ name:"Cuarto 6 (7 femenino)", cap:7, basePrice:60, femaleOnly:true }
  };

  // ====== Shortcuts
  const $ = s=>document.querySelector(s);
  const dateInEl=$('#dateIn'), dateOutEl=$('#dateOut');
  const menEl=$('#men'), womenEl=$('#women');
  const menMinus=$('#menMinus'), menPlus=$('#menPlus');
  const womenMinus=$('#womenMinus'), womenPlus=$('#womenPlus');
  const roomsWrap=$('#rooms'), roomsCard=$('#roomsCard'), formCard=$('#formCard');
  const neededEl=$('#needed'), selCountEl=$('#selCount'), totalPriceEl=$('#totalPrice');
  const continueBtn=$('#continueBtn'), suggestBox=$('#suggestBox'), checkMsg=$('#checkMsg');
  const payStateEl=$('#payState'), submitBtn=$('#submitBtn');
  const simulateOkBtn=$('#simulateOk'), payMPBtn=$('#payMP'), payStripeBtn=$('#payStripe');
  const modsEl=$('#mods'), toastEl=$('#toast');

  let selection={}, currentHoldId=null, paidFinal=false, LANG='es';
  let internalTotal = 0;

  // ====== Fechas (local)
  (function initDates(){
    const toLocalYmd = (d)=>{
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    };
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const tz = toLocalYmd(now), tmr = toLocalYmd(tomorrow);
    if(dateInEl){ dateInEl.min = tz; if(!dateInEl.value) dateInEl.value = tz; }
    if(dateOutEl){ dateOutEl.min = tmr; if(!dateOutEl.value || dateOutEl.value<=dateInEl.value) dateOutEl.value = tmr; }
  })();

  // ====== Helpers
  const toISO=d=>new Date(d+'T00:00:00');
  const diffNights=(a,b)=>{ if(!a||!b) return 0; const ms=toISO(b)-toISO(a); return Math.max(0,Math.round(ms/86400000)); };
  const fmtBRL=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:0, maximumFractionDigits:0});
  const toast=msg=>{ if(!toastEl) return; toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),2200); };
  const clamp=(n,min,max)=>{ n=Number.isFinite(n)?n:0; return Math.max(min, Math.min(max, n)); };

  // ====== i18n
  const I18N={ es:{
    err_dates:"Elegí check-in y check-out.", err_co:"El check-out debe ser posterior al check-in.", err_qty:"Indicá al menos 1 huésped.",
    checking:"Consultando disponibilidad...", updated:"Disponibilidad actualizada", err_avail:"Error consultando disponibilidad.",
    no_beds:"No hay camas disponibles.", avail_of:"Disponibles:", price_bed:"Precio por cama:", nights:"Noches:",
    female_rule:"El cuarto femenino requiere al menos 1 mujer.", select_exact:"Seleccioná exactamente {n} camas.",
    pick_beds:"Seleccioná camas primero.", fill_name_email:"Completá nombre y email.", need_consent:"Debes aceptar la política de privacidad.",
    cant_register:"No se pudo registrar la reserva: ", cant_pref:"No se pudo crear preferencia", pay_mp_err:"Error iniciando pago (MP): ",
    cant_session:"No se pudo crear sesión de Stripe", pay_stripe_err:"Error iniciando pago (Stripe): ",
    approved:"aprobado", need_payment:"Necesitás completar el pago o usar Simular pago aprobado.",
    cant_confirm:"No se pudo confirmar HOLD", confirm_err:"Error confirmando reserva: ", hold_err:"Error creando HOLD: ",
    book_ok:"Reserva registrada. Webhooks actualizarán la hoja a 'paid/approved'.", hold_ok:"Camas reservadas por 10 min (HOLD)",
    tag_weekend:"Fin de semana +10%", tag_high:"Alta (Dic–Feb) +20%", mods:"Modificadores: ",
    title:"Lapa Casa Hostel – Reservas", subtitle:"Elegí fechas y cantidad. Luego seleccioná camas específicas (literas triples).",
    lang_label:"Idioma / Language:", step1:"1) Fechas y cantidad", checkin:"Check-in", checkout:"Check-out",
    men:"Hombres", women:"Mujeres", capacity:"Capacidad total: 38", btn_check:"Ver disponibilidad",
    step2:"2) Elegí tus camas", selected_prefix:"Seleccionadas:", total_prefix:"Total:", btn_continue:"Continuar",
    step3:"3) Datos para confirmar", full_name:"Nombre completo", email:"Email", phone:"Teléfono",
    in_date:"Fecha de entrada", out_date:"Fecha de salida", consent:"Acepto recibir comunicaciones y la política de privacidad.",
    pay_mp_title:"Pagar con Mercado Pago", pay_mp_sub:"Pix / tarjeta / boleto (Brasil)", pay_mp_btn:"Pagar con MP (Sandbox)",
    pay_stripe_title:"Pagar con Stripe", pay_stripe_sub:"Tarjeta internacional / débito", pay_stripe_btn:"Ir a Checkout (Sandbox)",
    test_title:"¿Solo test?", test_sub:"“Simular pago aprobado” habilita Confirmar sin ir a MP/Stripe.", test_btn:"Simular pago aprobado",
    pay_state:"Estado pago:", pending:"pendiente", btn_confirm:"Confirmar reserva"
  }, en:{
    err_dates:"Pick check-in and check-out.", err_co:"Check-out must be after check-in.", err_qty:"Add at least 1 guest.",
    checking:"Checking availability...", updated:"Availability updated", err_avail:"Error fetching availability.",
    no_beds:"No beds available.", avail_of:"Free:", price_bed:"Price per bed:", nights:"Nights:",
    female_rule:"Female room requires at least 1 woman.", select_exact:"Select exactly {n} beds.",
    pick_beds:"Pick beds first.", fill_name_email:"Fill name and email.", need_consent:"You must accept the privacy policy.",
    cant_register:"Could not register booking: ", cant_pref:"Could not create preference", pay_mp_err:"Error starting payment (MP): ",
    cant_session:"Could not create Stripe session", pay_stripe_err:"Error starting payment (Stripe): ",
    approved:"approved", need_payment:"You need to finish payment or use Simulate approved payment.",
    cant_confirm:"Could not confirm HOLD", confirm_err:"Error confirming booking: ", hold_err:"Error creating HOLD: ",
    book_ok:"Booking registered. Webhooks will mark it 'paid/approved'.", hold_ok:"Beds held for 10 min (HOLD)",
    tag_weekend:"Weekend +10%", tag_high:"High season (Dec–Feb) +20%", mods:"Modifiers: ",
    title:"Lapa Casa Hostel – Bookings", subtitle:"Pick dates and party size. Then choose specific beds (triple bunks).",
    lang_label:"Language:", step1:"1) Dates & party size", checkin:"Check-in", checkout:"Check-out",
    men:"Men", women:"Women", capacity:"Total capacity: 38", btn_check:"Check availability",
    step2:"2) Choose your beds", selected_prefix:"Selected:", total_prefix:"Total:", btn_continue:"Continue",
    step3:"3) Details to confirm", full_name:"Full name", email:"Email", phone:"Phone",
    in_date:"Arrival date", out_date:"Departure date", consent:"I accept communications and the privacy policy.",
    pay_mp_title:"Pay with Mercado Pago", pay_mp_sub:"Pix / card / boleto (Brazil)", pay_mp_btn:"Pay with MP (Sandbox)",
    pay_stripe_title:"Pay with Stripe", pay_stripe_sub:"International card / debit", pay_stripe_btn:"Go to Checkout (Sandbox)",
    pay_state:"Payment state:", pending:"pending", btn_confirm:"Confirm booking"
  }};
  function applyI18N(){
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const key = el.getAttribute("data-i18n");
      const txt = I18N[LANG][key];
      if(typeof txt === "string") el.textContent = txt;
    });
  }

  // ====== Modificadores de precio
  function priceModifiers(start,end){
    const tags=new Set(); let weekend=false, highMonth=false;
    const nights=diffNights(start,end); if(!nights) return {factor:1,tags:[]};
    for(let i=0;i<nights;i++){
      const d=new Date(toISO(start)); d.setDate(d.getDate()+i);
      const day=d.getDay(); if([0,5,6].includes(day)) weekend=true;
      const m=d.getMonth(); if([11,0,1].includes(m)) highMonth=true;
    }
    if(weekend) tags.add(I18N[LANG].tag_weekend);
    if(highMonth) tags.add(I18N[LANG].tag_high);
    const factor=(weekend?1.10:1.0)*(highMonth?1.20:1.0);
    return { factor, tags:[...tags] };
  }
  const pricePerBed=(roomId,start,end)=>Math.round(ROOMS[roomId].basePrice*priceModifiers(start,end).factor);

  // ====== Stepper (+ / −)
  function step(input, delta){
    const min = Number(input.min||0), max = Number(input.max||38);
    const cur = Number(input.value||0);
    let next = clamp(cur + delta, min, max);
    const other = input===menEl ? Number(womenEl.value||0) : Number(menEl.value||0);
    if(next + other > 38) next = 38 - other;
    input.value = clamp(next, min, max);
  }
  menMinus?.addEventListener("click", ()=>{ step(menEl, -1); });
  menPlus ?.addEventListener("click", ()=>{ step(menEl, +1); });
  womenMinus?.addEventListener("click", ()=>{ step(womenEl, -1); });
  womenPlus ?.addEventListener("click", ()=>{ step(womenEl, +1); });
  function enforceTotals(){
    const men = Number(menEl.value||0), women = Number(womenEl.value||0);
    const total = men + women;
    if(total>38){
      if(document.activeElement===menEl){ menEl.value = 38 - women; }
      else { womenEl.value = 38 - men; }
    }
  }
  menEl?.addEventListener("input", enforceTotals);
  womenEl?.addEventListener("input", enforceTotals);

  // ====== Check availability
  $('#checkAvail')?.addEventListener('click', async ()=>{
    const dIn=dateInEl?.value, dOut=dateOutEl?.value;
    const men=Number(menEl?.value||0), women=Number(womenEl?.value||0), qty=men+women;
    if(!dIn||!dOut){ checkMsg.innerHTML='<span class="err">'+I18N[LANG].err_dates+'</span>'; return; }
    if(dOut<=dIn){ checkMsg.innerHTML='<span class="err">'+I18N[LANG].err_co+'</span>'; return; }
    if(qty<1){ checkMsg.innerHTML='<span class="err">'+I18N[LANG].err_qty+'</span>'; return; }
    if(qty>38){ checkMsg.innerHTML='<span class="err">Máximo 38 huéspedes.</span>'; return; }
    checkMsg.textContent=I18N[LANG].checking;
    try{
      const url=`${AVAILABILITY_ENDPOINT}?from=${encodeURIComponent(dIn)}&to=${encodeURIComponent(dOut)}`;
      const r=await fetch(url, { headers:{ "Accept":"application/json" }});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error('avail_fail');
      renderAvailability(dIn,dOut,men,women,j.occupied||{});
      const mods=priceModifiers(dIn,dOut);
      modsEl.textContent = mods.tags.length ? (I18N[LANG].mods+mods.tags.join(' · ')) : '';
      checkMsg.textContent=I18N[LANG].updated;
    }catch(e){
      checkMsg.innerHTML='<span class="err">'+I18N[LANG].err_avail+'</span>';
    }
  });

  // ====== Render de camas
  function renderAvailability(dateIn,dateOut,men,women,occupied){
    selection={}; roomsWrap.innerHTML='';
    const qty=men+women; if(qty===0){ roomsCard.style.display='none'; return; }
    roomsCard.style.display='block'; formCard.style.display='none';
    const nights=diffNights(dateIn,dateOut);
    neededEl.textContent=qty; selCountEl.textContent=0; internalTotal=0; totalPriceEl.textContent=0; continueBtn.disabled=true; suggestBox.style.display='none';

    const freeByRoom={};
    [1,3,5,6].forEach(id=>{
      const occ=new Set((occupied&&occupied[id])||[]);
      const free=[]; for(let b=1;b<=ROOMS[id].cap;b++) if(!occ.has(b)) free.push(b);
      freeByRoom[id]=free;
    });

    const hasWomen = women >= 1;

    // 🔧 Parche: mostrar SIEMPRE todos los cuartos válidos (no filtrar por qty)
    const toShow = new Set();
    toShow.add(1); // mixto 12
    toShow.add(3); // mixto 12
    toShow.add(5); // mixto 7
    if (hasWomen) toShow.add(6); // femenino 7

    const finalShow = Array.from(toShow).filter(id=>freeByRoom[id].length>0);
    if(!finalShow.length){ roomsWrap.innerHTML='<p>'+I18N[LANG].no_beds+'</p>'; return; }

    finalShow.forEach(id=>{
      const r=ROOMS[id], libres=freeByRoom[id], pBed=pricePerBed(id,dateIn,dateOut);
      const capMsg=`<span class="muted">${I18N[LANG].avail_of} ${libres.length}/${r.cap} · ${I18N[LANG].price_bed} R$ ${pBed} · ${I18N[LANG].nights} ${nights}</span>`;
      const roomDiv=document.createElement('div'); roomDiv.className='room';
      roomDiv.innerHTML=`<h3>${r.name}</h3><div>${capMsg}</div><div class="beds" id="beds-${id}"></div>`;
      roomsWrap.appendChild(roomDiv); selection[id]=new Set();
      const grid=roomDiv.querySelector('#beds-'+id);
      const occ=new Set((occupied&&occupied[id])||[]);
      for(let b=1;b<=r.cap;b++){
        const btn=document.createElement('button');
        btn.type="button"; btn.className='bed'+(occ.has(b)?' occupied':'');
        btn.setAttribute('role','button'); btn.setAttribute('aria-pressed','false'); btn.setAttribute('tabindex','0');
        btn.textContent=b;
        if(!occ.has(b)){
          btn.title=`Cama ${b}`;
          btn.addEventListener('click',()=>toggleBed(id,b,dateIn,dateOut,btn));
          btn.addEventListener('keydown',(ev)=>{ if(ev.key==='Enter'||ev.code==='Space'){ ev.preventDefault(); btn.click(); } });
        } else { btn.disabled = true; }
        grid.appendChild(btn);
      }
    });
    refreshTotals(men,women,dateIn,dateOut);
  }

  // 🔧 Parche: no dejar seleccionar más de las necesarias (y avisar)
  function toggleBed(roomId, bedId, dateIn, dateOut, btnNode){
    const set = selection[roomId] || new Set();

    if (ROOMS[roomId].femaleOnly && Number(document.getElementById('women').value||0) < 1) {
      alert(I18N[LANG].female_rule);
      return;
    }

    const men = Number(document.getElementById('men').value||0);
    const women = Number(document.getElementById('women').value||0);
    const needed = men + women;

    let selectedCount = 0;
    Object.values(selection).forEach(s => { selectedCount += (s?.size || 0); });

    const isSelected = set.has(bedId);

    if (!isSelected && selectedCount >= needed) {
      const suggestBox = document.getElementById('suggestBox');
      suggestBox.style.display = 'block';
      suggestBox.textContent = I18N[LANG].select_exact.replace('{n}', needed);
      return;
    }

    if (isSelected) set.delete(bedId); else set.add(bedId);
    selection[roomId] = set;

    if (btnNode && !btnNode.classList.contains('occupied')) {
      btnNode.classList.toggle('selected', set.has(bedId));
      btnNode.setAttribute('aria-pressed', set.has(bedId) ? 'true' : 'false');
    }

    refreshTotals(men, women, dateIn, dateOut);
  }

  function refreshTotals(men,women,start,end){
    const needed=men+women; const nights=diffNights(start,end);
    let selectedCount=0,total=0,selectedInFemale=0;
    Object.entries(selection).forEach(([id,set])=>{
      const size=set.size; selectedCount+=size;
      const pBed=pricePerBed(Number(id),start,end);
      total+=size*pBed*Math.max(1,nights);
      if(ROOMS[id].femaleOnly) selectedInFemale+=size;
    });
    document.getElementById('selCount').textContent=selectedCount;
    internalTotal = total;
    document.getElementById('totalPrice').textContent=fmtBRL(total);
    let ok=(selectedCount===needed && needed>0);
    if(selectedInFemale>women) ok=false;
    document.getElementById('continueBtn').disabled=!ok;
    const suggestBox=document.getElementById('suggestBox');
    suggestBox.style.display= ok ? 'none' : 'block';
    suggestBox.textContent = ok ? '' : ((selectedInFemale>women)?I18N[LANG].female_rule:I18N[LANG].select_exact.replace('{n}', needed));
  }

  const currentSelectionObject=()=>{ const camas={}; for(const [roomId,set] of Object.entries(selection)) camas[roomId]=Array.from(set||[]); return camas; };

  function buildOrderBase(){
    const camas=currentSelectionObject();
    const nights=(function(){ const a=dateInEl.value, b=dateOutEl.value; const ms=new Date(b+'T00:00:00')-new Date(a+'T00:00:00'); return Math.max(1,Math.round(ms/86400000)); })();
    const bookingId=currentHoldId||('BKG-'+Date.now());
    return {
      bookingId,
      nombre:document.querySelector('#reserva-form [name="nombre"]')?.value||'',
      email:document.querySelector('#reserva-form [name="email"]')?.value||'',
      telefono:document.querySelector('#reserva-form [name="telefono"]')?.value||'',
      entrada:dateInEl.value, salida:dateOutEl.value,
      hombres:Number(menEl.value||0), mujeres:Number(womenEl.value||0),
      camas, total:internalTotal, nights
    };
  }

  // ====== HOLD + formulario
  document.getElementById('continueBtn')?.addEventListener('click',async ()=>{
    const order=buildOrderBase();
    if(!order.total){ alert(I18N[LANG].pick_beds); return; }
    const holdPayload={ holdId:order.bookingId, nombre:order.nombre||"HOLD", email:order.email||"", telefono:order.telefono||"", entrada:order.entrada, salida:order.salida, hombres:order.hombres, mujeres:order.mujeres, camas:order.camas, total:order.total };
    try{
      const r=await fetch(HOLDS_START_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(holdPayload) });
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||'No se pudo crear HOLD');
      currentHoldId=j.holdId||order.bookingId;
      document.getElementById('formCard').style.display='block';
      document.querySelector('#reserva-form [name="entrada"]').value=document.getElementById('dateIn').value;
      document.querySelector('#reserva-form [name="salida"]').value=document.getElementById('dateOut').value;
      requestAnimationFrame(()=>window.scrollTo({ top: document.getElementById('formCard').offsetTop-10, behavior:'smooth' }));
      toast(I18N[LANG].hold_ok);
    }catch(e){ alert(I18N[LANG].hold_err+e.message); }
  });

  // ====== Simulador aprobado
  document.getElementById('simulateOk')?.addEventListener('click',()=>{
    document.getElementById('payState').textContent=I18N[LANG].approved;
    document.getElementById('submitBtn').disabled=false;
    window.__simApproved=true;
  });

  // ====== Mercado Pago
  let mpBusy=false;
  document.getElementById('payMP')?.addEventListener('click', async ()=>{
    if(mpBusy) return; mpBusy=true; document.getElementById('payMP').disabled=true;
    try{
      const order=buildOrderBase();
      if(!order.total){ alert(I18N[LANG].pick_beds); return; }
      if(!order.nombre || !order.email){ alert(I18N[LANG].fill_name_email); return; }
      if(!document.getElementById('consentChk').checked){ alert(I18N[LANG].need_consent); return; }
      const consent = { accepted:true, ts:new Date().toISOString() };
      const r1=await fetch(BOOKINGS_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...order, pay_status:'pending', consent })});
      if(!r1.ok){ const t=await r1.text(); throw new Error(I18N[LANG].cant_register+t); }
      const r2=await fetch(MP_PREFERENCE_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:'Reserva Lapa Casa Hostel', unit_price:order.total, quantity:1, currency_id:'BRL', metadata:{ bookingId:order.bookingId, email:order.email } })});
      const j=await r2.json();
      if(!r2.ok||!j.init_point) throw new Error(j.error||(I18N[LANG].cant_pref));
      localStorage.setItem('lapa-last-booking', JSON.stringify(order));
      window.location.href=j.init_point;
    }catch(e){ alert(I18N[LANG].pay_mp_err+e.message); }
    finally{ mpBusy=false; document.getElementById('payMP').disabled=false; }
  });

  // ====== Stripe
  let stripeBusy=false;
  document.getElementById('payStripe')?.addEventListener('click', async ()=>{
    if(stripeBusy) return; stripeBusy=true; document.getElementById('payStripe').disabled=true;
    try{
      const order=buildOrderBase();
      if(!order.total){ alert(I18N[LANG].pick_beds); return; }
      if(!order.nombre || !order.email){ alert(I18N[LANG].fill_name_email); return; }
      if(!document.getElementById('consentChk').checked){ alert(I18N[LANG].need_consent); return; }
      const consent = { accepted:true, ts:new Date().toISOString() };
      const r1=await fetch(BOOKINGS_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...order, pay_status:'pending', consent })});
      if(!r1.ok){ const t=await r1.text(); throw new Error(I18N[LANG].cant_register+t); }
      const r2=await fetch(STRIPE_SESSION_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order }) });
      const j=await r2.json();
      if(!r2.ok||!j.id) throw new Error(j.error||(I18N[LANG].cant_session));
      localStorage.setItem('lapa-last-booking', JSON.stringify(order));
      const s=getStripe(); if(!s){ alert("Stripe no disponible ahora."); return; }
      const { error }=await s.redirectToCheckout({ sessionId:j.id });
      if(error) throw error;
    }catch(e){ alert(I18N[LANG].pay_stripe_err+e.message); }
    finally{ stripeBusy=false; document.getElementById('payStripe').disabled=false; }
  });

  // ====== Confirmar
  document.getElementById('reserva-form')?.addEventListener('submit', async e=>{
    e.preventDefault();
    document.getElementById('submitBtn').disabled = true;
    try{
      if(!document.getElementById('consentChk').checked){ alert(I18N[LANG].need_consent); document.getElementById('submitBtn').disabled=false; return; }
      const order = buildOrderBase();
      let paidOk = (document.getElementById('payState').textContent||'').toLowerCase().includes(I18N[LANG].approved.slice(0,5)) || window.__simApproved;
      try{
        if(order.bookingId && PAY_STATUS_ENDPOINT){
          const rs = await fetch(`${PAY_STATUS_ENDPOINT}?bookingId=${encodeURIComponent(order.bookingId)}`);
          if(rs.ok){ const js = await rs.json(); if(js && (js.paid===true || js.status==='approved'||js.status==='paid')) paidOk = true; }
        }
      }catch(_){}
      if(!paidOk){ alert(I18N[LANG].need_payment); document.getElementById('submitBtn').disabled=false; return; }
      const r=await fetch(HOLDS_CONFIRM_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ holdId:currentHoldId||order.bookingId, status:'paid' }) });
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||'No se pudo confirmar HOLD');
      paidFinal=true; alert("✅ "+I18N[LANG].book_ok);
    }catch(e){ alert(I18N[LANG].confirm_err+e.message); document.getElementById('submitBtn').disabled=false; }
  });

  // ====== Liberar HOLD si se cierra sin pagar
  window.addEventListener('beforeunload', ()=>{
    try{
      if(currentHoldId && !paidFinal){
        navigator.sendBeacon(HOLDS_RELEASE_ENDPOINT, new Blob([JSON.stringify({holdId:currentHoldId})], {type:'application/json'}));
      }
    }catch(_){}
  });

  // ====== Param paid=1 + rehidratación de estado
  (function restorePaidState(){
    const p=new URLSearchParams(location.search);
    if(p.get('paid')==='1'){ document.getElementById('payState').textContent=I18N[LANG].approved; document.getElementById('submitBtn').disabled=false; window.__simApproved=true; }
    try{
      const cached = JSON.parse(localStorage.getItem('lapa-last-booking')||'null');
      if(cached && cached.bookingId && PAY_STATUS_ENDPOINT){
        fetch(`${PAY_STATUS_ENDPOINT}?bookingId=${encodeURIComponent(cached.bookingId)}`)
          .then(r=>r.ok?r.json():null)
          .then(js=>{ if(js && (js.paid===true || js.status==='approved'||js.status==='paid')){ document.getElementById('payState').textContent=I18N[LANG].approved; document.getElementById('submitBtn').disabled=false; window.__simApproved=true; }})
          .catch(()=>{});
      }
    }catch(_){}
  })();

  // ====== Idioma
  (function initLang(){
    const nav=(navigator.language||'es').slice(0,2).toLowerCase();
    const initial=(nav==='en'?'en':'es');
    document.getElementById('langSel').value=initial;
    LANG=initial;
    applyI18N();
    document.getElementById('langSel').addEventListener('change', e=> { LANG = (e.target.value==='en')?'en':'es'; applyI18N(); });
  })();
})();
