class VisualFeedbackManager {
  constructor() {
    this.animations = new Map();
    this.interactions = new Set();
    this.eventListeners = new Map();
    this.observers = new Set();
    this.setupGlobalStyles();
    this.setupInteractionFeedback();
  }
  
  setupGlobalStyles() {
    const style = document.createElement('style');
    style.id = 'visual-feedback-styles';
    style.textContent = `
      .enhanced-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
      .enhanced-hover:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
      
      .enhanced-focus { transition: all 0.2s ease; }
      .enhanced-focus:focus { outline: none; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3); transform: scale(1.02); }
      
      .feedback-ripple { position: relative; overflow: hidden; }
      .ripple-effect {
        position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.6);
        transform: scale(0); animation: ripple 0.6s linear; pointer-events: none;
      }
      @keyframes ripple { to { transform: scale(4); opacity: 0; } }
      
      .validation-success {
        border-color: #059669 !important;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
        animation: validation-success 0.3s ease;
      }
      .validation-error {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        animation: validation-error 0.5s ease;
      }
      @keyframes validation-success { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
      @keyframes validation-error { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      
      .bed-selecting { animation: bed-select 0.2s ease; }
      .bed-deselecting { animation: bed-deselect 0.2s ease; }
      @keyframes bed-select { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
      @keyframes bed-deselect { 0% { transform: scale(1); } 50% { transform: scale(0.9); } 100% { transform: scale(1); } }
      
      @media (prefers-reduced-motion: reduce) { 
        *, *::before, *::after { 
          animation-duration: 0.01ms !important; 
          transition-duration: 0.01ms !important; 
        } 
      }
      
      @media (max-width: 768px) {
        .enhanced-hover:hover { transform: none; }
      }
    `;
    
    if (!document.getElementById('visual-feedback-styles')) {
      document.head.appendChild(style);
    }
  }
  
  setupInteractionFeedback() {
    this.enhanceButtons();
    this.enhanceInputs();
    this.enhanceBeds();
    this.enhanceCards();
  }
  
  enhanceButtons() {
    const buttons = document.querySelectorAll('button, .btn');
    buttons.forEach(button => {
      if (!button.classList.contains('enhanced-hover') && !button.dataset.enhanced) {
        button.classList.add('enhanced-hover', 'enhanced-focus', 'feedback-ripple');
        button.dataset.enhanced = 'true';
        
        const clickHandler = (e) => this.createRipple(e, button);
        button.addEventListener('click', clickHandler);
        this.eventListeners.set(`button-${button.id || Math.random()}`, {
          element: button,
          event: 'click',
          handler: clickHandler
        });
      }
    });
  }
  
  enhanceInputs() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (!input.classList.contains('enhanced-focus') && !input.dataset.enhanced) {
        input.classList.add('enhanced-focus');
        input.dataset.enhanced = 'true';
        
        const validHandler = () => this.showValidationFeedback(input, true);
        const invalidHandler = () => this.showValidationFeedback(input, false);
        
        input.addEventListener('valid', validHandler);
        input.addEventListener('invalid', invalidHandler);
        
        this.eventListeners.set(`input-valid-${input.id || Math.random()}`, {
          element: input,
          event: 'valid',
          handler: validHandler
        });
        
        this.eventListeners.set(`input-invalid-${input.id || Math.random()}`, {
          element: input,
          event: 'invalid',
          handler: invalidHandler
        });
      }
    });
  }
  
  enhanceBeds() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.classList?.contains('bed')) {
              this.enhanceBed(node);
            }
            
            const beds = node.querySelectorAll?.('.bed');
            beds?.forEach(bed => this.enhanceBed(bed));
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    this.observers.add(observer);
    
    document.querySelectorAll('.bed').forEach(bed => {
      this.enhanceBed(bed);
    });
  }
  
  enhanceBed(bed) {
    if (bed.dataset.enhanced) return;
    
    bed.classList.add('enhanced-hover', 'feedback-ripple');
    bed.dataset.enhanced = 'true';
    
    const clickHandler = (e) => {
      if (!bed.classList.contains('occupied')) {
        const wasSelected = bed.classList.contains('selected');
        bed.classList.add(wasSelected ? 'bed-deselecting' : 'bed-selecting');
        this.createRipple(e, bed);
        
        setTimeout(() => {
          bed.classList.remove('bed-selecting', 'bed-deselecting');
        }, 200);
      }
    };
    
    bed.addEventListener('click', clickHandler);
    this.eventListeners.set(`bed-${bed.dataset.room}-${bed.dataset.bed}`, {
      element: bed,
      event: 'click',
      handler: clickHandler
    });
  }
  
  enhanceCards() {
    const cards = document.querySelectorAll('.card, .room, .payment-method');
    cards.forEach(card => {
      if (!card.classList.contains('enhanced-hover') && !card.dataset.enhanced) {
        card.classList.add('enhanced-hover');
        card.dataset.enhanced = 'true';
      }
    });
  }
  
  createRipple(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.className = 'ripple-effect';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    element.appendChild(ripple);
    
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);
  }
  
  showValidationFeedback(element, isValid) {
    element.classList.remove('validation-success', 'validation-error');
    
    if (isValid) {
      element.classList.add('validation-success');
    } else {
      element.classList.add('validation-error');
    }
    
    setTimeout(() => {
      element.classList.remove('validation-success', 'validation-error');
    }, 500);
  }
  
  pulseElement(element, duration = 1000) {
    if (!element) return;
    
    element.style.animation = `pulse ${duration}ms ease-in-out`;
    
    setTimeout(() => {
      element.style.animation = '';
    }, duration);
  }
  
  highlightElement(element, color = '#f59e0b') {
    if (!element) return;
    
    const originalBorder = element.style.border;
    element.style.border = `2px solid ${color}`;
    element.style.transition = 'border 0.3s ease';
    
    setTimeout(() => {
      element.style.border = originalBorder;
    }, 2000);
  }
  
  shakeElement(element) {
    if (!element) return;
    
    element.style.animation = 'validation-error 0.5s ease';
    
    setTimeout(() => {
      element.style.animation = '';
    }, 500);
  }
  
  destroy() {
    const styles = document.getElementById('visual-feedback-styles');
    if (styles) styles.remove();
    
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
    
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
    
    this.animations.clear();
    this.interactions.clear();
  }
}

window.visualFeedbackManager = new VisualFeedbackManager();
