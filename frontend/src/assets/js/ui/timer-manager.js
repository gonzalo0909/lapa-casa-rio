class TimerManager {
  constructor() {
    this.activeTimers = new Map();
    this.intervals = new Set();
    this.elements = {
      timer: document.getElementById('paymentTimer'),
      display: document.getElementById('timerDisplay')
    };
  }
  
  startHold(minutes = 3) {
    const timerId = `hold_${Date.now()}`;
    const totalSeconds = minutes * 60;
    let remainingSeconds = totalSeconds;
    
    // Clear existing timers
    this.clearAll();
    
    // Show timer
    if (this.elements.timer) {
      this.elements.timer.classList.remove('hidden');
    }
    
    // Start countdown
    const interval = setInterval(() => {
      remainingSeconds--;
      this.updateDisplay(remainingSeconds);
      
      if (remainingSeconds <= 0) {
        clearInterval(interval);
        this.intervals.delete(interval);
        this.onExpire(timerId);
      }
    }, 1000);
    
    this.intervals.add(interval);
    this.activeTimers.set(timerId, {
      interval,
      startTime: Date.now(),
      totalSeconds,
      remainingSeconds
    });
    
    // Initial display
    this.updateDisplay(remainingSeconds);
    
    return timerId;
  }
  
  updateDisplay(remainingSeconds) {
    if (!this.elements.display) return;
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    
    this.elements.display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Color coding
    if (remainingSeconds <= 30) {
      this.elements.display.style.color = '#dc2626'; // red
    } else if (remainingSeconds <= 60) {
      this.elements.display.style.color = '#ea580c'; // orange
    } else {
      this.elements.display.style.color = '#059669'; // green
    }
  }
  
  onExpire(timerId) {
    // Hide timer
    if (this.elements.timer) {
      this.elements.timer.classList.add('hidden');
    }
    
    // Clear selected beds
    document.querySelectorAll('.bed.selected').forEach(bed => {
      bed.classList.remove('selected');
    });
    
    // Update counters
    const selCount = document.getElementById('selCount');
    if (selCount) selCount.textContent = '0';
    
    // Disable continue button
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) continueBtn.disabled = true;
    
    // Show message
    if (window.toastManager) {
      window.toastManager.showError('Hold expirado. Selecciona nuevamente tus camas.', 6000);
    }
    
    // Cleanup
    this.activeTimers.delete(timerId);
  }
  
  stop(timerId) {
    if (!timerId) {
      this.clearAll();
      return;
    }
    
    const timer = this.activeTimers.get(timerId);
    if (timer) {
      clearInterval(timer.interval);
      this.intervals.delete(timer.interval);
      this.activeTimers.delete(timerId);
    }
    
    if (this.elements.timer) {
      this.elements.timer.classList.add('hidden');
    }
  }
  
  clearAll() {
    // Clear all intervals
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.clear();
    
    // Clear timer records
    this.activeTimers.clear();
    
    // Hide UI
    if (this.elements.timer) {
      this.elements.timer.classList.add('hidden');
    }
  }
  
  cleanup() {
    this.clearAll();
    console.log('TimerManager cleanup completed');
  }
  
  getStatus() {
    return {
      activeTimers: this.activeTimers.size,
      activeIntervals: this.intervals.size
    };
  }
}

window.timerManager = new TimerManager();

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.timerManager?.cleanup();
});
