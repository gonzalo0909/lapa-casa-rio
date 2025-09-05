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
    
    this.clearAll();
    
    if (this.elements.timer) {
      this.elements.timer.classList.remove('hidden');
    }
    
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
    
    this.updateDisplay(remainingSeconds);
    
    return timerId;
  }
  
  updateDisplay(remainingSeconds) {
    if (!this.elements.display) return;
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    
    this.elements.display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (remainingSeconds <= 30) {
      this.elements.display.style.color = '#dc2626';
    } else if (remainingSeconds <= 60) {
      this.elements.display.style.color = '#ea580c';
    } else {
      this.elements.display.style.color = '#059669';
    }
  }
  
  onExpire(timerId) {
    if (this.elements.timer) {
      this.elements.timer.classList.add('hidden');
    }
    
    document.querySelectorAll('.bed.selected').forEach(bed => {
      bed.classList.remove('selected');
    });
    
    const selCount = document.getElementById('selCount');
    if (selCount) selCount.textContent = '0';
    
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) continueBtn.disabled = true;
    
    if (window.toastManager) {
      window.toastManager.showError('Hold expirado. Selecciona nuevamente tus camas.', 6000);
    }
    
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
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.clear();
    
    this.activeTimers.clear();
    
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

window.addEventListener('beforeunload', () => {
  window.timerManager?.cleanup();
});
