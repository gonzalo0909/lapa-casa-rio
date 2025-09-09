"use strict";

const https = require('https');
const fs = require('fs');

class ProductionMonitoring {
  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'https://lapacasahostel.com';
    this.adminToken = process.env.ADMIN_TOKEN;
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL; // Optional
  }

  async healthCheck() {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/api/health`);
      
      if (response.status === 'ok') {
        console.log('✅ Health check passed');
        return { ok: true, ...response };
      } else {
        throw new Error('Health check failed');
      }
    } catch (err) {
      console.error('❌ Health check failed:', err.message);
      await this.sendAlert('Health Check Failed', err.message);
      return { ok: false, error: err.message };
    }
  }

  async checkDatabaseConnections() {
    try {
      // Test Google Sheets
      const sheetsUrl = process.env.BOOKINGS_WEBAPP_URL;
      if (sheetsUrl) {
        const response = await this.makeRequest(sheetsUrl + '?mode=health');
        console.log('✅ Google Sheets connection OK');
      }

      // Test Redis (through health endpoint)
      const health = await this.makeRequest(`${this.baseUrl}/api/health`);
      if (health.memory) {
        console.log('✅ Redis connection OK');
      }

      return { ok: true };
    } catch (err) {
      console.error('❌ Database check failed:', err.message);
      await this.sendAlert('Database Connection Failed', err.message);
      return { ok: false, error: err.message };
    }
  }

  async performanceCheck() {
    const start = Date.now();
    
    try {
      await this.makeRequest(`${this.baseUrl}/api/availability`, {
        method: 'POST',
        body: JSON.stringify({
          from: '2025-02-01',
          to: '2025-02-03'
        })
      });
      
      const duration = Date.now() - start;
      
      if (duration > 5000) {
        await this.sendAlert('Slow Response Time', `API took ${duration}ms`);
        console.log(`⚠️ Slow response: ${duration}ms`);
      } else {
        console.log(`✅ Performance OK: ${duration}ms`);
      }
      
      return { ok: true, duration };
    } catch (err) {
      console.error('❌ Performance check failed:', err.message);
      return { ok: false, error: err.message };
    }
  }

  async certificateCheck() {
    try {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        method: 'GET',
        path: '/'
      };

      return new Promise((resolve) => {
        const req = https.request(options, (res) => {
          const cert = res.socket.getPeerCertificate();
          const expiry = new Date(cert.valid_to);
          const daysUntilExpiry = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 30) {
            this.sendAlert('SSL Certificate Expiring', `Expires in ${daysUntilExpiry} days`);
            console.log(`⚠️ SSL expires in ${daysUntilExpiry} days`);
          } else {
            console.log(`✅ SSL certificate OK (${daysUntilExpiry} days left)`);
          }

          resolve({ ok: true, daysUntilExpiry });
        });

        req.on('error', (err) => {
          console.error('❌ SSL check failed:', err.message);
          resolve({ ok: false, error: err.message });
        });

        req.end();
      });
    } catch (err) {
      console.error('❌ Certificate check failed:', err.message);
      return { ok: false, error: err.message };
    }
  }

  async makeRequest(url, options = {}) {
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LapaCasa-Monitor/1.0'
      }
    };

    const finalOptions = { ...defaultOptions, ...options };

    if (url.includes('/admin/') && this.adminToken) {
      finalOptions.headers['X-Admin-Token'] = this.adminToken;
    }

    const response = await fetch(url, finalOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async sendAlert(title, message) {
    if (!this.webhookUrl) {
      console.log(`Alert: ${title} - ${message}`);
      return;
    }

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *${title}*\n${message}\nTime: ${new Date().toISOString()}`
        })
      });
    } catch (err) {
      console.error('Failed to send alert:', err.message);
    }
  }

  async runAllChecks() {
    console.log('🔍 Running production monitoring checks...\n');

    const results = await Promise.allSettled([
      this.healthCheck(),
      this.checkDatabaseConnections(),
      this.performanceCheck(),
      this.certificateCheck()
    ]);

    const summary = {
      health: results[0].status === 'fulfilled' ? results[0].value : { ok: false },
      database: results[1].status === 'fulfilled' ? results[1].value : { ok: false },
      performance: results[2].status === 'fulfilled' ? results[2].value : { ok: false },
      ssl: results[3].status === 'fulfilled' ? results[3].value : { ok: false }
    };

    const allOk = Object.values(summary).every(check => check.ok);

    console.log('\n📊 Summary:');
    console.log(`Overall status: ${allOk ? '✅ All systems OK' : '❌ Some checks failed'}`);

    return summary;
  }

  async backup() {
    console.log('💾 Creating backup...');
    
    try {
      // Backup configuration
      const backupData = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: require('../package.json').version,
        config: {
          redis_configured: !!process.env.REDIS_URL,
          sheets_configured: !!process.env.BOOKINGS_WEBAPP_URL,
          stripe_configured: !!process.env.STRIPE_SECRET_KEY,
          mp_configured: !!process.env.MP_ACCESS_TOKEN
        }
      };

      const backupFile = `backup-${Date.now()}.json`;
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      
      console.log(`✅ Backup created: ${backupFile}`);
      return { ok: true, file: backupFile };
    } catch (err) {
      console.error('❌ Backup failed:', err.message);
      return { ok: false, error: err.message };
    }
  }
}

// CLI Usage
if (require.main === module) {
  const monitor = new ProductionMonitoring();
  
  const command = process.argv[2] || 'all';
  
  switch (command) {
    case 'health':
      monitor.healthCheck();
      break;
    case 'performance':
      monitor.performanceCheck();
      break;
    case 'ssl':
      monitor.certificateCheck();
      break;
    case 'backup':
      monitor.backup();
      break;
    case 'all':
    default:
      monitor.runAllChecks();
      break;
  }
}

module.exports = ProductionMonitoring;
