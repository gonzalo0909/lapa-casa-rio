class LoadingManager {
  constructor() {
    this.activeLoading = new Set();
    this.globalOverlay = document.getElementById('loadingOverlay');
  }
  
  withLoading(button, asyncFunction, text = 'Procesando...') {
    return this.executeWithLoading(button, asyncFunction, text);
  }
  
  async executeWithLoading(button, asyncFunction, text) {
    const loadingId = this.startButtonLoading(button, text);
    
    try {
      const result = await asyncFunction();
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.stopButtonLoading(button, loadingId);
    }
  }
  
  startButtonLoading(button, text) {
    if (!button) return null;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (btnText && btnLoading) {
      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');
      
      if (text) {
        btnLoading.textContent = text;
      }
    }
    
    button.disabled = true;
    button.classList.add('loading');
    
    const loadingId = `btn-${Date.now()}-${Math.random()}`;
    this.activeLoading.add(loadingId);
    
    return loadingId;
  }
  
  stopButtonLoading(button, loadingId) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (btnText && btnLoading) {
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
    
    button.disabled = false;
    button.classList.remove('loading');
    
    if (loadingId) {
      this.activeLoading.delete(loadingId);
    }
  }
  
  showGlobal(message = 'Procesando...') {
    if (this.globalOverlay) {
      const messageEl = this.globalOverlay.querySelector('p');
      if (messageEl) {
        messageEl.textContent = message;
      }
      this.globalOverlay.classList.remove('hidden');
    }
  }
  
  hideGlobal() {
    if (this.globalOverlay) {
      this.globalOverlay.classList.add('hidden');
    }
  }
  
  async withGlobal(asyncFunction, message) {
    this.showGlobal(message);
    try {
      return await asyncFunction();
    } finally {
      this.hideGlobal();
    }
  }
  
  clearAll() {
    // Stop all button loading
    document.querySelectorAll('button.loading').forEach(btn => {
      this.stopButtonLoading(btn);
    });
    
    this.hideGlobal();
    this.activeLoading.clear();
  }
}

window.loadingManager = new LoadingManager();
