class ProgressManager {
  constructor() {
    this.timerManager = window.timerManager;
    this.stateManager = window.stateManager;
    this.progressFill = document.getElementById('progressFill');
    this.totalSteps = 3;
    this.currentProgress = 0;
    this.animationDuration = 300;
    this.eventListeners = new Map();
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const stateChangeHandler = (event) => {
      if (event.detail?.step) {
        this.update();
      }
    };
    
    document.addEventListener('stateChange', stateChangeHandler);
    this.eventListeners.set('stateChange', {
      element: document,
      event: 'stateChange',
      handler: stateChangeHandler
    });
    
    const validationHandler = (event) => {
      if (event.detail?.type === 'bedSelection' && event.detail?.valid) {
        this.animateProgress();
      }
    };
    
    document.addEventListener('validationUpdate', validationHandler);
    this.eventListeners.set('validationUpdate', {
      element: document,
      event: 'validationUpdate',
      handler: validationHandler
    });
  }
  
  update() {
    const currentStep = this.stateManager?.getCurrentStep() || 'search';
    let progress = 0;
    
    switch (currentStep) {
      case 'search':
        progress = 0;
        break;
      case 'rooms':
      case 'beds':
        progress = 33;
        break;
      case 'form':
        progress = 66;
        break;
      case 'payment':
      case 'complete':
        progress = 100;
        break;
      default:
        progress = 0;
    }
    
    this.setProgress(progress);
    this.updateStepIndicators(currentStep);
  }
  
  setProgress(targetProgress) {
    if (!this.progressFill) return;
    
    const startProgress = this.currentProgress;
    const progressDiff = targetProgress - startProgress;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.animationDuration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startProgress + (progressDiff * easeOutQuart);
      
      this.progressFill.style.width = `${currentValue}%`;
      this.currentProgress = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.currentProgress = targetProgress;
        this.onProgressComplete(targetProgress);
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  onProgressComplete(progress) {
    if (progress === 100) {
      this.progressFill.classList.add('progress-complete');
      
      setTimeout(() => {
        this.progressFill.classList.remove('progress-complete');
      }, 500);
      
      if (window.toastManager) {
        window.toastManager.showSuccess('Proceso completado');
      }
    }
  }
  
  updateStepIndicators(currentStep) {
    const indicators = document.querySelectorAll('.step-indicator');
    
    indicators.forEach((indicator, index) => {
      indicator.classList.remove('active', 'completed');
      
      const stepNames = ['search', 'beds', 'form', 'payment'];
      const currentIndex = stepNames.indexOf(currentStep);
      
      if (index < currentIndex) {
        indicator.classList.add('completed');
      } else if (index === currentIndex) {
        indicator.classList.add('active');
      }
    });
  }
  
  animateProgress() {
    if (!this.progressFill) return;
    
    this.progressFill.style.transform = 'scaleY(1.2)';
    this.progressFill.style.transition = 'transform 0.2s ease';
    
    setTimeout(() => {
      this.progressFill.style.transform = 'scaleY(1)';
    }, 200);
  }
  
  startHoldTimer(beds, totalNeeded, minutes = 3) {
    if (beds.length !== totalNeeded) return;
    
    this.stateManager?.setSelectedBeds(beds);
    this.stateManager?.updateStep('form');
    
    this.timerManager?.startHold(minutes);
    
    this.update();
    
    this.showProgressMessage('Camas reservadas temporalmente');
  }
  
  showProgressMessage(message) {
    const progressContainer = this.progressFill?.parentElement;
    if (!progressContainer) return;
    
    let messageEl = progressContainer.querySelector('.progress-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'progress-message';
      progressContainer.appendChild(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.style.opacity = '1';
    
    setTimeout(() => {
      messageEl.style.opacity = '0';
    }, 3000);
  }
  
  getProgressPercentage() {
    return this.currentProgress;
  }
  
  getCurrentStep() {
    const currentStep = this.stateManager?.getCurrentStep() || 'search';
    return currentStep;
  }
  
  canProceedToNext() {
    const currentStep = this.getCurrentStep();
    
    switch (currentStep) {
      case 'search':
        return this.validateSearchCriteria();
      case 'beds':
        return this.validateBedSelection();
      case 'form':
        return this.validateFormData();
      default:
        return false;
    }
  }
  
  validateSearchCriteria() {
    const criteria = this.stateManager?.getSearchCriteria();
    return criteria && criteria.dateIn && criteria.dateOut && 
           (criteria.men > 0 || criteria.women > 0);
  }
  
  validateBedSelection() {
    const selectedBeds = this.stateManager?.getSelectedBeds();
    const criteria = this.stateManager?.getSearchCriteria();
    
    if (!selectedBeds || !criteria) return false;
    
    const totalNeeded = (criteria.men || 0) + (criteria.women || 0);
    return selectedBeds.length === totalNeeded;
  }
  
  validateFormData() {
    return window.formValidator?.validateAll() || false;
  }
  
  reset() {
    this.currentProgress = 0;
    if (this.progressFill) {
      this.progressFill.style.width = '0%';
    }
    this.updateStepIndicators('search');
  }
  
  destroy() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
  }
}

window.progressManager = new ProgressManager();
