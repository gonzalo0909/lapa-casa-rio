(function(){
  "use strict";

  /* ===== CONFIG ===== */
  var API_BASE = (window.BACKEND_BASE_URL || "").replace(/\/$/, "");
  function endpoint(p){ return API_BASE ? API_BASE + p : p; }
  var MP_PREFERENCE_ENDPOINT  = endpoint("/payments/mp/preference");
  var STRIPE_SESSION_ENDPOINT = endpoint("/payments/stripe/session");
  var HOLDS_START_ENDPOINT    = endpoint("/holds/start");
  var HOLDS_RELEASE_ENDPOINT  = endpoint("/holds/release");
  var HOLDS_CONFIRM_ENDPOINT  = endpoint("/holds/confirm");
  var AVAILABILITY_ENDPOINT   = endpoint("/availability");
  var PAY_STATUS_ENDPOINT     = endpoint("/payments/status"); // opcional
  var STRIPE_PK = window.STRIPE_PUBLISHABLE_KEY;

  var __stripeInst=null; 
  function getStripe(){ if(typeof window.Stripe==="undefined") return null; return (__stripeInst = __stripeInst || window.Stripe(STRIPE_PK)); }

  /* ===== DOM SAFE HELPERS ===== */
  function $id(id){
    var el = document.getElementById(id);
    if (!el) console.warn("[WARN] Falta #"+id);
    return el;
  }

  var dateInEl   = $id("dateIn");
  var dateOutEl  = $id("dateOut");
  var menEl      = $id("men");
  var womenEl    = $id("women");
  var menMinus   = $id("menMinus");
  var menPlus    = $id("menPlus");
  var womenMinus = $id("womenMinus");
  var womenPlus  = $id("womenPlus");
  var checkAvail = $id("checkAvail");
  var checkMsg   = $id("checkMsg");
  var roomsCard  = $id("roomsCard");
  var roomsWrap  = $id("rooms");
  var modsEl     = $id("mods");
  var neededEl   = $id("needed");
  var selCountEl = $id("selCount");
  var totalPriceEl = $id("totalPrice");
  var continueBtn  = $id("continueBtn");
  var suggestBox   = $id("suggestBox");
  var formCard     = $id("formCard");
  var reservaForm  = $id("reserva-form");
  var payStateEl   = $id("payState");
  var submitBtn    = $id("submitBtn");
  var simulateOkBtn= $id("simulateOk");
  var payMPBtn     = $id("payMP");
  var payStripeBtn = $id("payStripe");
  var toastEl      = $id("toast");

  /* ===== utils ===== */
  function toast(msg){ if(!toastEl) return; toastEl.textContent=msg; toastEl.classList.add("show"); setTimeout(function(){ toastEl.classList.remove("show"); },2000); }
  function clamp(n,min,max){ n = (typeof n==='number' && isFinite(n))?n:0; return Math.max(min, Math.min(max, n)); }
  function toISO(d){ return new Date(d+'T00:00:00'); }
  function diffNights(a,b){ if(!a||!b) return 0; var ms=toISO(b)-toISO(a); return Math.max(0,Math.round(ms/86400000)); }
  function fmtBRL(n){ return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:0, maximumFractionDigits:0}); }

  /* ===== init fechas ===== */
  (function initDates(){
    if(!dateInEl || !dateOutEl) return;
    function YMD(d){ var y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2); return y+'-'+m+'-'+day; }
    var now = new Date(), tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    dateInEl.min = YMD(now);
    dateOutEl.min = YMD(tomorrow);
    if(!dateInEl.value) dateInEl.value = YMD(now);
    if(!dateOutEl.value || dateOutEl.value<=dateInEl.value) dateOutEl.value = YMD(tomorrow);
  })();

  /* ===== precios y rooms ===== */
  var ROOMS = {
    1:{ name:"Cuarto 1 (12 mixto)", cap:12, basePrice:55, femaleOnly:false },
    3:{ name:"Cuarto 3 (12 mixto)", cap:12, basePrice:55, femaleOnly:false },
    5:{ name:"Cuarto 5 (7 mixto)",  cap:7,  basePrice:55, femaleOnly:false },
    6:{ name:"Cuarto 6 (7 femenino)", cap:7, basePrice:60, femaleOnly:true }
  };
  function priceModifiers(start,end){
    var tags=[]; var weekend=false, highMonth=false;
    var nights=diffNights(start,end); if(!nights) return {factor:1,tags:[]};
    var base = new Date(toISO(start));
    for(var i=0;i<nights;i++){
      var d=new Date(base.getTime()); d.setDate(base.getDate()+i);
      var day=d.getDay(); if(day===0||day===5||day===6) weekend=true;
      var m=d.getMonth(); if(m===11||m===0||m===1) highMonth=true;
    }
    if(weekend) tags.push("Fin de semana +10%");
    if(highMonth) tags.push("Alta (Dic–Feb) +20%");
    var factor=(weekend?1.10:1.0)*(highMonth?1.20:1.0);
    return { factor:factor, tags:tags };
  }
  function pricePerBed(roomId,start,end){ return Math.round(ROOMS[roomId].basePrice*priceModifiers(start,end).factor); }

  /* ===== controles hombres/mujeres ===== */
  function step(input, delta){
    if(!input) return;
    var min = Number(input.min||0), max = Number(input.max||38);
    var cur = Number(input.value||0);
    var next = clamp(cur + delta, min, max);
    var other = (input===menEl) ? Number(womenEl && womenEl.value||0) : Number(menEl && menEl.value||0);
    if(next + other > 38) next = 38 - other;
    input.value = clamp(next, min, max);
  }
  function enforceTotals(){
    if(!menEl || !womenEl) return;
    var men = Number(menEl.value||0), women = Number(womenEl.value||0);
    var total = men + women;
    if(total>38){
      if(document.activeElement===menEl){ menEl.value = 38 - women; }
      else { womenEl.value = 38 - men; }
    }
  }

  if(menMinus) menMinus.addEventListener("click", function(){ step(menEl, -1); });
  if(menPlus)  menPlus .addEventListener("click", function(){ step(menEl, +1); });
  if(womenMinus) womenMinus.addEventListener("click", function(){ step(womenEl, -1); });
  if(womenPlus)  womenPlus .addEventListener("click", function(){ step(womenEl, +1); });
  if(menEl)   menEl.addEventListener("input", enforceTotals);
  if(womenEl) womenEl.addEventListener("input", enforceTotals);

  /* ===== estado selección ===== */
  var selection={}, currentHoldId=null, paidFinal=false, internalTotal=0;

  function currentSelectionObject(){
    var camas={}; 
    for(var roomId in selection){ if(Object.prototype.hasOwnProperty.call(selection,roomId)){ camas[roomId]=Array.from(selection[roomId]||[]); } }
    return camas;
  }

  function renderAvailability(dateIn,dateOut,men,women,occupied){
    if(!roomsWrap || !roomsCard) return;
    selection={}; roomsWrap.innerHTML='';
    var qty=men+women; if(qty===0){ roomsCard.style.display='none'; return; }
    roomsCard.style.display='block'; if(formCard) formCard.style.display='none';
    var nights=diffNights(dateIn,dateOut);
    if(neededEl) neededEl.textContent=qty;
    if(selCountEl) selCountEl.textContent=0;
    internalTotal=0;
    if(totalPriceEl) totalPriceEl.textContent=0;
    if(continueBtn) continueBtn.disabled=true;
    if(suggestBox) suggestBox.style.display='none';

    var freeByRoom={};
    [1,3,5,6].forEach(function(id){
      var occ=new Set((occupied&&occupied[id])||[]);
      var free=[]; for(var b=1;b<=ROOMS[id].cap;b++) if(!occ.has(b)) free.push(b);
      freeByRoom[id]=free;
    });

    var hasWomen = women >= 1;
    var toShow={};
    if(!hasWomen){
      toShow[1]=true;
      if(qty>12){ toShow[3]=true; toShow[5]=true; }
    }else{
      toShow[1]=true; toShow[5]=true; toShow[6]=true;
      if(qty>12){ toShow[3]=true; }
    }

    var finalShow = [1,3,5,6].filter(function(id){ return toShow[id] && freeByRoom[id].length>0; });
    if(finalShow.length===0){ roomsWrap.innerHTML='<p>No hay camas disponibles.</p>'; return; }

    for(var k=0;k<finalShow.length;k++){
      var id = finalShow[k];
      var r=ROOMS[id], libres=freeByRoom[id], pBed=pricePerBed(id,dateIn,dateOut);
      var capMsg='<span class="muted">Disponibles: '+libres.length+'/'+r.cap+' · Precio por cama: R$ '+pBed+' · Noches: '+nights+'</span>';
      var roomDiv=document.createElement('div'); roomDiv.className='room';
      roomDiv.innerHTML='<h3>'+r.name+'</h3><div>'+capMsg+'</div><div class="beds" id="beds-'+id+'"></div>';
      roomsWrap.appendChild(roomDiv); selection[id]=new Set();
      var grid=roomDiv.querySelector('#beds-'+id);
      var occ=new Set((occupied&&occupied[id])||[]);
      for(var b=1;b<=r.cap;b++){
        var btn=document.createElement('button');
        btn.type="button";
        btn.className='bed'+(occ.has(b)?' occupied':'');
        btn.setAttribute('role','button');
        btn.setAttribute('aria-pressed','false');
        btn.setAttribute('tabindex','0');
        btn.textContent=b;
        if(!occ.has(b)){
          (function(roomId,bedId,ref){
            btn.title='Cama '+bedId;
            btn.addEventListener('click',function(){ toggleBed(roomId,bedId,dateIn,dateOut,ref); });
            btn.addEventListener('keydown',function(ev){ if(ev.key==='Enter'||ev.code==='Space'){ ev.preventDefault(); ref.click(); } });
          })(id,b,btn);
        }else{
          btn.disabled = true;
        }
        grid.appendChild(btn);
      }
    }
    refreshTotals(men,women,dateIn,dateOut);
  }

  function toggleBed(roomId,bedId,dateIn,dateOut,btnNode){
    var set=selection[roomId]||new Set();
    if(ROOMS[roomId].femaleOnly && Number(womenEl && womenEl.value||0)<1){
      alert("El cuarto femenino requiere al menos 1 mujer."); return;
    }
    if(set.has(bedId)) set.delete(bedId); else set.add(bedId);
    selection[roomId]=set;
    refreshTotals(Number(menEl && menEl.value||0),Number(womenEl && womenEl.value||0),dateIn,dateOut);
    if(!btnNode || btnNode.classList.contains('occupied')) return;
    if(set.has(bedId)){ btnNode.classList.add('selected'); btnNode.setAttribute('aria-pressed','true'); }
    else { btnNode.classList.remove('selected'); btnNode.setAttribute('aria-pressed','false'); }
  }

  function refreshTotals(men,women,start,end){
    if(!selCountEl || !totalPriceEl || !continueBtn || !suggestBox) return;
    var needed=men+women; var nights=diffNights(start,end);
    var selectedCount=0,total=0,selectedInFemale=0;
    for(var id in selection){
      if(!Object.prototype.hasOwnProperty.call(selection,id)) continue;
      var set=selection[id];
      var size=set.size; selectedCount+=size;
      var pBed=pricePerBed(Number(id),start,end);
      total+=size*pBed*Math.max(1,nights);
      if(ROOMS[id].femaleOnly) selectedInFemale+=size;
    }
    selCountEl.textContent=selectedCount;
    internalTotal = total;
    totalPriceEl.textContent=fmtBRL(total);
    var ok=(selectedCount===needed && needed>0);
    if(selectedInFemale>women) ok=false;
    continueBtn.disabled=!ok;
    suggestBox.style.display= ok ? 'none' : 'block';
    suggestBox.textContent = ok ? '' : ((selectedInFemale>women) ? "El cuarto femenino requiere al menos 1 mujer." : ("Seleccioná exactamente "+needed+" camas."));
  }

  /* ===== handlers ===== */
  function onCheckAvail(){
    if(!dateInEl || !dateOutEl || !menEl || !womenEl || !checkMsg) return;
    var dIn = dateInEl.value;
    var dOut= dateOutEl.value;
    var men = Number(menEl.value||0);
    var women = Number(womenEl.value||0);
    var qty = men + women;
    if(!dIn||!dOut){ checkMsg.innerHTML='<span class="err">Elegí check-in y check-out.</span>'; return; }
    if(dOut<=dIn){ checkMsg.innerHTML='<span class="err">El check-out debe ser posterior al check-in.</span>'; return; }
    if(qty<1){ checkMsg.innerHTML='<span class="err">Indicá al menos 1 huésped.</span>'; return; }
    if(qty>38){ checkMsg.innerHTML='<span class="err">Máximo 38 huéspedes.</span>'; return; }

    checkMsg.textContent='Consultando disponibilidad...';
    var url = AVAILABILITY_ENDPOINT+"?from="+encodeURIComponent(dIn)+"&to="+encodeURIComponent(dOut);
    fetch(url, { headers:{ "Accept":"application/json" }})
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        if(!res.ok || !res.j || res.j.ok!==true) throw new Error('avail_fail');
        renderAvailability(dIn,dOut,men,women,res.j.occupied||{});
        var mods=priceModifiers(dIn,dOut);
        if(modsEl) modsEl.textContent = (mods.tags && mods.tags.length) ? ("Modificadores: "+mods.tags.join(' · ')) : '';
        checkMsg.textContent='Disponibilidad actualizada';
      })
      .catch(function(){ checkMsg.innerHTML='<span class="err">Error consultando disponibilidad.</span>'; });
  }

  function buildOrderBase(){
    var camas=currentSelectionObject();
    var a=dateInEl && dateInEl.value, b=dateOutEl && dateOutEl.value;
    var ms=new Date(b+'T00:00:00')-new Date(a+'T00:00:00');
    var nights=Math.max(1,Math.round(ms/86400000));
    var bookingId=currentHoldId||('BKG-'+Date.now());
    var nombre = (document.querySelector('#reserva-form [name="nombre"]')||{}).value || '';
    var email  = (document.querySelector('#reserva-form [name="email"]') ||{}).value || '';
    var telefono=(document.querySelector('#reserva-form [name="telefono"]')||{}).value || '';
    return {
      bookingId:bookingId,
      nombre:nombre,
      email:email,
      telefono:telefono,
      entrada:a, salida:b,
      hombres:Number(menEl && menEl.value||0), mujeres:Number(womenEl && womenEl.value||0),
      camas:camas, total:internalTotal, nights:nights
    };
  }

  function onContinue(){
    var order=buildOrderBase();
    if(!order.total){ alert("Seleccioná camas primero."); return; }
    var holdPayload={ holdId:order.bookingId, nombre:order.nombre||"HOLD", email:order.email||"", telefono:order.telefono||"", entrada:order.entrada, salida:order.salida, hombres:order.hombres, mujeres:order.mujeres, camas:order.camas, total:order.total };
    fetch(HOLDS_START_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(holdPayload) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
      .then(function(res){
        if(!res.ok || !res.j || res.j.ok!==true) throw new Error(res.j && res.j.error ? res.j.error : 'No se pudo crear HOLD');
        currentHoldId=res.j.holdId||order.bookingId;
        if(formCard) formCard.style.display='block';
        var inEl=document.querySelector('#reserva-form [name="entrada"]');
        var outEl=document.querySelector('#reserva-form [name="salida"]');
        if(inEl) inEl.value=order.entrada;
        if(outEl) outEl.value=order.salida;
        requestAnimationFrame(function(){ window.scrollTo({ top: (formCard?formCard.offsetTop:0)-10, behavior:'smooth' }); });
        toast("Camas reservadas por 10 min (HOLD)");
      })
      .catch(function(e){ alert("Error creando HOLD: "+e.message); });
  }

  function onSimOk(){
    if(payStateEl) payStateEl.textContent="aprobado";
    if(submitBtn) submitBtn.disabled=false;
    window.__simApproved=true;
  }

  function onPayMP(){
    if(!payMPBtn) return;
    if(payMPBtn.__busy) return; payMPBtn.__busy=true; payMPBtn.disabled=true;
    var order=buildOrderBase();
    if(!order.total){ alert("Seleccioná camas primero."); payMPBtn.__busy=false; payMPBtn.disabled=false; return; }
    if(!order.nombre || !order.email){ alert("Completá nombre y email."); payMPBtn.__busy=false; payMPBtn.disabled=false; return; }
    if(!document.getElementById('consentChk')?.checked){ alert("Debes aceptar la política de privacidad."); payMPBtn.__busy=false; payMPBtn.disabled=false; return; }
    fetch(MP_PREFERENCE_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order:{ booking_id:order.bookingId, total:order.total } }) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
      .then(function(res){
        if(!res.ok || !res.j || !res.j.init_point) throw new Error(res.j && res.j.error ? res.j.error : "No se pudo crear preferencia");
        try{ localStorage.setItem('lapa-last-booking', JSON.stringify(order)); }catch(_){}
        window.location.href=res.j.init_point;
      })
      .catch(function(e){ alert("Error iniciando pago (MP): "+e.message); })
      .finally(function(){ payMPBtn.__busy=false; payMPBtn.disabled=false; });
  }

  function onPayStripe(){
    if(!payStripeBtn) return;
    if(payStripeBtn.__busy) return; payStripeBtn.__busy=true; payStripeBtn.disabled=true;
    var order=buildOrderBase();
    if(!order.total){ alert("Seleccioná camas primero."); payStripeBtn.__busy=false; payStripeBtn.disabled=false; return; }
    if(!order.nombre || !order.email){ alert("Completá nombre y email."); payStripeBtn.__busy=false; payStripeBtn.disabled=false; return; }
    if(!document.getElementById('consentChk')?.checked){ alert("Debes aceptar la política de privacidad."); payStripeBtn.__busy=false; payStripeBtn.disabled=false; return; }
    fetch(STRIPE_SESSION_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order:{ booking_id:order.bookingId, total:order.total } }) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
      .then(function(res){
        if(!res.ok || !res.j || !res.j.id) throw new Error(res.j && res.j.error ? res.j.error : "No se pudo crear sesión de Stripe");
        try{ localStorage.setItem('lapa-last-booking', JSON.stringify(order)); }catch(_){}
        var s=getStripe(); if(!s){ alert("Stripe no disponible ahora."); return; }
        return s.redirectToCheckout({ sessionId:res.j.id });
      })
      .then(function(ret){ if(ret && ret.error) throw ret.error; })
      .catch(function(e){ alert("Error iniciando pago (Stripe): "+e.message); })
      .finally(function(){ payStripeBtn.__busy=false; payStripeBtn.disabled=false; });
  }

  function onSubmit(e){
    e.preventDefault();
    if(submitBtn) submitBtn.disabled = true;
    if(!document.getElementById('consentChk')?.checked){ alert("Debes aceptar la política de privacidad."); if(submitBtn) submitBtn.disabled=false; return; }
    var order = buildOrderBase();
    var paidOk = (payStateEl && (payStateEl.textContent||'').toLowerCase().includes("apro")) || window.__simApproved===true;

    function finish(){
      if(!paidOk){ alert("Necesitás completar el pago o usar Simular pago aprobado."); if(submitBtn) submitBtn.disabled=false; return; }
      fetch(HOLDS_CONFIRM_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ holdId:currentHoldId||order.bookingId, status:'paid' }) })
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
        .then(function(res){ if(!res.ok || !res.j || res.j.ok!==true) throw new Error(res.j && res.j.error ? res.j.error : "No se pudo confirmar HOLD"); paidFinal=true; alert("✅ Reserva registrada. Webhooks actualizarán la hoja a 'paid/approved'."); })
        .catch(function(e){ alert("Error confirmando reserva: "+e.message); if(submitBtn) submitBtn.disabled=false; });
    }

    if(order.bookingId && PAY_STATUS_ENDPOINT){
      fetch(PAY_STATUS_ENDPOINT+"?bookingId="+encodeURIComponent(order.bookingId))
        .then(function(rs){ if(!rs.ok) return null; return rs.json(); })
        .then(function(js){ if(js && (js.paid===true || js.status==='approved'||js.status==='paid')) paidOk = true; })
        .finally(finish);
    }else{
      finish();
    }
  }

  /* ===== enganchar eventos con guardas ===== */
  if(checkAvail)  checkAvail.addEventListener('click', onCheckAvail);
  if(continueBtn) continueBtn.addEventListener('click', onContinue);
  if(simulateOkBtn) simulateOkBtn.addEventListener('click', onSimOk);
  if(payMPBtn)     payMPBtn.addEventListener('click', onPayMP);
  if(payStripeBtn) payStripeBtn.addEventListener('click', onPayStripe);
  if(reservaForm)  reservaForm.addEventListener('submit', onSubmit);

  /* ===== liberar HOLD si te vas sin pagar ===== */
  window.addEventListener('beforeunload', function(){
    try{
      if(currentHoldId && !paidFinal){
        var data = new Blob([JSON.stringify({holdId:currentHoldId})], {type:'application/json'});
        navigator.sendBeacon(HOLDS_RELEASE_ENDPOINT, data);
      }
    }catch(_){}
  });

  /* ===== rehidratación (opcional) ===== */
  (function restorePaidState(){
    var p=new URLSearchParams(location.search);
    if(p.get('paid')==='1'){ if(payStateEl) payStateEl.textContent="aprobado"; if(submitBtn) submitBtn.disabled=false; window.__simApproved=true; }
  })();
})();
