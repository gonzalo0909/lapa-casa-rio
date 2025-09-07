class LoadingManager {
  constructor() {
    this.activeLoading = new Set();
    this.globalOverlay = document.getElementById('loadingOverlay');
    this.eventListeners = new Map();
    this.setupGlobalHandlers();
  }
  
  setupGlobalHandlers() {
    const visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.clearAll();
      }
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);
    this.eventListeners.set('visibilitychange', {
      element: document,
      event: 'visibilitychange',
      handler: visibilityHandler
    });
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
    
    const existingId = button.dataset.loadingId;
    if (existingId && this.activeLoading.has(existingId)) {
      return existingId;
    }
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (btnText && btnLoading) {
      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');
      
      if (text) {
        btnLoading.textContent = text;
      }
    } else {
      button.setAttribute('data-original-text', button.textContent);
      button.innerHTML = `<span class="spinner-dots"></span> ${text}`;
    }
    
    button.disabled = true;
    button.classList.add('loading');
    
    const loadingId = `btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    button.dataset.loadingId = loadingId;
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
    } else {
      const originalText = button.getAttribute('data-original-text');
      if (originalText) {
        button.textContent = originalText;
        button.removeAttribute('data-original-text');
      }
    }
    
    button.disabled = false;
    button.classList.remove('loading');
    
    if (loadingId) {
      this.activeLoading.delete(loadingId);
      delete button.dataset.loadingId;
    }
  }
  
  showGlobal(message = 'Procesando...') {
    if (this.globalOverlay) {
      const messageEl = this.globalOverlay.querySelector('p');
      if (messageEl) {
        messageEl.textContent = message;
      }
      this.globalOverlay.classList.remove('hidden');
      this.globalOverlay.setAttribute('aria-hidden', 'false');
    }
  }
  
  hideGlobal() {
    if (this.globalOverlay) {
      this.globalOverlay.classList.add('hidden');
      this.globalOverlay.setAttribute('aria-hidden', 'true');
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
  
  setButtonState(button, state, text = '') {
    if (!button) return;
    
    switch (state) {
      case 'loading':
        this.startButtonLoading(button, text);
        break;
      case 'success':
        this.setButtonSuccess(button, text);
        break;
      case 'error':
        this.setButtonError(button, text);
        break;
      case 'normal':
      default:
        this.stopButtonLoading(button);
        break;
    }
  }
  
  setButtonSuccess(button, text = 'Completado') {
    if (!button) return;
    
    this.stopButtonLoading(button);
    button.classList.add('success');
    
    const originalText = button.textContent;
    button.textContent = text;
    
    setTimeout(() => {
      button.classList.remove('success');
      button.textContent = originalText;
    }, 2000);
  }
  
  setButtonError(button, text = 'Error') {
    if (!button) return;
    
    this.stopButtonLoading(button);
    button.classList.add('error');
    
    const originalText = button.textContent;
    button.textContent = text;
    
    setTimeout(() => {
      button.classList.remove('error');
      button.textContent = originalText;
    }, 3000);
  }
  
  createSkeletonLoader(container, rows = 3) {
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.add('skeleton-container');
    
    for (let i = 0; i < rows; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-item loading-skeleton';
      skeleton.style.height = '20px';
      skeleton.style.marginBottom = '10px';
      skeleton.style.borderRadius = '4px';
      container.appendChild(skeleton);
    }
  }
  
  removeSkeletonLoader(container) {
    if (!container) return;
    
    container.classList.remove('skeleton-container');
    const skeletons = container.querySelectorAll('.skeleton-item');
    skeletons.forEach(skeleton => skeleton.remove());
  }
  
  isLoading(element) {
    if (!element) return false;
    
    const loadingId = element.dataset.loadingId;
    return loadingId && this.activeLoading.has(loadingId);
  }
  
  getActiveLoadingCount() {
    return this.activeLoading.size;
  }
  
  clearAll() {
    document.querySelectorAll('button.loading').forEach(btn => {
      this.stopButtonLoading(btn);
    });
    
    this.hideGlobal();
    this.activeLoading.clear();
    
    document.querySelectorAll('.skeleton-container').forEach(container => {
      this.removeSkeletonLoader(container);
    });
  }
  
  destroy() {
    this.clearAll();
    
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
  }
}

window.loadingManager = new LoadingManager();
