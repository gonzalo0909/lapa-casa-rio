// frontend/src/components/booking/hostel-engine.types.ts
// Tipos TypeScript · Traducciones PT/ES/EN · DEFAULT_ROOMS · DAY_LBL · MON_LBL

// ─── Tipos base ─────────────────────────────────────────
export type Lang = 'pt' | 'es' | 'en';
export type Phase = 'wizard' | 'success' | 'expired';
export type PayMethod = 'pix' | 'card';

export interface RoomDef {
  id: string;
  realId?: string;
  name: string;
  type: 'mixed' | 'female';
  capacity: number;
  available: number;
  price: number;
  isFlexible: boolean;
}

export interface FormState {
  name: string;
  email: string;
  email2: string;
  phone: string;
  country: string;
  doc: string;
  arrival: string;
  requests: string;
}

export interface FormErrors {
  name?: string;
  email?: string;
  email2?: string;
  phone?: string;
  country?: string;
  doc?: string;
  arrival?: string;
}

// ─── Traducciones ────────────────────────────────────────
export const T = {
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
    rulesTitle:'Regras da casa',
    rule1:'Check-in: 14h–22h. Fora do horário, avisar com antecedência.',
    rule2:'Check-out: até 11h. Late check-out sujeito à disponibilidade.',
    rule3:'Documento de identidade obrigatório no check-in.',
    rule4:'Hospedagem permitida a partir de 18 anos.',
    rule5:'Proibido fumar dentro do hostel.',
    cancelBtn:'Política de cancelamento',
    cancelFree:'Grátis',cancelFreeText:'Cancele até 48 horas antes do check-in — reembolso integral do depósito.',
    cancelNo:'Não reembolsável',cancelNoText:'Cancelamento nas últimas 48 horas ou no-show — depósito retido.',
    p4title:'Resumo da reserva',p4sub:'Revise antes de confirmar',
    sumDatesHead:'Datas e Quartos',sumPriceHead:'Preço',sumGuestHead:'Hóspede',
    pmPix:'PIX',pmPixApproval:'Aprovação imediata',pmCard:'Cartão de crédito',
    btnConfirm:'Confirmar reserva',btnWhatsApp:'Confirmar por WhatsApp',
    successTitle:'Reserva confirmada!',successSub:'Enviamos os detalhes por e-mail e WhatsApp',
    pixDepLabel:'Depósito PIX',cardDepLabel:'Pagamento com cartão',
    cardInstruction:'Você receberá o link de pagamento por e-mail.',
    timerLabel:'Expira em',pixKey:'Chave PIX: lapalandiarj@gmail.com',
    restNote:'O restante (70%) é pago no check-in, em dinheiro ou cartão.',
    btnNewBooking:'Nova reserva',
    expiredTitle:'Reserva não concluída',expiredSub:'O tempo expirou. As vagas foram liberadas.',
    btnTryAgain:'Tentar novamente',
    priceBase:'Base por noite',btnBack:'Voltar',btnNext:'Próximo',
    discountActive:'Desconto de grupo ativo!',
    flexibleNotice:'Cuarto 6 — Solo Mujeres: quarto feminino por padrão. Converte para misto 48h antes do check-in se necessário.',
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
    rulesTitle:'Normas de la casa',
    rule1:'Check-in: 14h–22h. Fuera del horario, avisar con anticipación.',
    rule2:'Check-out: hasta 11h. Late check-out sujeto a disponibilidad.',
    rule3:'Documento de identidad obligatorio en el check-in.',
    rule4:'Hospedaje permitido a partir de 18 años.',
    rule5:'Prohibido fumar dentro del hostel.',
    cancelBtn:'Política de cancelación',
    cancelFree:'Gratis',cancelFreeText:'Cancela hasta 48 horas antes del check-in — reembolso total del depósito.',
    cancelNo:'No reembolsable',cancelNoText:'Cancelación en las últimas 48 horas o no-show — depósito retenido.',
    p4title:'Resumen de la reserva',p4sub:'Revisa antes de confirmar',
    sumDatesHead:'Fechas y Cuartos',sumPriceHead:'Precio',sumGuestHead:'Huésped',
    pmPix:'PIX',pmPixApproval:'Aprobación inmediata',pmCard:'Tarjeta de crédito',
    btnConfirm:'Confirmar reserva',btnWhatsApp:'Confirmar por WhatsApp',
    successTitle:'¡Reserva confirmada!',successSub:'Te enviamos los detalles por e-mail y WhatsApp',
    pixDepLabel:'Depósito PIX',cardDepLabel:'Pago con tarjeta',
    cardInstruction:'Recibirás el enlace de pago por e-mail.',
    timerLabel:'Expira en',pixKey:'Clave PIX: lapalandiarj@gmail.com',
    restNote:'El resto (70%) se paga en el check-in, en efectivo o tarjeta.',
    btnNewBooking:'Nueva reserva',
    expiredTitle:'Reserva no concretada',expiredSub:'El tiempo expiró. Los espacios fueron liberados.',
    btnTryAgain:'Intentar de nuevo',
    priceBase:'Base por noche',btnBack:'Volver',btnNext:'Siguiente',
    discountActive:'¡Descuento de grupo activo!',
    flexibleNotice:'Cuarto 6 — Solo Mujeres: habitación femenina por defecto. Se convierte a mixto 48h antes del check-in si es necesario.',
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
    rulesTitle:'House rules',
    rule1:'Check-in: 2 pm–10 pm. Outside these hours, notify in advance.',
    rule2:'Check-out: by 11 am. Late check-out subject to availability.',
    rule3:'ID required at check-in.',
    rule4:'Guests must be 18 or older.',
    rule5:'Smoking inside the hostel is not allowed.',
    cancelBtn:'Cancellation policy',
    cancelFree:'Free',cancelFreeText:'Cancel up to 48 hours before check-in — full deposit refund.',
    cancelNo:'Non-refundable',cancelNoText:'Cancellation within 48 hours or no-show — deposit forfeited.',
    p4title:'Booking summary',p4sub:'Review before confirming',
    sumDatesHead:'Dates & Rooms',sumPriceHead:'Price',sumGuestHead:'Guest',
    pmPix:'PIX',pmPixApproval:'Instant approval',pmCard:'Credit card',
    btnConfirm:'Confirm booking',btnWhatsApp:'Confirm via WhatsApp',
    successTitle:'Booking confirmed!',successSub:'We sent the details to your email and WhatsApp',
    pixDepLabel:'PIX deposit',cardDepLabel:'Card payment',
    cardInstruction:'You will receive the payment link by email.',
    timerLabel:'Expires in',pixKey:'PIX key: lapalandiarj@gmail.com',
    restNote:'The remaining 70% is due at check-in, in cash or by card.',
    btnNewBooking:'New booking',
    expiredTitle:'Booking not completed',expiredSub:'Time expired. The beds have been released.',
    btnTryAgain:'Try again',
    priceBase:'Base per night',btnBack:'Back',btnNext:'Next',
    discountActive:'Group discount active!',
    flexibleNotice:'Room 6 — Women Only: female dorm by default. Converts to mixed 48h before check-in if needed.',
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

export type Translations = typeof T[Lang];

// ─── Cuartos por defecto (fallback si la API no responde) ─
export const DEFAULT_ROOMS: RoomDef[] = [
  { id:'cuarto1', name:'Cuarto 1', type:'mixed',  capacity:12, available:12, price:85, isFlexible:false },
  { id:'cuarto3', name:'Cuarto 3', type:'mixed',  capacity:12, available:12, price:85, isFlexible:false },
  { id:'cuarto4', name:'Cuarto 4', type:'mixed',  capacity:7,  available:7,  price:85, isFlexible:false },
  { id:'cuarto5', name:'Cuarto 5', type:'mixed',  capacity:7,  available:7,  price:85, isFlexible:false },
  { id:'cuarto6', name:'Cuarto 6', type:'female', capacity:7,  available:7,  price:85, isFlexible:true  },
];

// ─── Labels de calendario ─────────────────────────────────
export const DAY_LBL: Record<Lang, string[]> = {
  pt:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
  es:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};

export const MON_LBL: Record<Lang, string[]> = {
  pt:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
};
