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
  }
  
  canRequest(endpoint) {
    const limit = this.limits[endpoint] || this.limits.default;
    const now = Date.now();
    
    const penalty = this.penalties.get(endpoint);
    if (penalty && now < penalty.until) {
      return {
        allowed: false,
        reason: 'penalty',
        waitTime: penalty.until - now
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
        max: limit.max
      };
    }
    
    recentRequests.push(now);
    this.requests.set(endpoint, recentRequests);
    
    return {
      allowed: true,
      remaining: limit.max - recentRequests.length
    };
  }
  
  clearPenalties() {
    this.penalties.clear();
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
        penalized: penalty && now < penalty.until
      };
    });
    
    return status;
  }
}

window.rateLimiter = new RateLimiter();
