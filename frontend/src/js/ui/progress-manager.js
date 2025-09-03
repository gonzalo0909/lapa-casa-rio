class ProgressManager {
  constructor() {
    this.progressBar = document.getElementById('progressFill');
    this.currentProgress = 0;
    this.steps = [
      { id: 'dates', weight: 20 },
      { id: 'guests', weight: 20 },
      { id: 'availability', weight: 25 },
      { id: 'beds', weight: 20 },
      { id: 'form', weight: 10 },
      { id: 'payment', weight: 5 }
    ];
  }
  
  update() {
    const progress = this.calculateProgress();
    this.setProgress(progress);
  }
  
  calculateProgress() {
    let progress = 0;
    
    // Dates
    if (this.hasValidDates()) {
      progress += this.steps[0].weight;
    }
    
    // Guests
    if (this.hasGuests()) {
      progress += this.steps[1].weight;
    }
    
    // Availability checked
    if (this.hasAvailabilityChecked()) {
      progress += this.steps[2].weight;
    }
    
    // Beds selected
    if (this.hasBedsSelected()) {
      progress += this.steps[3].weight;
    }
    
    // Form completed
    if (this.hasFormCompleted()) {
      progress += this.steps[4].weight;
    }
    
    // Payment completed
    if (this.hasPaymentCompleted()) {
      progress += this.steps[5].weight;
    }
    
    return Math.min(progress, 100);
  }
  
  hasValidDates() {
    const dateIn = document.getElementById('dateIn')?.value;
    const dateOut = document.getElementById('dateOut')?.value;
    
    if (!dateIn || !dateOut) return false;
    
    return new Date(dateOut) > new Date(dateIn);
  }
  
  hasGuests() {
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    return men + women > 0;
  }
  
  hasAvailabilityChecked() {
    const roomsDiv = document.getElementById('rooms');
    return roomsDiv?.dataset.availabilityChecked === 'true';
  }
  
  hasBedsSelected() {
    const selected = document.querySelectorAll('.bed.selected');
    const needed = this.getTotalGuests();
    return selected.length > 0 && selected.length === needed;
  }
  
  hasFormCompleted() {
    const nombre = document.getElementById('nombre')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const telefono = document.getElementById('telefono')?.value?.trim();
    
    return nombre && email && telefono && 
           email.includes('@') && nombre.length >= 2;
  }
  
  hasPaymentCompleted() {
    const payState = document.getElementById('payState')?.textContent;
    return payState && payState !== 'Pendiente';
  }
  
  getTotalGuests() {
    const men = parseInt(document.getElementById('men')?.value || 0);
    const women = parseInt(document.getElementById('women')?.value || 0);
    return men + women;
  }
  
  setProgress(progress) {
    if (!this.progressBar) return;
    
    this.currentProgress = progress;
    this.progressBar.style.width = `${progress}%`;
    
    // Color coding
    if (progress >= 100) {
      this.progressBar.style.backgroundColor = '#059669'; // green
    } else if (progress >= 70) {
      this.progressBar.style.backgroundColor = '#f59e0b'; // yellow
    } else {
      this.progressBar.style.backgroundColor = '#3b82f6'; // blue
    }
    
    // Show milestone messages
    this.checkMilestones(progress);
  }
  
  checkMilestones(progress) {
    const milestones = [
      { value: 25, message: 'Buen comienzo!' },
      { value: 50, message: 'Avanzando bien...' },
      { value: 75, message: 'Casi listo!' },
      { value: 100, message: '¡Perfecto! Listo para confirmar' }
    ];
    
    const milestone = milestones.find(m => 
      progress >= m.value && this.currentProgress < m.value
    );
    
    if (milestone && window.toastManager) {
      window.toastManager.showSuccess(milestone.message, 2000);
    }
  }
  
  reset() {
    this.setProgress(0);
  }
  
  getProgress() {
    return this.currentProgress;
  }
}

window.progressManager = new ProgressManager();
