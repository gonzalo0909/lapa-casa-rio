class HostelAPIClient {
  constructor() {
    this.config = window.HOSTEL_CONFIG;
    this.baseURL = this.config?.API_BASE || '/api';
    this.isOnline = navigator.onLine;
    this.rateLimiter = window.rateLimiter;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.setupConnectionMonitoring();
  }
  
  setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🔡 Conexión restaurada');
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔡 Sin conexión');
    });
  }
  
  async makeRequest(endpoint, options = {}) {
    const endpointType = this.getEndpointType(endpoint);
    
    if (this.rateLimiter) {
      const rateCheck = this.rateLimiter.canRequest(endpointType);
      if (!rateCheck.allowed) {
        throw new Error(`Rate limit: espera ${Math.ceil(rateCheck.waitTime / 1000)}s`);
      }
    }
    
    if (!this.isOnline) {
      return this.queueRequest(endpoint, options);
    }
    
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 15000
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
    
    try {
      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('La petición tardó demasiado tiempo');
      }
      
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }
  
  getEndpointType(endpoint) {
    if (endpoint.includes('/availability')) return 'availability';
    if (endpoint.includes('/bookings')) return 'booking';
    if (endpoint.includes('/admin')) return 'admin';
    return 'default';
  }
  
  async queueRequest(endpoint, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        endpoint,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      if (this.requestQueue.length > 10) {
        const oldest = this.requestQueue.shift();
        oldest.reject(new Error('Request queue overflow'));
      }
    });
  }
  
  async processQueue() {
    if (this.isProcessingQueue || !this.isOnline) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0 && this.isOnline) {
      const request = this.requestQueue.shift();
      try {
        const result = await this.makeRequest(request.endpoint, request.options);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessingQueue = false;
  }
  
  async checkAvailability(data) {
    return this.makeRequest('/availability', {
      method: 'POST',
      body: JSON.stringify({
        dateIn: data.dateIn,
        dateOut: data.dateOut,
        guests: data.guests
      })
    });
  }
  
  async createBooking(data) {
    return this.makeRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async createHold(data) {
    return this.makeRequest('/holds', {
      method: 'POST',
      body: JSON.stringify({
        beds: data.beds,
        guestInfo: data.guestInfo,
        expiresIn: this.config?.HOLD_TIMEOUT_MINUTES * 60 || 180
      })
    });
  }
  
  async createMercadoPagoPayment(data) {
    return this.makeRequest('/payments/mercadopago', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async createStripePayment(data) {
    return this.makeRequest('/payments/stripe', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async createPixPayment(data) {
    return this.makeRequest('/payments/pix', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async verifyPayment(paymentId) {
    return this.makeRequest(`/payments/${paymentId}/verify`);
  }
  
  async adminHealth(token) {
    return this.makeRequest('/admin/health', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Admin-Token': token
      }
    });
  }
  
  async adminHolds(token) {
    return this.makeRequest('/admin/holds', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Admin-Token': token
      }
    });
  }
  
  async adminBookings(token, filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([_, value]) => value)
    );
    
    return this.makeRequest(`/admin/bookings?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Admin-Token': token
      }
    });
  }
  
  async testConnection() {
    try {
      const start = Date.now();
      await this.makeRequest('/health');
      const latency = Date.now() - start;
      
      return {
        online: true,
        latency,
        status: latency < 1000 ? 'excellent' : latency < 3000 ? 'good' : 'slow'
      };
    } catch (error) {
      return {
        online: false,
        error: error.message
      };
    }
  }
  
  getQueueStatus() {
    return {
      queued: this.requestQueue.length,
      processing: this.isProcessingQueue,
      online: this.isOnline
    };
  }
  
  clearQueue() {
    this.requestQueue.forEach(req => {
      req.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
  }
}

window.apiClient = new HostelAPIClient();

window.addEventListener('load', async () => {
  const status = await window.apiClient.testConnection();
  console.log('🔡 Estado API:', status);
  
  if (!status.online && window.toastManager) {
    window.toastManager.showWarning('Modo sin conexión activo');
  }
});
