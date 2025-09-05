(function() {
  'use strict';
  
  const isProduction = !window.location.hostname.includes('localhost') && 
                      !window.location.hostname.includes('127.0.0.1');
  
  window.HOSTEL_CONFIG = {
    API_BASE: isProduction 
      ? 'https://lapacasahostel.com/api' 
      : 'http://localhost:3001/api',
    
    PRICE_PER_NIGHT: 55,
    TOTAL_CAPACITY: 38,
    ROOMS: { 1: 12, 3: 12, 5: 7, 6: 7 },
    HOLD_TIMEOUT_MINUTES: 3,
    
    STRIPE_PUBLISHABLE_KEY: isProduction 
      ? 'pk_live_REAL_AQUI'
      : 'pk_test_TU_CLAVE_TEST_AQUI',
    MERCADO_PAGO_PUBLIC_KEY: isProduction
      ? 'APP_USR_REAL_AQUI'
      : 'TEST-CLAVE_TEST_AQUI',
    
    FEATURES: {
      OFFLINE_MODE: !isProduction,
      DEBUG_MODE: !isProduction,
      ADMIN_PANEL: true,
      PAYMENT_TESTING: !isProduction
    },
    
    SECURITY: {
      MAX_REQUESTS_PER_MINUTE: 10,
      ADMIN_TOKEN_MIN_LENGTH: 16,
      FORM_TIMEOUT_MINUTES: 15,
      ENFORCE_HTTPS: isProduction
    }
  };
  
  function validateConfig() {
    const config = window.HOSTEL_CONFIG;
    
    if (!isProduction) {
      console.log('🔧 Config loaded:', {
        env: isProduction ? 'prod' : 'dev',
        api: config.API_BASE,
        features: Object.keys(config.FEATURES).length
      });
    }
    
    window.dispatchEvent(new CustomEvent('hostelConfigReady', { detail: config }));
  }
  
  document.addEventListener('DOMContentLoaded', validateConfig);
  window.hostelConfig = window.HOSTEL_CONFIG;
})();
