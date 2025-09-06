class ToastManager {
  constructor() {
    this.container = this.createContainer();
    this.maxToasts = 4;
    this.activeToasts = new Set();
    this.eventListeners = new Map();
    this.setupStaticToasts();
  }
  
  createContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }
  
  setupStaticToasts() {
    const errorToast = document.getElementById('errorToast');
    const successToast = document.getElementById('successToast');
    
    if (errorToast) {
      const closeHandler = () => errorToast.classList.add('hidden');
      const closeBtn = document.getElementById('closeError');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeHandler);
        this.eventListeners.set('closeError', {
          element: closeBtn,
          event: 'click',
          handler: closeHandler
        });
      }
    }
    
    if (successToast) {
      const closeHandler = () => successToast.classList.add('hidden');
      const closeBtn = document.getElementById('closeSuccess');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeHandler);
        this.eventListeners.set('closeSuccess', {
          element: closeBtn,
          event: 'click',
          handler: closeHandler
        });
      }
    }
  }
  
  showError(message, duration = 5000) {
    return this.show('error', message, duration);
  }
  
  showSuccess(message, duration = 3000) {
    return this.show('success', message, duration);
  }
  
  showWarning(message, duration = 4000) {
    return this.show('warning', message, duration);
  }
  
  showInfo(message, duration = 3000) {
    return this.show('info', message, duration);
  }
  
  show(type, message, duration) {
    if (this.tryStaticToast(type, message, duration)) {
      return;
    }
    
    const toast = this.createToast(type, message);
    this.container.appendChild(toast);
    this.activeToasts.add(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast);
      }, duration);
    }
    
    this.limitToasts();
    
    return toast;
  }
  
  tryStaticToast(type, message, duration) {
    let toastEl, messageEl;
    
    if (type === 'error') {
      toastEl = document.getElementById('errorToast');
      messageEl = document.getElementById('errorMessage');
    } else if (type === 'success') {
      toastEl = document.getElementById('successToast');
      messageEl = document.getElementById('successMessage');
    }
    
    if (toastEl && messageEl) {
      messageEl.textContent = message;
      toastEl.classList.remove('hidden');
      
      if (duration > 0) {
        setTimeout(() => {
          toastEl.classList.add('hidden');
        }, duration);
      }
      
      return true;
    }
    
    return false;
  }
  
  createToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      error: '❌',
      success: '✅',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icons[type] || ''}</span>
        <span class="toast-message">${message}</span>
      </div>
      <button class="toast-close">&times;</button>
    `;
    
    const closeBtn = toast.querySelector('.toast-close');
    const closeHandler = () => this.remove(toast);
    closeBtn.addEventListener('click', closeHandler);
    
    this.eventListeners.set(`toast-${Date.now()}`, {
      element: closeBtn,
      event: 'click',
      handler: closeHandler
    });
    
    return toast;
  }
  
  remove(toast) {
    if (toast.parentNode) {
      toast.classList.remove('show');
      toast.classList.add('hide');
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
          this.activeToasts.delete(toast);
          
          this.cleanupToastListeners(toast);
        }
      }, 300);
    }
  }
  
  cleanupToastListeners(toast) {
    const toastListeners = [];
    this.eventListeners.forEach((listener, key) => {
      if (key.startsWith('toast-')) {
        const closeBtn = toast.querySelector('.toast-close');
        if (listener.element === closeBtn) {
          toastListeners.push(key);
        }
      }
    });
    
    toastListeners.forEach(key => {
      const listener = this.eventListeners.get(key);
      if (listener) {
        listener.element.removeEventListener(listener.event, listener.handler);
        this.eventListeners.delete(key);
      }
    });
  }
  
  limitToasts() {
    while (this.activeToasts.size > this.maxToasts) {
      const oldest = this.activeToasts.values().next().value;
      this.remove(oldest);
    }
  }
  
  clear() {
    this.activeToasts.forEach(toast => {
      this.remove(toast);
    });
    
    const errorToast = document.getElementById('errorToast');
    const successToast = document.getElementById('successToast');
    
    if (errorToast) errorToast.classList.add('hidden');
    if (successToast) successToast.classList.add('hidden');
  }
  
  showTemporary(type, message, duration = 2000) {
    const toast = this.show(type, message, 0);
    
    setTimeout(() => {
      this.remove(toast);
    }, duration);
    
    return toast;
  }
  
  showPersistent(type, message) {
    return this.show(type, message, 0);
  }
  
  updateToast(toast, newMessage) {
    if (!toast) return;
    
    const messageEl = toast.querySelector('.toast-message');
    if (messageEl) {
      messageEl.textContent = newMessage;
    }
  }
  
  getActiveCount() {
    return this.activeToasts.size;
  }
  
  destroy() {
    this.clear();
    
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

window.toastManager = new ToastManager();
