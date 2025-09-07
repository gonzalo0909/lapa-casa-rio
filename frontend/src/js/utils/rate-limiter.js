class RateLimiter {
  constructor() {
    this.limits = {
      availability: { max: 10, window: 60000 },
      booking: { max: 3, window: 300000 },
      admin: { max: 20, window: 60000 },
      default: { max: 15, window: 60000 }
    };
    
    this.requests = new Map();
    this.penalties = new Map();
    this.requestHistory = new Map();
    this.maxHistorySize = 1000;
    
    this.startCleanup();
  }
  
  startCleanup() {
    setInterval(() => {
      this.cleanupExpiredData();
    }, 30000);
  }
  
  cleanupExpiredData() {
    const now = Date.now();
    
    this.requests.forEach((requests, endpoint) => {
      const limit = this.limits[endpoint] || this.limits.default;
      const validRequests = requests.filter(time => now - time < limit.window);
      
      if (validRequests.length > 0) {
        this.requests.set(endpoint, validRequests);
      } else {
        this.requests.delete(endpoint);
      }
    });
    
    this.penalties.forEach((penalty, endpoint) => {
      if (now >= penalty.until) {
        this.penalties.delete(endpoint);
      }
    });
    
    if (this.requestHistory.size > this.maxHistorySize) {
      const entries = Array.from(this.requestHistory.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toKeep = entries.slice(-this.maxHistorySize * 0.8);
      this.requestHistory.clear();
      toKeep.forEach(([key, value]) => {
        this.requestHistory.set(key, value);
      });
    }
  }
  
  canRequest(endpoint) {
    const limit = this.limits[endpoint] || this.limits.default;
    const now = Date.now();
    
    const penalty = this.penalties.get(endpoint);
    if (penalty && now < penalty.until) {
      return {
        allowed: false,
        reason: 'penalty',
        waitTime: penalty.until - now,
        penaltyReason: penalty.reason
      };
    }
    
    const requests = this.requests.get(endpoint) || [];
    const recentRequests = requests.filter(time => now - time < limit.window);
    
    if (recentRequests.length >= limit.max) {
      const waitTime = limit.window - (now - Math.min(...recentRequests));
      
      if (recentRequests.length > limit.max * 1.5) {
        this.penalties.set(endpoint, {
          until: now + (limit.window * 2),
          reason: 'repeated_violations'
        });
      }
      
      return {
        allowed: false,
        reason: 'rate_limit',
        waitTime,
        current: recentRequests.length,
        max: limit.max,
        windowMs: limit.window
      };
    }
    
    recentRequests.push(now);
    this.requests.set(endpoint, recentRequests);
    
    this.logRequest(endpoint, now);
    
    return {
      allowed: true,
      remaining: limit.max - recentRequests.length,
      resetTime: now + limit.window
    };
  }
  
  logRequest(endpoint, timestamp) {
    const requestId = `${endpoint}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    this.requestHistory.set(requestId, {
      endpoint,
      timestamp,
      userAgent: navigator.userAgent.substr(0, 100)
    });
  }
  
  reportAbuse(endpoint, reason = 'manual_report') {
    const now = Date.now();
    const limit = this.limits[endpoint] || this.limits.default;
    
    this.penalties.set(endpoint, {
      until: now + (limit.window * 3),
      reason: reason
    });
    
    console.warn(`Rate limiter: ${endpoint} penalized for ${reason}`);
  }
  
  clearPenalties(endpoint = null) {
    if (endpoint) {
      this.penalties.delete(endpoint);
    } else {
      this.penalties.clear();
    }
  }
  
  updateLimits(endpoint, newLimits) {
    if (this.limits[endpoint]) {
      this.limits[endpoint] = { ...this.limits[endpoint], ...newLimits };
    }
  }
  
  getStatus() {
    const now = Date.now();
    const status = {};
    
    Object.keys(this.limits).forEach(endpoint => {
      const requests = this.requests.get(endpoint) || [];
      const recentRequests = requests.filter(time => now - time < this.limits[endpoint].window);
      const penalty = this.penalties.get(endpoint);
      
      status[endpoint] = {
        requests: recentRequests.length,
        max: this.limits[endpoint].max,
        remaining: this.limits[endpoint].max - recentRequests.length,
        penalized: penalty && now < penalty.until,
        penaltyTimeLeft: penalty ? Math.max(0, penalty.until - now) : 0,
        windowMs: this.limits[endpoint].window
      };
    });
    
    return status;
  }
  
  getRequestHistory(endpoint = null, limit = 100) {
    const entries = Array.from(this.requestHistory.entries());
    
    let filtered = entries;
    if (endpoint) {
      filtered = entries.filter(([_, data]) => data.endpoint === endpoint);
    }
    
    return filtered
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, limit)
      .map(([id, data]) => ({ id, ...data }));
  }
  
  getStatistics() {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    
    const recent = Array.from(this.requestHistory.values())
      .filter(req => req.timestamp > last24h);
    
    const byEndpoint = {};
    recent.forEach(req => {
      if (!byEndpoint[req.endpoint]) {
        byEndpoint[req.endpoint] = 0;
      }
      byEndpoint[req.endpoint]++;
    });
    
    return {
      totalRequests24h: recent.length,
      byEndpoint,
      activePenalties: this.penalties.size,
      activeEndpoints: this.requests.size
    };
  }
  
  reset() {
    this.requests.clear();
    this.penalties.clear();
    this.requestHistory.clear();
  }
  
  destroy() {
    this.reset();
  }
}

window.rateLimiter = new RateLimiter();
