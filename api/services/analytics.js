"use strict";

const { logger } = require('./logger');
const cache = require('./cache');

class AnalyticsService {
  constructor() {
    this.events = new Map();
    this.userSessions = new Map();
    this.conversionFunnel = new Map();
    this.performanceMetrics = new Map();
    this.dailyStats = new Map();
    
    this.setupEventTracking();
    this.startDailyAggregation();
  }

  setupEventTracking() {
    // Eventos clave del funnel de conversión
    this.funnelSteps = [
      'page_visit',
      'date_selection',
      'guest_count',
      'availability_check',
      'room_selection',
      'bed_selection',
      'form_start',
      'form_complete',
      'payment_start',
      'payment_complete',
      'booking_confirmed'
    ];
    
    this.funnelSteps.forEach(step => {
      this.conversionFunnel.set(step, 0);
    });
  }

  // Tracking de eventos de usuario
  trackEvent(eventType, userId, metadata = {}) {
    const event = {
      type: eventType,
      userId,
      timestamp: Date.now(),
      sessionId: this.getSessionId(userId),
      metadata: {
        userAgent: metadata.userAgent,
        ip: metadata.ip,
        referrer: metadata.referrer,
        ...metadata
      }
    };

    // Almacenar evento
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType).push(event);

    // Actualizar funnel
    if (this.funnelSteps.includes(eventType)) {
      const current = this.conversionFunnel.get(eventType) || 0;
      this.conversionFunnel.set(eventType, current + 1);
    }

    // Tracking de sesión
    this.updateUserSession(userId, eventType, metadata);

    logger.info('Event tracked', { eventType, userId, metadata });
  }

  // Gestión de sesiones de usuario
  getSessionId(userId) {
    const now = Date.now();
    const sessionTimeout = 30 * 60 * 1000; // 30 minutos
    
    if (this.userSessions.has(userId)) {
      const session = this.userSessions.get(userId);
      if (now - session.lastActivity < sessionTimeout) {
        return session.sessionId;
      }
    }
    
    // Nueva sesión
    const sessionId = `session_${now}_${Math.random().toString(36).substr(2, 9)}`;
    this.userSessions.set(userId, {
      sessionId,
      startTime: now,
      lastActivity: now,
      events: []
    });
    
    return sessionId;
  }

  updateUserSession(userId, eventType, metadata) {
    const session = this.userSessions.get(userId);
    if (session) {
      session.lastActivity = Date.now();
      session.events.push({
        type: eventType,
        timestamp: Date.now(),
        metadata
      });
    }
  }

  // Análisis de abandono
  analyzeAbandonmentPoints() {
    const abandonment = {};
    
    for (let i = 0; i < this.funnelSteps.length - 1; i++) {
      const currentStep = this.funnelSteps[i];
      const nextStep = this.funnelSteps[i + 1];
      
      const currentCount = this.conversionFunnel.get(currentStep) || 0;
      const nextCount = this.conversionFunnel.get(nextStep) || 0;
      
      if (currentCount > 0) {
        const dropRate = ((currentCount - nextCount) / currentCount) * 100;
        abandonment[`${currentStep}_to_${nextStep}`] = {
          startCount: currentCount,
          endCount: nextCount,
          dropRate: parseFloat(dropRate.toFixed(2)),
          abandonedUsers: currentCount - nextCount
        };
      }
    }
    
    return abandonment;
  }

  // Métricas de rendimiento
  trackPerformanceMetric(metric, value, metadata = {}) {
    if (!this.performanceMetrics.has(metric)) {
      this.performanceMetrics.set(metric, []);
    }
    
    this.performanceMetrics.get(metric).push({
      value,
      timestamp: Date.now(),
      metadata
    });
    
    // Mantener solo las últimas 1000 mediciones
    const metrics = this.performanceMetrics.get(metric);
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  // Análisis de patrones de usuario
  analyzeUserBehavior() {
    const behavior = {
      averageSessionDuration: this.calculateAverageSessionDuration(),
      mostCommonAbandonmentPoint: this.findMostCommonAbandonmentPoint(),
      peakUsageHours: this.calculatePeakUsageHours(),
      deviceBreakdown: this.analyzeDeviceUsage(),
      conversionRate: this.calculateConversionRate()
    };
    
    return behavior;
  }

  calculateAverageSessionDuration() {
    const sessions = Array.from(this.userSessions.values());
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (session.lastActivity - session.startTime);
    }, 0);
    
    return Math.round(totalDuration / sessions.length / 1000); // segundos
  }

  findMostCommonAbandonmentPoint() {
    const abandonment = this.analyzeAbandonmentPoints();
    let maxDropRate = 0;
    let maxDropPoint = null;
    
    Object.entries(abandonment).forEach(([point, data]) => {
      if (data.dropRate > maxDropRate) {
        maxDropRate = data.dropRate;
        maxDropPoint = point;
      }
    });
    
    return { point: maxDropPoint, dropRate: maxDropRate };
  }

  calculatePeakUsageHours() {
    const hourCounts = new Array(24).fill(0);
    
    this.events.forEach(events => {
      events.forEach(event => {
        const hour = new Date(event.timestamp).getHours();
        hourCounts[hour]++;
      });
    });
    
    const maxCount = Math.max(...hourCounts);
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count === maxCount)
      .map(item => item.hour);
    
    return peakHours;
  }

  analyzeDeviceUsage() {
    const devices = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
    
    this.userSessions.forEach(session => {
      session.events.forEach(event => {
        const userAgent = event.metadata?.userAgent || '';
        
        if (/Mobile|Android|iPhone/.test(userAgent)) {
          devices.mobile++;
        } else if (/iPad|Tablet/.test(userAgent)) {
          devices.tablet++;
        } else if (/Chrome|Firefox|Safari/.test(userAgent)) {
          devices.desktop++;
        } else {
          devices.unknown++;
        }
      });
    });
    
    return devices;
  }

  calculateConversionRate() {
    const visitors = this.conversionFunnel.get('page_visit') || 0;
    const bookings = this.conversionFunnel.get('booking_confirmed') || 0;
    
    if (visitors === 0) return 0;
    return parseFloat(((bookings / visitors) * 100).toFixed(2));
  }

  // Recomendaciones basadas en datos
  generateOptimizationRecommendations() {
    const behavior = this.analyzeUserBehavior();
    const abandonment = this.analyzeAbandonmentPoints();
    const recommendations = [];

    // Recomendación por abandono
    if (behavior.mostCommonAbandonmentPoint?.dropRate > 50) {
      recommendations.push({
        type: 'high_abandonment',
        priority: 'high',
        issue: `Alto abandono en ${behavior.mostCommonAbandonmentPoint.point}`,
        suggestion: 'Simplificar el proceso o agregar tooltips explicativos',
        impact: 'Puede mejorar conversión hasta 20%'
      });
    }

    // Recomendación por dispositivo
    const devices = behavior.deviceBreakdown;
    const totalDevices = Object.values(devices).reduce((sum, count) => sum + count, 0);
    if (totalDevices > 0 && devices.mobile / totalDevices > 0.6) {
      recommendations.push({
        type: 'mobile_optimization',
        priority: 'medium',
        issue: 'Mayoría de usuarios desde móvil',
        suggestion: 'Optimizar interfaz para pantallas pequeñas',
        impact: 'Mejor experiencia móvil'
      });
    }

    // Recomendación por horario
    if (behavior.peakUsageHours.length > 0) {
      recommendations.push({
        type: 'peak_hours',
        priority: 'low',
        issue: `Pico de uso en horas ${behavior.peakUsageHours.join(', ')}`,
        suggestion: 'Considerar promociones en horarios de menor uso',
        impact: 'Distribución más uniforme de carga'
      });
    }

    return recommendations;
  }

  // Dashboard de métricas
  getDashboardData() {
    return {
      overview: {
        totalVisitors: this.conversionFunnel.get('page_visit') || 0,
        totalBookings: this.conversionFunnel.get('booking_confirmed') || 0,
        conversionRate: this.calculateConversionRate(),
        averageSessionDuration: this.calculateAverageSessionDuration()
      },
      funnel: Object.fromEntries(this.conversionFunnel),
      abandonment: this.analyzeAbandonmentPoints(),
      userBehavior: this.analyzeUserBehavior(),
      recommendations: this.generateOptimizationRecommendations(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Exportar datos para análisis externo
  exportAnalyticsData(format = 'json') {
    const data = {
      events: Object.fromEntries(this.events),
      sessions: Array.from(this.userSessions.values()),
      funnel: Object.fromEntries(this.conversionFunnel),
      performance: Object.fromEntries(this.performanceMetrics),
      analysis: this.analyzeUserBehavior(),
      generatedAt: new Date().toISOString()
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  convertToCSV(data) {
    // Implementación básica de conversión a CSV
    let csv = 'EventType,UserId,Timestamp,SessionId,Metadata\n';
    
    Object.entries(data.events).forEach(([eventType, events]) => {
      events.forEach(event => {
        csv += `${eventType},${event.userId},${event.timestamp},${event.sessionId},"${JSON.stringify(event.metadata)}"\n`;
      });
    });
    
    return csv;
  }

  // Agregación diaria automática
  startDailyAggregation() {
    setInterval(() => {
      this.aggregateDailyStats();
    }, 24 * 60 * 60 * 1000); // Cada 24 horas
  }

  aggregateDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = this.getDashboardData();
    
    this.dailyStats.set(today, todayStats);
    
    // Mantener solo los últimos 90 días
    if (this.dailyStats.size > 90) {
      const oldestDate = Array.from(this.dailyStats.keys()).sort()[0];
      this.dailyStats.delete(oldestDate);
    }
    
    logger.info('Daily stats aggregated', { date: today });
  }

  // Middleware para tracking automático
  getTrackingMiddleware() {
    return (req, res, next) => {
      const userId = req.ip || 'anonymous';
      const eventType = this.getEventTypeFromRequest(req);
      
      if (eventType) {
        this.trackEvent(eventType, userId, {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          referrer: req.get('Referrer'),
          path: req.path,
          method: req.method
        });
      }
      
      next();
    };
  }

  getEventTypeFromRequest(req) {
    if (req.path === '/' && req.method === 'GET') return 'page_visit';
    if (req.path === '/api/availability' && req.method === 'POST') return 'availability_check';
    if (req.path === '/api/holds/start' && req.method === 'POST') return 'bed_selection';
    if (req.path === '/api/bookings' && req.method === 'POST') return 'booking_confirmed';
    if (req.path.includes('/payments/') && req.method === 'POST') return 'payment_start';
    
    return null;
  }
}

module.exports = new AnalyticsService();
