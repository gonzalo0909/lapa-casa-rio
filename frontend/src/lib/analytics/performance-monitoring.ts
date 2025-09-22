// src/lib/analytics/performance-monitoring.ts

interface PerformanceMetrics {
  // Core Web Vitals
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  
  // Navigation Timing
  domContentLoaded: number;
  loadComplete: number;
  
  // Resource Loading
  resourceLoadTime: number;
  scriptExecutionTime: number;
  styleSheetLoadTime: number;
  imageLoadTime: number;
  
  // Memory Usage
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  
  // Network
  networkType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  
  // Page Info
  url: string;
  timestamp: number;
  userAgent: string;
  viewport: { width: number; height: number };
}

interface PerformanceBudget {
  fcp: number; // < 1.8s
  lcp: number; // < 2.5s
  fid: number; // < 100ms
  cls: number; // < 0.1
  ttfb: number; // < 600ms
  loadComplete: number; // < 3s
}

interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: 'script' | 'stylesheet' | 'image' | 'font' | 'fetch' | 'other';
  blocking: boolean;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics | null = null;
  private observer: PerformanceObserver | null = null;
  private resourceTimings: ResourceTiming[] = [];
  private isMonitoring = false;
  
  // Performance budget para Lapa Casa Hostel
  private readonly budget: PerformanceBudget = {
    fcp: 1800, // 1.8 segundos
    lcp: 2500, // 2.5 segundos
    fid: 100,  // 100ms
    cls: 0.1,  // 0.1
    ttfb: 600, // 600ms
    loadComplete: 3000 // 3 segundos
  };

  private readonly criticalResources = [
    '/api/rooms',
    '/api/availability',
    'booking-engine',
    'payment-processor'
  ];

  constructor() {
    this.initializeMonitoring();
  }

  // Inicializar monitoreo de performance
  private initializeMonitoring(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver no soportado');
      return;
    }

    this.startWebVitalsMonitoring();
    this.startResourceMonitoring();
    this.startMemoryMonitoring();
    this.startNetworkMonitoring();
    
    // Monitorear cuando la página carga completamente
    if (document.readyState === 'complete') {
      this.collectInitialMetrics();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.collectInitialMetrics(), 0);
      });
    }

    this.isMonitoring = true;
    console.log('Performance monitoring iniciado');
  }

  // Monitorear Core Web Vitals
  private startWebVitalsMonitoring(): void {
    // Largest Contentful Paint (LCP)
    this.createObserver('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        this.updateMetric('lcp', lastEntry.startTime);
        this.checkBudgetViolation('lcp', lastEntry.startTime);
      }
    });

    // First Input Delay (FID)
    this.createObserver('first-input', (entries) => {
      entries.forEach(entry => {
        this.updateMetric('fid', entry.processingStart - entry.startTime);
        this.checkBudgetViolation('fid', entry.processingStart - entry.startTime);
      });
    });

    // Cumulative Layout Shift (CLS)
    this.createObserver('layout-shift', (entries) => {
      let clsValue = 0;
      entries.forEach(entry => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      
      if (clsValue > 0) {
        this.updateMetric('cls', clsValue);
        this.checkBudgetViolation('cls', clsValue);
      }
    });

    // First Contentful Paint (FCP)
    this.createObserver('paint', (entries) => {
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.updateMetric('fcp', entry.startTime);
          this.checkBudgetViolation('fcp', entry.startTime);
        }
      });
    });
  }

  // Monitorear recursos
  private startResourceMonitoring(): void {
    this.createObserver('resource', (entries) => {
      entries.forEach(entry => {
        const resource: ResourceTiming = {
          name: entry.name,
          duration: entry.duration,
          size: entry.transferSize || 0,
          type: this.getResourceType(entry.name),
          blocking: this.isBlockingResource(entry.name)
        };

        this.resourceTimings.push(resource);

        // Alertar sobre recursos lentos críticos
        if (this.isCriticalResource(entry.name) && entry.duration > 1000) {
          this.reportSlowResource(resource);
        }
      });
    });
  }

  // Monitorear memoria
  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.updateMetric('usedJSHeapSize', memory.usedJSHeapSize);
        this.updateMetric('totalJSHeapSize', memory.totalJSHeapSize);
        this.updateMetric('jsHeapSizeLimit', memory.jsHeapSizeLimit);
        
        // Alertar si el uso de memoria es alto
        const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (memoryUsage > 0.8) {
          this.reportHighMemoryUsage(memoryUsage);
        }
      }, 30000); // Cada 30 segundos
    }
  }

  // Monitorear red
  private startNetworkMonitoring(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.updateMetric('networkType', connection.type || 'unknown');
      this.updateMetric('effectiveType', connection.effectiveType || 'unknown');
      this.updateMetric('downlink', connection.downlink || 0);
      this.updateMetric('rtt', connection.rtt || 0);

      // Escuchar cambios de red
      connection.addEventListener('change', () => {
        this.updateMetric('networkType', connection.type);
        this.updateMetric('effectiveType', connection.effectiveType);
        this.updateMetric('downlink', connection.downlink);
        this.updateMetric('rtt', connection.rtt);
        
        this.reportNetworkChange({
          type: connection.type,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        });
      });
    }
  }

  // Crear observer de performance
  private createObserver(type: string, callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ type, buffered: true });
    } catch (error) {
      console.warn(`No se pudo crear observer para ${type}:`, error);
    }
  }

  // Recopilar métricas iniciales
  private collectInitialMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      this.updateMetric('ttfb', navigation.responseStart - navigation.fetchStart);
      this.updateMetric('domContentLoaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
      this.updateMetric('loadComplete', navigation.loadEventEnd - navigation.fetchStart);
      
      this.checkBudgetViolation('ttfb', navigation.responseStart - navigation.fetchStart);
      this.checkBudgetViolation('loadComplete', navigation.loadEventEnd - navigation.fetchStart);
    }

    // Calcular tiempo de carga de recursos por tipo
    const resources = performance.getEntriesByType('resource');
    let scriptTime = 0;
    let styleTime = 0;
    let imageTime = 0;

    resources.forEach(resource => {
      const type = this.getResourceType(resource.name);
      switch (type) {
        case 'script':
          scriptTime += resource.duration;
          break;
        case 'stylesheet':
          styleTime += resource.duration;
          break;
        case 'image':
          imageTime += resource.duration;
          break;
      }
    });

    this.updateMetric('scriptExecutionTime', scriptTime);
    this.updateMetric('styleSheetLoadTime', styleTime);
    this.updateMetric('imageLoadTime', imageTime);
    this.updateMetric('resourceLoadTime', resources.reduce((sum, r) => sum + r.duration, 0));

    // Información de la página
    this.updateMetric('url', window.location.href);
    this.updateMetric('timestamp', Date.now());
    this.updateMetric('userAgent', navigator.userAgent);
    this.updateMetric('viewport', {
      width: window.innerWidth,
      height: window.innerHeight
    });

    // Enviar métricas iniciales
    this.reportMetrics();
  }

  // Utilidades

  private updateMetric(key: keyof PerformanceMetrics, value: any): void {
    if (!this.metrics) {
      this.metrics = {} as PerformanceMetrics;
    }
    (this.metrics as any)[key] = value;
  }

  private getResourceType(url: string): ResourceTiming['type'] {
    if (url.includes('.js') || url.includes('script')) return 'script';
    if (url.includes('.css') || url.includes('stylesheet')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    if (url.includes('/api/')) return 'fetch';
    return 'other';
  }

  private isBlockingResource(url: string): boolean {
    return url.includes('.css') || 
           (url.includes('.js') && !url.includes('async') && !url.includes('defer'));
  }

  private isCriticalResource(url: string): boolean {
    return this.criticalResources.some(critical => url.includes(critical));
  }

  private checkBudgetViolation(metric: keyof PerformanceBudget, value: number): void {
    const budget = this.budget[metric];
    if (value > budget) {
      this.reportBudgetViolation(metric, value, budget);
    }
  }

  // Reportes y alertas

  private reportMetrics(): void {
    if (!this.metrics) return;

    const report = {
      type: 'performance_metrics',
      metrics: this.metrics,
      budgetViolations: this.getBudgetViolations(),
      score: this.calculatePerformanceScore(),
      timestamp: Date.now()
    };

    this.sendToAnalytics(report);
  }

  private reportBudgetViolation(metric: string, actual: number, budget: number): void {
    const violation = {
      type: 'budget_violation',
      metric,
      actual,
      budget,
      severity: this.getSeverity(actual, budget),
      url: window.location.href,
      timestamp: Date.now()
    };

    this.sendToAnalytics(violation);
    console.warn(`Performance budget violation: ${metric} - ${actual}ms > ${budget}ms`);
  }

  private reportSlowResource(resource: ResourceTiming): void {
    const report = {
      type: 'slow_resource',
      resource,
      url: window.location.href,
      timestamp: Date.now()
    };

    this.sendToAnalytics(report);
    console.warn(`Slow critical resource: ${resource.name} - ${resource.duration}ms`);
  }

  private reportHighMemoryUsage(usage: number): void {
    const report = {
      type: 'high_memory_usage',
      usage: Math.round(usage * 100),
      heapUsed: this.metrics?.usedJSHeapSize || 0,
      heapLimit: this.metrics?.jsHeapSizeLimit || 0,
      url: window.location.href,
      timestamp: Date.now()
    };

    this.sendToAnalytics(report);
    console.warn(`High memory usage: ${Math.round(usage * 100)}%`);
  }

  private reportNetworkChange(connection: any): void {
    const report = {
      type: 'network_change',
      connection,
      url: window.location.href,
      timestamp: Date.now()
    };

    this.sendToAnalytics(report);
  }

  // Análisis y scoring

  private calculatePerformanceScore(): number {
    if (!this.metrics) return 0;

    let score = 100;
    
    // Core Web Vitals scoring (pesos oficiales de Google)
    if (this.metrics.fcp) {
      score -= this.metrics.fcp > 1800 ? 25 : this.metrics.fcp > 1000 ? 15 : 0;
    }
    
    if (this.metrics.lcp) {
      score -= this.metrics.lcp > 2500 ? 25 : this.metrics.lcp > 1500 ? 15 : 0;
    }
    
    if (this.metrics.fid) {
      score -= this.metrics.fid > 100 ? 25 : this.metrics.fid > 50 ? 15 : 0;
    }
    
    if (this.metrics.cls) {
      score -= this.metrics.cls > 0.1 ? 25 : this.metrics.cls > 0.05 ? 15 : 0;
    }

    return Math.max(0, score);
  }

  private getBudgetViolations(): Array<{ metric: string; actual: number; budget: number }> {
    if (!this.metrics) return [];

    const violations = [];
    
    Object.entries(this.budget).forEach(([metric, budget]) => {
      const actual = (this.metrics as any)[metric];
      if (actual && actual > budget) {
        violations.push({ metric, actual, budget });
      }
    });

    return violations;
  }

  private getSeverity(actual: number, budget: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = actual / budget;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  // API externa

  private async sendToAnalytics(data: any): Promise<void> {
    try {
      // Enviar a endpoint interno
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      // Integrar con Google Analytics si está disponible
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'performance_metric', {
          event_category: 'performance',
          event_label: data.type,
          value: data.score || 0,
          custom_parameters: data
        });
      }
    } catch (error) {
      console.error('Error enviando métricas de performance:', error);
    }
  }

  // Métodos públicos

  getMetrics(): PerformanceMetrics | null {
    return this.metrics;
  }

  getResourceTimings(): ResourceTiming[] {
    return [...this.resourceTimings];
  }

  getPerformanceScore(): number {
    return this.calculatePerformanceScore();
  }

  getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  // Medición manual de operaciones específicas
  measureOperation<T>(name: string, operation: () => T): T {
    const startTime = performance.now();
    const result = operation();
    const duration = performance.now() - startTime;

    this.sendToAnalytics({
      type: 'operation_timing',
      operation: name,
      duration,
      url: window.location.href,
      timestamp: Date.now()
    });

    return result;
  }

  async measureAsyncOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;

    this.sendToAnalytics({
      type: 'async_operation_timing',
      operation: name,
      duration,
      url: window.location.href,
      timestamp: Date.now()
    });

    return result;
  }

  // Marcadores personalizados
  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string): number {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }

    const measure = performance.getEntriesByName(name, 'measure')[0];
    const duration = measure ? measure.duration : 0;

    this.sendToAnalytics({
      type: 'custom_measure',
      name,
      duration,
      url: window.location.href,
      timestamp: Date.now()
    });

    return duration;
  }

  // Limpiar datos
  clearMetrics(): void {
    this.metrics = null;
    this.resourceTimings = [];
    performance.clearMarks();
    performance.clearMeasures();
  }

  // Destructor
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.isMonitoring = false;
    this.clearMetrics();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();
