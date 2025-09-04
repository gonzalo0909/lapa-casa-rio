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
      /* Loading states mejorados */
      .loading-pulse {
        animation: pulse 1.5s ease-in-out infinite;
      }
      
      .loading-skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      
      @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      /* Feedback de interacciones */
      .feedback-ripple {
        position: relative;
        overflow: hidden;
      }
      
      .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      }
      
      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
      
      /* Estados de validación visual */
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
      
      @keyframes validation-success {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }
      
      @keyframes validation-error {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      
      /* Hover states mejorados */
      .enhanced-hover {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .enhanced-hover:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      /* Estados de focus mejorados */
      .enhanced-focus {
        transition: all 0.2s ease;
      }
      
      .enhanced-focus:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3);
        transform: scale(1.02);
      }
      
      /* Loading spinner mejorado */
      .spinner-dots {
        display: inline-block;
      }
      
      .spinner-dots::after {
        content: '';
        display: inline-block;
        width: 1em;
        animation: spinner-dots 1.4s infinite;
      }
      
      @keyframes spinner-dots {
        0%, 80%, 100% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80% { content: '...'; }
      }
      
      /* Toast extendido */
      .toast-extended {
        animation: toast-extend 0.3s ease;
      }
      
      @keyframes toast-extend {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      /* Progress bar mejorado */
      .progress-complete {
        animation: progress-complete 0.5s ease;
      }
      
      @keyframes progress-complete {
        0% { transform: scaleX(1); }
        50% { transform: scaleX(1.02); }
        100% { transform: scaleX(1); }
      }
      
      /* Bed selection feedback */
      .bed-selecting {
        animation: bed-select 0.2s ease;
      }
      
      .bed-deselecting {
        animation: bed-deselect 0.2s ease;
      }
      
      @keyframes bed-select {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      @keyframes bed-deselect {
        0% { transform: scale(1); }
        50% { transform: scale(0.9); }
        100% { transform: scale(1); }
      }
      
      /* Accessibility - motion reduction */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      /* Estados responsive */
      @media (max-width: 768px) {
        .enhanced-hover:hover {
          transform: none; /* Disable hover transform on mobile */
        }
        
        .feedback-ripple {
          /* Enable ripple on mobile for better touch feedback */
        }
      }
      
      /* High contrast mode */
      @media (prefers-contrast: high) {
        .validation-success {
          border-width: 3px !important;
        }
        
        .validation-error {
          border-width: 3px !important;
        }
      }
    `;
    
    // Solo añadir si no existe
    if (!document.getElementById('visual-feedback-styles')) {
      document.head.appendChild(style);
    }
  }
  
  setupInteractionFeedback() {
    // Auto-aplicar clases de feedback a elementos interactivos
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
      
      // Ripple effect en click
      button.addEventListener('click', (e) => {
        this.createRipple(e, button);
      });
      
      // Loading state visual
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
      
      // Feedback de validación visual
      input.addEventListener('invalid', () => {
        this.showValidationFeedback(input, false);
      });
      
      input.addEventListener('valid', () => {
        this.showValidationFeedback(input, true);
      });
      
      // Custom validation events
      input.addEventListener('validation-success', () => {
        this.showValidationFeedback(input, true);
      });
      
      input.addEventListener('validation-error', () => {
        this.showValidationFeedback(input, false);
      });
    });
  }
  
  enhanceBeds() {
    // Observer para camas que se añaden dinámicamente
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList?.contains('bed')) {
            this.enhanceBed(node);
          }
          
          // También buscar camas en nodos hijos
          if (node.nodeType === 1) {
            const beds = node.querySelectorAll?.('.bed');
            beds?.forEach(bed => this.enhanceBed(bed));
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Enhancer camas existentes
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
        
        // Visual feedback durante selección
        bed.classList.add(wasSelected ? 'bed-deselecting' : 'bed-selecting');
        
        // Crear ripple
        this.createRipple(e, bed);
        
        // Remover clase de animación después
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
  
  // EFECTOS ESPECÍFICOS
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
    
    // Remover después de la animación
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);
  }
  
  showValidationFeedback(element, isValid) {
    // Remover clases previas
    element.classList.remove('validation-success', 'validation-error');
    
    // Añadir nueva clase
    if (isValid) {
      element.classList.add('validation-success');
      
      // Evento para componentes que escuchen
      element.dispatchEvent(new CustomEvent('feedback-validation-success'));
    } else {
      element.classList.add('validation-error');
      
      // Evento para componentes que escuchen
      element.dispatchEvent(new CustomEvent('feedback-validation-error'));
    }
    
    // Remover clases después de la animación
    setTimeout(() => {
      element.classList.remove('validation-success', 'validation-error');
    }, 500);
  }
  
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add('loading-pulse');
      button.disabled = true;
      
      // Añadir spinner de texto si no tiene loading-manager
      const textEl = button.querySelector('.btn-text');
      if (textEl && !button.querySelector('.btn-loading')) {
        const originalText = textEl.textContent;
        textEl.dataset.originalText = originalText;
        textEl.innerHTML = `${originalText} <span class="spinner-dots"></span>`;
      }
    } else {
      button.classList.remove('loading-pulse');
      button.disabled = false;
      
      // Restaurar texto original
      const textEl = button.querySelector('.btn-text');
      if (textEl && textEl.dataset.originalText) {
        textEl.textContent = textEl.dataset.originalText;
        delete textEl.dataset.originalText;
      }
    }
  }
  
  // SKELETON LOADING
  createSkeleton(container, config = {}) {
    const {
      rows = 3,
      height = '20px',
      spacing = '10px',
      borderRadius = '4px'
    } = config;
    
    const skeleton = document.createElement('div');
    skeleton.className = 'loading-skeleton-container';
    
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('div');
      row.className = 'loading-skeleton';
      row.style.height = height;
      row.style.marginBottom = spacing;
      row.style.borderRadius = borderRadius;
      
      // Variación en el ancho para más realismo
      if (i === rows - 1) {
        row.style.width = '70%';
      }
      
      skeleton.appendChild(row);
    }
    
    container.appendChild(skeleton);
    return skeleton;
  }
  
  removeSkeleton(container) {
    const skeletons = container.querySelectorAll('.loading-skeleton-container');
    skeletons.forEach(skeleton => {
      skeleton.remove();
    });
  }
  
  // LOADING STATES AVANZADOS
  showSectionLoading(sectionId, message = 'Cargando...') {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Crear overlay de loading
    const overlay = document.createElement('div');
    overlay.className = 'section-loading-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 100;
      border-radius: inherit;
    `;
    
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <p style="margin-top: 1rem; color: #6b7280;">${message}</p>
    `;
    
    // Hacer section relative si no lo es
    const position = getComputedStyle(section).position;
    if (position === 'static') {
      section.style.position = 'relative';
    }
    
    section.appendChild(overlay);
    
    return overlay;
  }
  
  hideSectionLoading(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const overlay = section.querySelector('.section-loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
  
  // ANIMACIONES PERSONALIZADAS
  animateCountUp(element, from, to, duration = 1000) {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(from + (to - from) * easeOut);
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  highlightElement(element, duration = 2000) {
    element.style.transition = 'all 0.3s ease';
    element.style.backgroundColor = '#fef3c7';
    element.style.transform = 'scale(1.02)';
    
    setTimeout(() => {
      element.style.backgroundColor = '';
      element.style.transform = '';
    }, duration);
  }
  
  // ACCESIBILIDAD
  setupAccessibilityFeatures() {
    // Detectar preferencias de usuario
    this.checkMotionPreferences();
    this.checkContrastPreferences();
    this.setupKeyboardNavigation();
  }
  
  checkMotionPreferences() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      document.body.classList.add('reduced-motion');
    }
    
    prefersReducedMotion.addListener((mq) => {
      document.body.classList.toggle('reduced-motion', mq.matches);
    });
  }
  
  checkContrastPreferences() {
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    
    if (prefersHighContrast.matches) {
      document.body.classList.add('high-contrast');
    }
    
    prefersHighContrast.addListener((mq) => {
      document.body.classList.toggle('high-contrast', mq.matches);
    });
  }
  
  setupKeyboardNavigation() {
    // Mejor focus management
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });
    
    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }
  
  // API PÚBLICA
  triggerValidationSuccess(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.dispatchEvent(new CustomEvent('validation-success'));
    }
  }
  
  triggerValidationError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.dispatchEvent(new CustomEvent('validation-error'));
    }
  }
  
  showLoadingFor(elementId, duration = 2000) {
    const element = document.getElementById(elementId);
    if (element) {
      element.dispatchEvent(new CustomEvent('loading-start'));
      
      setTimeout(() => {
        element.dispatchEvent(new CustomEvent('loading-end'));
      }, duration);
    }
  }
  
  // CLEANUP
  destroy() {
    // Remover estilos añadidos
    const styles = document.getElementById('visual-feedback-styles');
    if (styles) {
      styles.remove();
    }
    
    // Limpiar animaciones activas
    this.animations.clear();
    this.interactions.clear();
  }
}

// Inicialización global
window.visualFeedbackManager = new VisualFeedbackManager();
