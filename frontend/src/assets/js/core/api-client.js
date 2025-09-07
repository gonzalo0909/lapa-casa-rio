class HostelAPIClient {
  constructor() {
    this.config = window.HOSTEL_CONFIG;
    this.baseURL = this.config?.API_BASE || '/api';
    this.isOnline = navigator.onLine;
    this.setupConnectionMonitoring();
  }
  setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('📡 Conexión restaurada');
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📡 Sin conexión');
    });
  }
  async makeRequest(endpoint, options = {}) {
    if (!this.isOnline) {
      throw new Error('Sin conexión a internet');
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
}
window.apiClient = new HostelAPIClient();
window.addEventListener('load', async () => {
  const status = await window.apiClient.testConnection();
  console.log('📡 Estado API:', status);
  if (!status.online) {
    window.toastManager?.showWarning('Modo sin conexión activo');
  }
});
