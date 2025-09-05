class VisualFeedbackManager {
  constructor() {
    this.animations = new Map();
    this.interactions = new Set();
    this.setupGlobalStyles();
    this.setupInteractionFeedback();
    this.setupAccessibilityFeatures();
  }
  
  setupGlobalStyles() {
    const style = document.createElement('style');
    style.id = 'visual-feedback-styles';
    style.textContent = `
      .loading-pulse {
        animation: pulse 1.5s ease-in-out infinite;
      }
      
      .loading-skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
      }
      
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      @keyframes skeleton-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      
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
      
      .enhanced-hover { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
      .enhanced-hover:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
      
      .enhanced-focus { transition: all 0.2s ease; }
      .enhanced-focus:focus { outline: none; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3); transform: scale(1.02); }
      
      .spinner-dots { display: inline-block; }
      .spinner-dots::after { content: ''; display: inline-block; width: 1em; animation: spinner-dots 1.4s infinite; }
      @keyframes spinner-dots { 0%, 80%, 100% { content: ''; } 40% { content: '.'; } 60% { content: '..'; } 80% { content: '...'; } }
      
      .toast-extended { animation: toast-extend 0.3s ease; }
      @keyframes toast-extend { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
      
      .progress-complete { animation: progress-complete 0.5s ease; }
      @keyframes progress-complete { 0% { transform: scaleX(1); } 50% { transform: scaleX(1.02); } 100% { transform: scaleX(1); } }
      
      .bed-selecting { animation: bed-select 0.2s ease; }
      .bed-deselecting { animation: bed-deselect 0.2s ease; }
      @keyframes bed-select { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
      @keyframes bed-deselect { 0% { transform: scale(1); } 50% { transform: scale(0.9); } 100% { transform: scale(1); } }
      
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      
      @media (max-width: 768px) {
        .enhanced-hover:hover { transform: none; }
      }
      
      @media (prefers-contrast: high) {
        .validation-success, .validation-error { border-width: 3px !important; }
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
      if (!button.classList.contains('enhanced-hover')) {
        button.classList.add('enhanced-hover', 'enhanced-focus', 'feedback-ripple');
      }
      
      button.addEventListener('click', (e) => {
        this.createRipple(e, button);
      });
      
      button.addEventListener('loading-start', () => {
        this.setButtonLoading(button, true);
      });
      
      button.addEventListener('loading-end', () => {
        this.setButtonLoading(button, false);
      });
    });
  }
  
  enhanceInputs() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (!input.classList.contains('enhanced-focus')) {
        input.classList.add('enhanced-focus');
      }
      
      input.addEventListener('invalid', () => {
        this.showValidationFeedback(input, false);
      });
      
      input.addEventListener('valid', () => {
        this.showValidationFeedback(input, true);
      });
      
      ['validation-success', 'validation-error'].forEach(event => {
        input.addEventListener(event, (e) => {
          this.showValidationFeedback(input, e.type === 'validation-success');
        });
      });
    });
  }
  
  enhanceBeds() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList?.contains('bed')) {
            this.enhanceBed(node);
          }
          
          if (node.nodeType === 1) {
            const beds = node.querySelectorAll?.('.bed');
            beds?.forEach(bed => this.enhanceBed(bed));
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    document.querySelectorAll('.bed').forEach(bed => {
      this.enhanceBed(bed);
    });
  }
  
  enhanceBed(bed) {
    if (bed.dataset.enhanced) return;
    
    bed.classList.add('enhanced-hover', 'feedback-ripple');
    bed.dataset.enhanced = 'true';
    
    bed.addEventListener('click', (e) => {
      if (!bed.classList.contains('occupied')) {
        const wasSelected = bed.classList.contains('selected');
        bed.classList.add(wasSelected ? 'bed-deselecting' : 'bed-selecting');
        this.createRipple(e, bed);
        
        setTimeout(() => {
          bed.classList.remove('bed-selecting', 'bed-deselecting');
        }, 200);
      }
    });
  }
  
  enhanceCards() {
    const cards = document.querySelectorAll('.card, .room, .payment-method');
    cards.forEach(card => {
      if (!card.classList.contains('enhanced-hover')) {
        card.classList.add('enhanced-hover');
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
      element.dispatchEvent(new CustomEvent('feedback-validation-success'));
    } else {
      element.classList.add('validation-error');
      element.dispatchEvent(new CustomEvent('feedback-validation-error'));
    }
    
    setTimeout(() => {
      element.classList.remove('validation-success', 'validation-error');
    }, 500);
  }
  
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add('loading-pulse');
      button.disabled = true;
      
      const textEl = button.querySelector('.btn-text');
      if (textEl && !button.querySelector('.btn-loading')) {
        const originalText = textEl.textContent;
        textEl.dataset.originalText = originalText;
        textEl.innerHTML = `${originalText} <span class="spinner-dots"></span>`;
      }
    } else {
      button.classList.remove('loading-pulse');
      button.disabled = false;
      
      const textEl = button.querySelector('.btn-text');
      if (textEl && textEl.dataset.originalText) {
        textEl.textContent = textEl.dataset.originalText;
        delete textEl.dataset.originalText;
      }
    }
  }
  
  destroy() {
    const styles = document.getElementById('visual-feedback-styles');
    if (styles) styles.remove();
    
    this.animations.clear();
    this.interactions.clear();
  }
}

window.visualFeedbackManager = new VisualFeedbackManager();
