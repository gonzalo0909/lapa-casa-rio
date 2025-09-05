// frontend/src/assets/js/business/progress-manager.js

class ProgressManager {
  constructor() {
    this.timerManager = window.timerManager;
    this.stateManager = window.stateManager;
    this.progressFill = document.getElementById('progressFill');
    this.totalSteps = 3; // 1. Fechas/huéspedes → 2. Camas → 3. Formulario
  }

  update() {
    const currentStep = this.stateManager?.getCurrentStep() || 'search';
    let progress = 0;

    switch (currentStep) {
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

    if (this.progressFill) {
      this.progressFill.style.width = `${progress}%`;
    }
  }

  // Este es el método que se usaba: startHoldTimer
  startHoldTimer(beds, totalNeeded, minutes = 3) {
    if (beds.length !== totalNeeded) return;

    // Guardar en estado
    this.stateManager?.setSelectedBeds(beds);
    this.stateManager?.updateStep('form');

    // Iniciar hold
    this.timerManager?.startHold(minutes);

    // Actualizar UI
    this.update();
  }
}

window.progressManager = new ProgressManager();
