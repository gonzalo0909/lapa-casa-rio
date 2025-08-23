(function(){
  // === Base de API y Stripe ===
  const metaApi = document.querySelector('meta[name="backend-base-url"]')?.getAttribute('content') || '/api';
  const API_BASE = (window.API_BASE || metaApi).replace(/\/$/, '');
  const STRIPE_PK = document.querySelector('meta[name="stripe-publishable-key"]')?.getAttribute('content') || window.STRIPE_PUBLISHABLE_KEY || '';
  const $ = s=>document.querySelector(s);

  // ==== ENDPOINTS ====
  const EP = {
    PING: API_BASE + '/ping',
    AVAIL: API_BASE + '/availability',
    PAY_MP_PREF: API_BASE + '/payments/mp/preference',
    PAY_MP_PIX:  API_BASE + '/payments/mp/pix',
    PAY_STRIPE:  API_BASE + '/payments/stripe/session',
    HOLDS_START: API_BASE + '/holds/start',
    HOLDS_CONFIRM: API_BASE + '/holds/confirm',
    HOLDS_RELEASE: API_BASE + '/holds/release',
    PAY_STATUS: API_BASE + '/bookings/status'
  };

  // Helper fetch JSON
  async function fetchJSON(url, opts={}){
    const r = await fetch(url, Object.assign({ headers:{ Accept:'application/json' } }, opts));
    const ct = (r.headers.get('content-type')||'').toLowerCase();
    if (!ct.includes('application/json')) {
      const t = await r.text().catch(()=> '');
      throw new Error(`bad_json:${r.status} ${t.slice(0,200)}`);
    }
    const j = await r.json();
    if (!r.ok && !j.ok) throw new Error(j.error || `http_${r.status}`);
    return j;
  }

  // ==== ROUTER (book/admin) ====
  function route(){
    const hash = location.hash || '#/book';
    $('#book').style.display = hash==='#/book' ? 'block':'none';
    $('#admin').style.display= hash==='#/admin'? 'block':'none';
  }
  window.addEventListener('hashchange', route); route();

  // ==== PING inicial ====
  (async ()=>{ try{ await fetchJSON(EP.PING); } catch(e){ alert('⚠️ API no disponible: '+String(e.message||e)); } })();

  // ==== LÓGICA DE RESERVAS ====
  const ROOMS = {
    1:{name:'Cuarto 1 (12 mixto)',cap:12,basePrice:55,femaleOnly:false},
    3:{name:'Cuarto 3 (12 mixto)',cap:12,basePrice:55,femaleOnly:false},
    5:{name:'Cuarto 5 (7 mixto)', cap:7, basePrice:55,femaleOnly:false},
    6:{name:'Cuarto 6 (7 femenino)',cap:7, basePrice:60,femaleOnly:true}
  };
  let selection={},currentHoldId=null,paidFinal=false,internalTotal=0;

  const toISO=d=>new Date(d+'T00:00:00');
  const diffNights=(a,b)=>{ if(!a||!b) return 0; const ms=toISO(b)-toISO(a); return Math.max(0,Math.round(ms/86400000)); };
  const fmtBRL=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
  const priceModifiers=(start,end)=>{let weekend=false,high=false;const n=diffNights(start,end);for(let i=0;i<n;i++){const d=new Date(toISO(start));d.setDate(d.getDate()+i);if([0,5,6].includes(d.getDay())) weekend=true;if([11,0,1].includes(d.getMonth())) high=true;}return (weekend?1.10:1)*(high?1.20:1);};
  const pricePerBed=(roomId,start,end)=>Math.round(ROOMS[roomId].basePrice*priceModifiers(start,end));

  // ==== Inicializar fechas ====
  (function initDates(){
    const toYMD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const now=new Date(),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const di=$('#dateIn'), doo=$('#dateOut');
    if(di){ di.min=toYMD(now); if(!di.value) di.value=toYMD(now); }
    if(doo){ doo.min=toYMD(tomorrow); if(!doo.value) doo.value=toYMD(tomorrow); }
  })();

  // ==== Controles ====
  function clamp(n,min,max){ n=Number.isFinite(n)?n:0; return Math.max(min,Math.min(max,n)); }
  function step(input,delta){
    const min=Number(input.min||0),max=Number(input.max||38),cur=Number(input.value||0);
    const other=input.id==='men'?Number($('#women').value||0):Number($('#men').value||0);
    let next=clamp(cur+delta,min,max); if(next+other>38) next=38-other;
    input.value=clamp(next,min,max); handleCountsChange();
  }
  $('#menMinus')?.addEventListener('click',()=>step($('#men'),-1));
  $('#menPlus')?.addEventListener('click',()=>step($('#men'),+1));
  $('#womenMinus')?.addEventListener('click',()=>step($('#women'),-1));
  $('#womenPlus')?.addEventListener('click',()=>step($('#women'),+1));
  $('#men')?.addEventListener('input',handleCountsChange);
  $('#women')?.addEventListener('input',handleCountsChange);

  function handleCountsChange(){
    const men=Number($('#men').value||0),women=Number($('#women').value||0),qty=men+women;
    if(qty===0){
      selection={}; $('#rooms').innerHTML=''; $('#roomsCard').style.display='none'; $('#formCard').style.display='none';
      $('#selCount').textContent='0'; $('#needed').textContent='0'; $('#totalPrice').textContent='0'; $('#continueBtn').disabled=true;
      $('#checkMsg').textContent='Seleccioná al menos 1 huésped.'; return;
    }
    if($('#roomsCard').style.display!=='none'){ $('#checkAvail')?.click(); }
  }

  // ==== Chequear disponibilidad ====
  $('#checkAvail')?.addEventListener('click', async ()=>{
    const dIn=$('#dateIn').value,dOut=$('#dateOut').value;
    const men=Number($('#men').value||0),women=Number($('#women').value||0),qty=men+women;
    const msg=$('#checkMsg');
    if(!dIn||!dOut){msg.innerHTML='<span class="err">Elegí check-in y check-out.</span>';return;}
    if(dOut<=dIn){msg.innerHTML='<span class="err">El check-out debe ser posterior.</span>';return;}
    if(qty<1){msg.innerHTML='<span class="err">Indicá al menos 1 huésped.</span>';return;}
    msg.textContent='Consultando disponibilidad...';
    let occupied={};
    try{
      const url=`${EP.AVAIL}?from=${encodeURIComponent(dIn)}&to=${encodeURIComponent(dOut)}`;
      const j=await fetchJSON(url); occupied=j.occupied||{};
    }catch(err){
      console.error('AVAIL error', err);
      occupied={}; msg.innerHTML='<span class="err">/api no devuelve JSON. Asumo todo libre.</span>';
    }
    renderAvailability(dIn,dOut,men,women,occupied); msg.textContent='Disponibilidad actualizada';
  });

  function renderAvailability(dateIn,dateOut,men,women,occupied){
    selection={}; $('#rooms').innerHTML='';
    const qty=men+women; if(qty===0){ $('#roomsCard').style.display='none'; $('#formCard').style.display='none'; return; }
    $('#roomsCard').style.display='block'; $('#formCard').style.display='none';
    const nights=diffNights(dateIn,dateOut);
    $('#needed').textContent=qty; $('#selCount').textContent=0; internalTotal=0; $('#totalPrice').textContent=0; $('#continueBtn').disabled=true; $('#suggestBox').style.display='none';

    const freeByRoom={};
    [1,3,5,6].forEach(id=>{ const occ=new Set((occupied&&occupied[id])||[]); const free=[]; for(let b=1;b<=ROOMS[id].cap;b++) if(!occ.has(b)) free.push(b); freeByRoom[id]=free; });

    const hasWomen=women>=1; const toShow=new Set();
    if(!hasWomen){ toShow.add(1); if(qty>12){ toShow.add(3); toShow.add(5);} }
    else{ toShow.add(1); toShow.add(5); toShow.add(6); if(qty>12){ toShow.add(3);} }

    const finalShow=Array.from(toShow).filter(id=>freeByRoom[id].length>0);
    if(!finalShow.length){ $('#rooms').innerHTML='<p>No hay camas disponibles.</p>'; return; }

    finalShow.forEach(id=>{
      const r=ROOMS[id],libres=freeByRoom[id],pBed=pricePerBed(id,dateIn,dateOut);
      const nightsText=nights||1;
      const capMsg=`<span class="muted">Disponibles: ${libres.length}/${r.cap} · Precio por cama: R$ ${pBed} · Noches: ${nightsText}</span>`;
      const roomDiv=document.createElement('div'); roomDiv.className='room';
      roomDiv.innerHTML=`<h3>${r.name}</h3><div>${capMsg}</div><div class="beds" id="beds-${id}"></div>`;
      $('#rooms').appendChild(roomDiv); selection[id]=new Set();
      const grid=roomDiv.querySelector('#beds-'+id);
      const occ=new Set((occupied&&occupied[id])||[]);
      for(let b=1;b<=r.cap;b++){
        const btn=document.createElement('button');
        btn.type='button'; btn.className='bed'+(occ.has(b)?' occupied':''); btn.textContent=b;
        if(!occ.has(b)) btn.addEventListener('click',()=>toggleBed(id,b,dateIn,dateOut,btn)); else btn.disabled=true;
        grid.appendChild(btn);
      }
    });
    refreshTotals(men,women,dateIn,dateOut);
  }

  function toggleBed(roomId,bedId,dateIn,dateOut,btn){
    const women=Number($('#women').value||0);
    if(ROOMS[roomId].femaleOnly && women<1){ alert('El cuarto femenino requiere al menos 1 mujer.'); return; }
    const set=selection[roomId]||new Set();
    set.has(bedId)? set.delete(bedId): set.add(bedId);
    selection[roomId]=set; btn.classList.toggle('selected', set.has(bedId));
    refreshTotals(Number($('#men').value||0), Number($('#women').value||0), dateIn, dateOut);
  }

  function refreshTotals(men,women,start,end){
    const needed=men+women; const nights=diffNights(start,end)||1;
    let selectedCount=0,total=0,femaleSelected=0;
    Object.entries(selection).forEach(([id,set])=>{
      const size=set.size; selectedCount+=size;
      const pBed=pricePerBed(Number(id),start,end); total+=size*pBed*nights;
      if(ROOMS[id].femaleOnly) femaleSelected+=size;
    });
    $('#selCount').textContent=selectedCount; internalTotal=total; $('#totalPrice').textContent=fmtBRL(total);
    let ok=(selectedCount===needed && needed>0); if(femaleSelected>women) ok=false;
    $('#continueBtn').disabled=!ok;
    const sb=$('#suggestBox'); sb.style.display= ok ? 'none' : 'block';
    sb.textContent = ok ? '' : ((femaleSelected>women)?'El cuarto femenino requiere al menos 1 mujer.':`Seleccioná exactamente ${needed} camas.`);
  }

  // ==== HOLD ====
  function buildOrderBase(){
    const a=$('#dateIn').value,b=$('#dateOut').value;
    const nights=Math.max(1, Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/86400000));
    return {
      bookingId: currentHoldId||('BKG-'+Date.now()),
      nombre: $('#reserva-form [name="nombre"]')?.value||'',
      email:  $('#reserva-form [name="email"]')?.value||'',
      telefono: $('#reserva-form [name="telefono"]')?.value||'',
      entrada:a, salida:b,
      hombres:Number($('#men').value||0), mujeres:Number($('#women').value||0),
      camas: (()=>{const o={}; for(const [id,set] of Object.entries(selection)) o[id]=Array.from(set||[]); return o;})(),
      total: internalTotal, nights
    };
  }

  $('#continueBtn')?.addEventListener('click', async ()=>{
    const order=buildOrderBase();
    if(!order.total){ alert('Seleccioná camas primero.'); return; }
    try{
      const j = await fetchJSON(EP.HOLDS_START,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ holdId:order.bookingId, ...order }) });
      currentHoldId = j.holdId || order.bookingId;
      $('#formCard').style.display='block';
      $('#reserva-form [name="entrada"]').value=$('#dateIn').value;
      $('#reserva-form [name="salida"]').value=$('#dateOut').value;
      window.scrollTo({ top: $('#formCard').offsetTop-10, behavior:'smooth' });
      alert('Camas reservadas por 10 min (HOLD)');
    }catch(e){ alert('Error creando HOLD: ' + String(e.message||e)); }
  });

  // ==== PAGOS ====
  document.getElementById('payMP')?.addEventListener('click', async () => {
    try{
      const order = buildOrderBase();
      const j = await fetchJSON(EP.PAY_MP_PREF,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order }) });
      if (!j.init_point) throw new Error('init_point vacío');
      window.location.href = j.init_point;
    }catch(e){ alert('Error MP: ' + String(e.message||e)); }
  });

  document.getElementById('payPix')?.addEventListener('click', async () => {
    try{
      const order = buildOrderBase();
      const j = await fetchJSON(EP.PAY_MP_PIX,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order }) });
      if (!(j.qr_code_base64 || j.ticket_url)) throw new Error('PIX sin QR ni ticket');
      const modal = document.getElementById('pixModal');
      const img   = document.getElementById('pixQr');
      const ta    = document.getElementById('pixCopiaCola');
      const tk    = document.getElementById('pixTicket');
      img.src = j.qr_code_base64 ? `data:image/png;base64,${j.qr_code_base64}` : '';
      ta.value = j.qr_code || '';
      if (j.ticket_url) { tk.style.display='inline-block'; tk.href = j.ticket_url; } else { tk.style.display='none'; }
      modal.style.display = 'flex';
      const payState = document.getElementById('payState'); if (payState) payState.textContent = j.status || 'pending';
    }catch(e){ alert('Error PIX: ' + String(e.message||e)); }
  });

  document.getElementById('copyPix')?.addEventListener('click', async () => {
    try { const ta = document.getElementById('pixCopiaCola'); ta.select(); ta.setSelectionRange(0, 99999); await navigator.clipboard.writeText(ta.value); alert('Código Pix copiado'); }
    catch { alert('No se pudo copiar'); }
  });

  document.getElementById('closePix')?.addEventListener('click', () => { document.getElementById('pixModal').style.display = 'none'; });

  document.getElementById('payStripe')?.addEventListener('click', async () => {
    try{
      const order = buildOrderBase();
      const j = await fetchJSON(EP.PAY_STRIPE,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order }) });
      if (!j.id) throw new Error('session id vacío');
      const stripe = window.Stripe?.(STRIPE_PK);
      if (!stripe) { alert('Stripe no disponible'); return; }
      const { error } = await stripe.redirectToCheckout({ sessionId: j.id });
      if (error) alert(error.message || 'Error Stripe');
    }catch(e){ alert('Error Stripe: ' + String(e.message||e)); }
  });

  // ==== Confirmar reserva ====
  $('#reserva-form')?.addEventListener('submit', async (e)=>{
    e.preventDefault(); const btn=$('#submitBtn'); btn.disabled=true;
    try{
      if(!$('#consentChk').checked){ alert('Acepta la política.'); btn.disabled=false; return; }
      const order=buildOrderBase();
      try{
        const js=await fetchJSON(`${EP.PAY_STATUS}?bookingId=${encodeURIComponent(order.bookingId)}`);
        if(js&&(js.paid===true||js.status==='approved'||js.status==='paid')) document.getElementById('payState').textContent='aprobado';
      }catch{}
      const paidOk=(document.getElementById('payState').textContent||'').to
