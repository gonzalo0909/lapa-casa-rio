class PaymentIntegration {
  constructor() {
    this.stripe = null;
    this.mercadoPago = null;
    this.config = window.HOSTEL_CONFIG || {};
    
    this.paymentMethods = {
      mercadopago: { enabled: false, ready: false },
      stripe: { enabled: false, ready: false },
      pix: { enabled: true, ready: true }
    };
    
    this.init();
  }
  
  async init() {
    try {
      await this.initializeStripe();
      await this.initializeMercadoPago();
      this.setupPaymentButtons();
    } catch (error) {
      console.error('Payment integration error:', error);
    }
  }
  
  async initializeStripe() {
    try {
      if (window.Stripe && this.config.STRIPE_PUBLISHABLE_KEY) {
        this.stripe = window.Stripe(this.config.STRIPE_PUBLISHABLE_KEY);
        this.paymentMethods.stripe.enabled = true;
        this.paymentMethods.stripe.ready = true;
      }
    } catch (error) {
      console.error('Stripe initialization error:', error);
    }
  }
  
  async initializeMercadoPago() {
    try {
      if (window.MercadoPago && this.config.MERCADO_PAGO_PUBLIC_KEY) {
        this.mercadoPago = new window.MercadoPago(this.config.MERCADO_PAGO_PUBLIC_KEY);
        this.paymentMethods.mercadopago.enabled = true;
        this.paymentMethods.mercadopago.ready = true;
      }
    } catch (error) {
      console.error('Mercado Pago initialization error:', error);
    }
  }
  
  setupPaymentButtons() {
    const mpButton = document.getElementById('payMP');
    if (mpButton) {
      mpButton.disabled = !this.paymentMethods.mercadopago.ready;
      mpButton.addEventListener('click', () => this.processMercadoPago());
    }
    
    const stripeButton = document.getElementById('payStripe');
    if (stripeButton) {
      stripeButton.disabled = !this.paymentMethods.stripe.ready;
      stripeButton.addEventListener('click', () => this.processStripe());
    }
    
    const pixButton = document.getElementById('payPix');
    if (pixButton) {
      pixButton.addEventListener('click', () => this.processPixDirect());
    }
  }
  
  async processMercadoPago() {
    try {
      if (!this.mercadoPago) {
        throw new Error('Mercado Pago no disponible');
      }
      
      const paymentData = this.getPaymentData();
      
      window.loadingManager?.showGlobal('Conectando con Mercado Pago...');
      
      const preferenceResponse = await window.apiClient.createMercadoPagoPayment({
        amount: paymentData.amount,
        currency: paymentData.currency,
        description: paymentData.description,
        customer: paymentData.customer,
        holdId: window.stateManager?.getHoldId(),
        items: [{
          title: `Lapa Casa Hostel - ${paymentData.guests} huéspedes`,
          quantity: paymentData.nights,
          unit_price: paymentData.amount / paymentData.nights,
          currency_id: 'BRL'
        }],
        back_urls: {
          success: `${window.location.origin}/?payment_status=success&method=mercadopago`,
          failure: `${window.location.origin}/?payment_status=failure&method=mercadopago`,
          pending: `${window.location.origin}/?payment_status=pending&method=mercadopago`
        },
        auto_return: 'approved'
      });
      
      if (preferenceResponse.init_point) {
        window.location.href = preferenceResponse.init_point;
      } else {
        throw new Error('No se pudo crear la preferencia de pago');
      }
      
    } catch (error) {
      window.toastManager?.showError(`Error Mercado Pago: ${error.message}`);
    } finally {
      window.loadingManager?.hideGlobal();
    }
  }
  
  async processStripe() {
    try {
      if (!this.stripe) {
        throw new Error('Stripe no disponible');
      }
      
      const paymentData = this.getPaymentData();
      
      window.loadingManager?.showGlobal('Conectando con Stripe...');
      
      const sessionResponse = await window.apiClient.createStripePayment({
        amount: Math.round(paymentData.amount * 100),
        currency: 'brl',
        description: paymentData.description,
        customer_email: paymentData.customer.email,
        holdId: window.stateManager?.getHoldId(),
        success_url: `${window.location.origin}/?payment_status=success&method=stripe`,
        cancel_url: `${window.location.origin}/?payment_status=cancelled&method=stripe`
      });
      
      if (sessionResponse.sessionId) {
        const { error } = await this.stripe.redirectToCheckout({
          sessionId: sessionResponse.sessionId
        });
        
        if (error) {
          throw new Error(error.message);
        }
      } else {
        throw new Error('No se pudo crear la sesión de pago');
      }
      
    } catch (error) {
      window.toastManager?.showError(`Error Stripe: ${error.message}`);
    } finally {
      window.loadingManager?.hideGlobal();
    }
  }
  
  async processPixDirect() {
    try {
      const paymentData = this.getPaymentData();
      
      window.loadingManager?.showGlobal('Generando código Pix...');
      
      const pixResponse = await window.apiClient.createPixPayment({
        amount: paymentData.amount,
        description: paymentData.description,
        customer: paymentData.customer,
        holdId: window.stateManager?.getHoldId()
      });
      
      if (pixResponse.qr_code) {
        this.showPixModal(pixResponse.qr_code, pixResponse.qr_code_base64, paymentData.amount, pixResponse.payment_id);
      } else {
        throw new Error('No se pudo generar el código Pix');
      }
      
    } catch (error) {
      window.toastManager?.showError(`Error Pix: ${error.message}`);
    } finally {
      window.loadingManager?.hideGlobal();
    }
  }
  
  getPaymentData() {
    const dateValidator = window.dateValidator;
    const stateManager = window.stateManager;
    const formValidator = window.formValidator;
    
    const searchCriteria = stateManager?.getSearchCriteria();
    const selectedBeds = stateManager?.getSelectedBeds();
    const formData = formValidator?.getData();
    
    const nights = dateValidator?.getNights() || 1;
    const guests = (searchCriteria?.men || 0) + (searchCriteria?.women || 0);
    const basePrice = window.HOSTEL_CONFIG?.PRICE_PER_NIGHT || 55;
    
    let totalAmount = 0;
    if (selectedBeds && selectedBeds.length > 0) {
      selectedBeds.forEach(bed => {
        const roomPrice = bed.room === '6' ? 60 : basePrice;
        totalAmount += roomPrice * nights;
      });
    } else {
      totalAmount = guests * nights * basePrice;
    }
    
    return {
      amount: totalAmount,
      currency: 'BRL',
      guests,
      nights,
      dateIn: searchCriteria?.dateIn,
      dateOut: searchCriteria?.dateOut,
      beds: selectedBeds,
      customer: {
        name: formData?.nome,
        email: formData?.email,
        phone: formData?.telefono
      },
      description: `Lapa Casa Hostel - ${guests} huéspedes, ${nights} noches`
    };
  }
  
  showPixModal(pixCode, qrCodeBase64, amount, paymentId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Pagamento via Pix</h3>
        <div class="qr-code">
          ${qrCodeBase64 ? 
            `<img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code Pix" style="max-width: 200px;">` :
            '<div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin: 0 auto;"><span>QR Code Pix</span></div>'
          }
        </div>
        <p><strong>Valor:</strong> R$ ${amount.toFixed(2)}</p>
        <p><strong>Código Pix (Copia e Cola):</strong></p>
        <textarea readonly style="width: 100%; height: 60px; font-size: 12px;" onclick="this.select()">${pixCode}</textarea>
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="window.paymentIntegration.checkPixPayment('${paymentId}')">Verificar Pagamento</button>
        </div>
        <p style="margin-top: 10px; font-size: 0.875rem; color: #666; text-align: center;">
          Após o pagamento, clique em "Verificar Pagamento"
        </p>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
  
  async checkPixPayment(paymentId) {
    try {
      window.loadingManager?.showGlobal('Verificando pagamento...');
      
      const verification = await window.apiClient.verifyPayment(paymentId);
      
      if (verification.status === 'approved') {
        document.querySelector('.modal')?.remove();
        this.handlePaymentSuccess('pix', paymentId);
      } else if (verification.status === 'pending') {
        window.toastManager?.showInfo('Pagamento ainda não confirmado. Aguarde alguns segundos e tente novamente.');
      } else {
        window.toastManager?.showError('Pagamento não encontrado ou rejeitado.');
      }
      
    } catch (error) {
      window.toastManager?.showError(`Erro ao verificar pagamento: ${error.message}`);
    } finally {
      window.loadingManager?.hideGlobal();
    }
  }
  
  handlePaymentSuccess(method, transactionId) {
    const payStateEl = document.getElementById('payState');
    if (payStateEl) {
      payStateEl.textContent = 'Aprovado';
      payStateEl.className = 'status-value paid';
    }
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
    
    window.timerManager?.clearAll();
    
    if (window.stateManager) {
      window.stateManager.setPaymentInfo({
        method,
        transactionId,
        status: 'completed',
        timestamp: Date.now()
      });
    }
    
    window.toastManager?.showSuccess(`Pagamento ${method} aprovado!`);
  }
  
  handlePaymentFailure(method, error) {
    const payStateEl = document.getElementById('payState');
    if (payStateEl) {
      payStateEl.textContent = 'Falhou';
      payStateEl.className = 'status-value failed';
    }
    
    window.toastManager?.showError(`Pagamento ${method} falhou: ${error}`);
  }
  
  getPaymentStatus() {
    return {
      methods: this.paymentMethods,
      stripe: !!this.stripe,
      mercadoPago: !!this.mercadoPago
    };
  }
  
  destroy() {
    this.stripe = null;
    this.mercadoPago = null;
  }
}

window.paymentIntegration = new PaymentIntegration();
