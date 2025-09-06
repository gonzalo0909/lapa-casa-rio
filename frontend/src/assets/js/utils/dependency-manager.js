class DependencyManager {
  constructor() {
    this.modules = new Map();
    this.loadOrder = [
      'config',
      'errorHandler', 
      'rateLimiter',
      'apiClient',
      'formValidator',
      'dateValidator', 
      'bookingValidator',
      'stateManager',
      'roomManager',
      'bedSelectionManager',
      'progressManager',
      'loadingManager',
      'timerManager',
      'toastManager',
      'visualFeedbackManager',
      'validationIntegration'
    ];
    this.initialized = new Set();
    this.maxWaitTime = 5000;
  }
  
  async initializeSequentially() {
    console.log('Iniciando carga secuencial de módulos...');
    
    for (const moduleName of this.loadOrder) {
      try {
        await this.waitForModule(moduleName);
        this.initialized.add(moduleName);
        console.log(`✓ ${moduleName} inicializado`);
      } catch (error) {
        console.error(`✗ Error inicializando ${moduleName}:`, error);
        throw new Error(`Failed to initialize ${moduleName}`);
      }
    }
    
    console.log('Todos los módulos inicializados correctamente');
    this.setupGlobalReferences();
    document.dispatchEvent(new CustomEvent('modulesReady'));
  }
  
  async waitForModule(moduleName) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.maxWaitTime) {
      if (this.isModuleAvailable(moduleName)) {
        return window[moduleName];
      }
      await this.sleep(50);
    }
    
    throw new Error(`Timeout waiting for module: ${moduleName}`);
  }
  
  isModuleAvailable(moduleName) {
    const windowRef = window[moduleName];
    return windowRef && typeof windowRef === 'object';
  }
  
  setupGlobalReferences() {
    const coreModules = {
      state: window.stateManager,
      api: window.apiClient,
      toast: window.toastManager,
      loading: window.loadingManager,
      validation: window.validationIntegration
    };
    
    Object.entries(coreModules).forEach(([key, module]) => {
      if (module) {
        window[`$${key}`] = module;
      }
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getInitializationStatus() {
    const status = {};
    this.loadOrder.forEach(moduleName => {
      status[moduleName] = {
        initialized: this.initialized.has(moduleName),
        available: this.isModuleAvailable(moduleName)
      };
    });
    return status;
  }
  
  destroy() {
    this.modules.clear();
    this.initialized.clear();
  }
}

window.dependencyManager = new DependencyManager();
