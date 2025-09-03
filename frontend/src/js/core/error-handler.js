class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.setupGlobalHandling();
  }
  
  setupGlobalHandling() {
    window.addEventListener('error', (event) => {
      this.logError('Global Error', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise', event.reason);
      event.preventDefault();
    });
  }
  
  logError(type, error, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message: error?.message || error,
      stack: error?.stack,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    this.errorLog.push(entry);
    
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    console.error(`[${type}]`, entry);
    
    // Send to monitoring service in production
    if (window.HOSTEL_CONFIG && !window.HOSTEL_CONFIG.FEATURES.DEBUG_MODE) {
      this.reportError(entry);
    }
  }
  
  async reportError(errorEntry) {
    try {
      // Send to error reporting service
      if (window.apiClient) {
        await window.apiClient.makeRequest('/errors', {
          method: 'POST',
          body: JSON.stringify(errorEntry)
        });
      }
    } catch (e) {
      console.warn('Failed to report error:', e);
    }
  }
  
  handleError(error, context = '', userMessage = null) {
    this.logError('Handled Error', error, { context });
    
    const message = userMessage || this.getErrorMessage(error);
    
    if (window.toastManager) {
      window.toastManager.showError(message);
    }
  }
  
  getErrorMessage(error) {
    if (!error) return 'Error desconocido';
    
    const message = error.message || error;
    
    if (message.includes('fetch') || message.includes('network')) {
      return 'Error de conexión. Verifica tu internet.';
    }
    
    if (message.includes('timeout')) {
      return 'La operación tardó demasiado. Intenta de nuevo.';
    }
    
    if (message.includes('validation')) {
      return 'Datos inválidos. Revisa la información.';
    }
    
    if (message.includes('unauthorized') || message.includes('403')) {
      return 'No tienes permisos para esta acción.';
    }
    
    if (message.includes('404')) {
      return 'Recurso no encontrado.';
    }
    
    if (message.includes('500')) {
      return 'Error del servidor. Intenta más tarde.';
    }
    
    return 'Error inesperado. Intenta de nuevo.';
  }
  
  async withErrorHandling(asyncFunction, context = '') {
    try {
      return await asyncFunction();
    } catch (error) {
      this.handleError(error, context);
      throw error;
    }
  }
  
  getErrorLog() {
    return [...this.errorLog];
  }
  
  clearLog() {
    this.errorLog = [];
  }
}

window.errorHandler = new ErrorHandler();
