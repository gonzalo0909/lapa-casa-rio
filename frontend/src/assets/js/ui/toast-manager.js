class ToastManager {
  constructor() {
    this.container = this.createContainer();
    this.maxToasts = 4;
    this.activeToasts = new Set();
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
      const closeBtn = document.getElementById('closeError');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          errorToast.classList.add('hidden');
        });
      }
    }
    
    if (successToast) {
      const closeBtn = document.getElementById('closeSuccess');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          successToast.classList.add('hidden');
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
    closeBtn.addEventListener('click', () => {
      this.remove(toast);
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
        }
      }, 300);
    }
  }
  
  limitToasts() {
    if (this.activeToasts.size > this.maxToasts) {
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
}

window.toastManager = new ToastManager();
