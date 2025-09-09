"use strict";

const http = require('http');
const https = require('https');
const { URL } = require('url');

class LoadTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = {
      requests: 0,
      errors: 0,
      totalTime: 0,
      responseTimes: [],
      errorTypes: new Map()
    };
  }

  async makeRequest(path, options = {}) {
    const url = new URL(path, this.baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const start = Date.now();
    
    return new Promise((resolve) => {
      const req = client.request(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTester/1.0',
          ...options.headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const duration = Date.now() - start;
          this.recordResult(res.statusCode, duration, null);
          resolve({ statusCode: res.statusCode, data, duration });
        });
      });

      req.on('error', (err) => {
        const duration = Date.now() - start;
        this.recordResult(0, duration, err);
        resolve({ error: err, duration });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  recordResult(statusCode, duration, error) {
    this.results.requests++;
    this.results.totalTime += duration;
    this.results.responseTimes.push(duration);
    
    if (error || statusCode >= 400) {
      this.results.errors++;
      const errorType = error ? error.code : `HTTP_${statusCode}`;
      this.results.errorTypes.set(errorType, 
        (this.results.errorTypes.get(errorType) || 0) + 1);
    }
  }

  async runAvailabilityTest(concurrent = 10, requests = 100) {
    console.log(`Running availability test: ${concurrent} concurrent, ${requests} total requests`);
    
    const promises = [];
    for (let i = 0; i < requests; i++) {
      const promise = this.makeRequest('/api/availability', {
        method: 'POST',
        body: {
          from: '2025-02-01',
          to: '2025-02-03'
        }
      });
      promises.push(promise);
      
      // Control concurrency
      if (promises.length >= concurrent) {
        await Promise.race(promises);
      }
    }
    
    await Promise.all(promises);
  }

  async runBookingFlowTest(concurrent = 5, flows = 50) {
    console.log(`Running booking flow test: ${concurrent} concurrent, ${flows} total flows`);
    
    const promises = [];
    for (let i = 0; i < flows; i++) {
      const promise = this.simulateBookingFlow(i);
      promises.push(promise);
      
      if (promises.length >= concurrent) {
        await Promise.race(promises);
      }
    }
    
    await Promise.all(promises);
  }

  async simulateBookingFlow(flowId) {
    // 1. Check availability
    await this.makeRequest('/api/availability', {
      method: 'POST',
      body: {
        from: '2025-02-01',
        to: '2025-02-03'
      }
    });

    // 2. Create hold
    const holdResult = await this.makeRequest('/api/holds/start', {
      method: 'POST',
      body: {
        holdId: `LOAD-${Date.now()}-${flowId}`,
        entrada: '2025-02-01',
        salida: '2025-02-03',
        hombres: 1,
        mujeres: 1,
        camas: { 1: [1, 2] },
        total: 220
      }
    });

    // 3. Simulate payment delay
    await this.sleep(Math.random() * 1000);

    // 4. Confirm booking (if hold succeeded)
    if (holdResult.statusCode === 200) {
      await this.makeRequest('/api/holds/confirm', {
        method: 'POST',
        body: {
          holdId: `LOAD-${Date.now()}-${flowId}`,
          status: 'paid'
        }
      });
    }
  }

  async runStressTest(duration = 60000) {
    console.log(`Running stress test for ${duration}ms`);
    
    const startTime = Date.now();
    const promises = [];
    
    while (Date.now() - startTime < duration) {
      const endpoint = this.getRandomEndpoint();
      const promise = this.makeRequest(endpoint.path, endpoint.options);
      promises.push(promise);
      
      // Limit concurrent requests
      if (promises.length >= 20) {
        await Promise.race(promises);
      }
      
      await this.sleep(Math.random() * 100);
    }
    
    await Promise.all(promises);
  }

  getRandomEndpoint() {
    const endpoints = [
      {
        path: '/api/availability',
        options: {
          method: 'POST',
          body: {
            from: this.getRandomDate(),
            to: this.getRandomDate(1)
          }
        }
      },
      {
        path: '/api/bookings',
        options: { method: 'GET' }
      },
      {
        path: '/api/holds/list',
        options: { method: 'GET' }
      },
      {
        path: '/api/health',
        options: { method: 'GET' }
      }
    ];
    
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  getRandomDate(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset + Math.floor(Math.random() * 30));
    return date.toISOString().split('T')[0];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    if (this.results.requests === 0) return null;
    
    const responseTimes = this.results.responseTimes.sort((a, b) => a - b);
    
    return {
      requests: this.results.requests,
      errors: this.results.errors,
      errorRate: ((this.results.errors / this.results.requests) * 100).toFixed(2),
      avgResponseTime: Math.round(this.results.totalTime / this.results.requests),
      minResponseTime: responseTimes[0],
      maxResponseTime: responseTimes[responseTimes.length - 1],
      p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      errorTypes: Object.fromEntries(this.results.errorTypes),
      rps: Math.round(this.results.requests / (this.results.totalTime / 1000))
    };
  }

  reset() {
    this.results = {
      requests: 0,
      errors: 0,
      totalTime: 0,
      responseTimes: [],
      errorTypes: new Map()
    };
  }
}

// CLI Usage
async function runTests() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const tester = new LoadTester(baseUrl);
  
  console.log(`Starting load tests against: ${baseUrl}`);
  
  // Test 1: Availability endpoint
  console.log('\n=== Availability Test ===');
  await tester.runAvailabilityTest(10, 100);
  console.log(JSON.stringify(tester.getStats(), null, 2));
  tester.reset();
  
  // Test 2: Booking flow
  console.log('\n=== Booking Flow Test ===');
  await tester.runBookingFlowTest(5, 25);
  console.log(JSON.stringify(tester.getStats(), null, 2));
  tester.reset();
  
  // Test 3: Stress test
  console.log('\n=== Stress Test (30s) ===');
  await tester.runStressTest(30000);
  console.log(JSON.stringify(tester.getStats(), null, 2));
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = LoadTester;
