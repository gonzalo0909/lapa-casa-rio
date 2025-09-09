"use strict";

const { logger } = require('./logger');

class MetricsService {
  constructor() {
    this.counters = new Map();
    this.timers = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.alerts = new Map();
    this.startTime = Date.now();
    
    // Initialize core metrics
    this.initializeMetrics();
    
    // Health check interval
    setInterval(() => this.runHealthChecks(), 30000);
  }

  initializeMetrics() {
    // Request counters
    this.counters.set('http_requests_total', 0);
    this.counters.set('http_errors_total', 0);
    this.counters.set('cache_hits', 0);
    this.counters.set('cache_misses', 0);
    this.counters.set('bookings_created', 0);
    this.counters.set('holds_created', 0);
    this.counters.set('payments_processed', 0);
    
    // Gauges
    this.gauges.set('active_holds', 0);
    this.gauges.set('redis_connections', 0);
    this.gauges.set('memory_usage_mb', 0);
    this.gauges.set('cpu_usage_percent', 0);
  }

  // Counter operations
  increment(metric, value = 1, labels = {}) {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + value);
    
    logger.debug('Metric incremented', { metric, value, labels });
  }

  // Gauge operations
  setGauge(metric, value, labels = {}) {
    this.gauges.set(metric, value);
    logger.debug('Gauge set', { metric, value, labels });
  }

  // Timer operations
  startTimer(metric) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.recordDuration(metric, duration);
        return duration;
      }
    };
  }

  recordDuration(metric, duration) {
    if (!this.histograms.has(metric)) {
      this.histograms.set(metric, []);
    }
    
    const durations = this.histograms.get(metric);
    durations.push(duration);
    
    // Keep only last 1000 measurements
    if (durations.length > 1000) {
      durations.shift();
    }
    
    logger.debug('Duration recorded', { metric, duration });
  }

  // Get statistics
  getCounters() {
    return Object.fromEntries(this.counters);
  }

  getGauges() {
    return Object.fromEntries(this.gauges);
  }

  getHistogramStats(metric) {
    const durations = this.histograms.get(metric) || [];
    if (durations.length === 0) return null;
    
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      count: durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  // Health checks
  async runHealthChecks() {
    const checks = await Promise.allSettled([
      this.checkMemoryUsage(),
      this.checkRedisConnection(),
      this.checkResponseTimes(),
      this.checkErrorRates()
    ]);
    
    checks.forEach(result => {
      if (result.status === 'rejected') {
        logger.error('Health check failed', { error: result.reason });
      }
    });
  }

  async checkMemoryUsage() {
    const usage = process.memoryUsage();
    const usageMB = Math.round(usage.heapUsed / 1024 / 1024);
    this.setGauge('memory_usage_mb', usageMB);
    
    if (usageMB > 500) {
      this.triggerAlert('high_memory_usage', {
        current: usageMB,
        threshold: 500
      });
    }
  }

  async checkRedisConnection() {
    try {
      const cache = require('./cache');
      const isConnected = cache.isConnected;
      this.setGauge('redis_connections', isConnected ? 1 : 0);
      
      if (!isConnected) {
        this.triggerAlert('redis_disconnected', {
          message: 'Redis connection lost'
        });
      }
    } catch (err) {
      logger.error('Redis health check failed', { error: err.message });
    }
  }

  checkResponseTimes() {
    const apiStats = this.getHistogramStats('api_request_duration');
    if (apiStats && apiStats.p95 > 2000) {
      this.triggerAlert('slow_response_times', {
        p95: apiStats.p95,
        threshold: 2000
      });
    }
  }

  checkErrorRates() {
    const totalRequests = this.counters.get('http_requests_total') || 0;
    const totalErrors = this.counters.get('http_errors_total') || 0;
    
    if (totalRequests > 100) {
      const errorRate = (totalErrors / totalRequests) * 100;
      
      if (errorRate > 5) {
        this.triggerAlert('high_error_rate', {
          errorRate: errorRate.toFixed(2),
          threshold: 5
        });
      }
    }
  }

  triggerAlert(alertType, data) {
    const now = Date.now();
    const lastAlert = this.alerts.get(alertType);
    
    // Rate limit alerts (don't spam same alert)
    if (lastAlert && (now - lastAlert) < 300000) { // 5 minutes
      return;
    }
    
    this.alerts.set(alertType, now);
    
    logger.warn('Alert triggered', {
      alertType,
      data,
      category: 'alert'
    });
    
    // Here you could integrate with external alerting systems
    // like Slack, PagerDuty, etc.
  }

  // Prometheus format export
  getPrometheusMetrics() {
    let output = '';
    
    // Counters
    for (const [metric, value] of this.counters) {
      output += `# TYPE ${metric} counter\n`;
      output += `${metric} ${value}\n`;
    }
    
    // Gauges
    for (const [metric, value] of this.gauges) {
      output += `# TYPE ${metric} gauge\n`;
      output += `${metric} ${value}\n`;
    }
    
    // Histograms
    for (const [metric, _] of this.histograms) {
      const stats = this.getHistogramStats(metric);
      if (stats) {
        output += `# TYPE ${metric} histogram\n`;
        output += `${metric}_count ${stats.count}\n`;
        output += `${metric}_sum ${stats.mean * stats.count}\n`;
        output += `${metric}{quantile="0.5"} ${stats.p50}\n`;
        output += `${metric}{quantile="0.95"} ${stats.p95}\n`;
        output += `${metric}{quantile="0.99"} ${stats.p99}\n`;
      }
    }
    
    return output;
  }

  // Express middleware
  getMiddleware() {
    return (req, res, next) => {
      this.increment('http_requests_total');
      
      const timer = this.startTimer('api_request_duration');
      
      const originalSend = res.send;
      res.send = (data) => {
        timer.end();
        
        if (res.statusCode >= 400) {
          this.increment('http_errors_total');
        }
        
        return originalSend.call(res, data);
      };
      
      next();
    };
  }

  getSystemStats() {
    return {
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      counters: this.getCounters(),
      gauges: this.getGauges(),
      histograms: Object.fromEntries(
        Array.from(this.histograms.keys()).map(key => [
          key, 
          this.getHistogramStats(key)
        ])
      )
    };
  }
}

module.exports = new MetricsService();
