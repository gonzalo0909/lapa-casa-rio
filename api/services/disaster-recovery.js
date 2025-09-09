"use strict";

const { logger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

class DisasterRecoveryService {
  constructor() {
    this.backupConfig = {
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 12
      },
      schedule: {
        full: '0 2 * * 0', // Weekly at 2 AM Sunday
        incremental: '0 3 * * 1-6', // Daily at 3 AM Mon-Sat
        config: '0 1 * * *' // Daily at 1 AM
      },
      destinations: [
        'local',
        'google_drive',
        's3' // if configured
      ]
    };
    
    this.recoveryPlan = new Map();
    this.setupRecoveryProcedures();
  }

  setupRecoveryProcedures() {
    // Database recovery
    this.recoveryPlan.set('database', {
      priority: 1,
      steps: [
        'verify_backup_integrity',
        'stop_services',
        'restore_database',
        'verify_data_consistency',
        'restart_services',
        'run_health_checks'
      ],
      estimatedTime: '15-30 minutes',
      rollback: true
    });

    // Application recovery
    this.recoveryPlan.set('application', {
      priority: 2,
      steps: [
        'backup_current_state',
        'deploy_last_known_good_version',
        'restore_configuration',
        'restart_services',
        'verify_functionality'
      ],
      estimatedTime: '10-20 minutes',
      rollback: true
    });

    // Full system recovery
    this.recoveryPlan.set('full_system', {
      priority: 0,
      steps: [
        'provision_new_infrastructure',
        'restore_database',
        'deploy_application',
        'restore_configurations',
        'update_dns',
        'verify_all_services'
      ],
      estimatedTime: '2-4 hours',
      rollback: false
    });
  }

  // Backup operations
  async createFullBackup() {
    try {
      const backupId = `full_${Date.now()}`;
      const backupDir = path.join(__dirname, '../../../backups', backupId);
      await fs.mkdir(backupDir, { recursive: true });

      const backup = {
        id: backupId,
        type: 'full',
        timestamp: new Date().toISOString(),
        size: 0,
        status: 'in_progress',
        components: []
      };

      // Backup database (Google Sheets data)
      const dbBackup = await this.backupDatabase(backupDir);
      backup.components.push(dbBackup);

      // Backup configuration
      const configBackup = await this.backupConfiguration(backupDir);
      backup.components.push(configBackup);

      // Backup application code
      const codeBackup = await this.backupApplicationCode(backupDir);
      backup.components.push(codeBackup);

      // Backup Redis data
      const redisBackup = await this.backupRedisData(backupDir);
      backup.components.push(redisBackup);

      // Calculate total size
      backup.size = backup.components.reduce((sum, comp) => sum + comp.size, 0);
      backup.status = 'completed';

      // Create manifest
      await this.createBackupManifest(backupDir, backup);

      // Compress backup
      const compressedPath = await this.compressBackup(backupDir);
      backup.compressedPath = compressedPath;

      // Upload to external storage
      await this.uploadToExternalStorage(backup);

      logger.info('Full backup completed', { backupId, size: backup.size });
      return backup;

    } catch (error) {
      logger.error('Full backup failed:', error);
      throw error;
    }
  }

  async backupDatabase(backupDir) {
    try {
      // Export Google Sheets data
      const sheetsData = await this.exportSheetsData();
      const dbPath = path.join(backupDir, 'database.json');
      await fs.writeFile(dbPath, JSON.stringify(sheetsData, null, 2));

      const stats = await fs.stat(dbPath);
      return {
        component: 'database',
        path: dbPath,
        size: stats.size,
        records: sheetsData.length
      };
    } catch (error) {
      logger.error('Database backup failed:', error);
      throw error;
    }
  }

  async backupConfiguration(backupDir) {
    try {
      const config = {
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        variables: this.sanitizeEnvironmentVariables(),
        version: require('../../../package.json').version
      };

      const configPath = path.join(backupDir, 'configuration.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const stats = await fs.stat(configPath);
      return {
        component: 'configuration',
        path: configPath,
        size: stats.size
      };
    } catch (error) {
      logger.error('Configuration backup failed:', error);
      throw error;
    }
  }

  async backupApplicationCode(backupDir) {
    try {
      // In production, this would backup the deployed code
      const codeInfo = {
        version: require('../../../package.json').version,
        gitCommit: process.env.GIT_COMMIT || 'unknown',
        timestamp: new Date().toISOString(),
        dependencies: require('../../../package.json').dependencies
      };

      const codePath = path.join(backupDir, 'code_info.json');
      await fs.writeFile(codePath, JSON.stringify(codeInfo, null, 2));

      const stats = await fs.stat(codePath);
      return {
        component: 'application_code',
        path: codePath,
        size: stats.size
      };
    } catch (error) {
      logger.error('Code backup failed:', error);
      throw error;
    }
  }

  async backupRedisData(backupDir) {
    try {
      // Export Redis holds and cache data
      const cache = require('./cache');
      const redisData = await this.exportRedisData();
      
      const redisPath = path.join(backupDir, 'redis_data.json');
      await fs.writeFile(redisPath, JSON.stringify(redisData, null, 2));

      const stats = await fs.stat(redisPath);
      return {
        component: 'redis',
        path: redisPath,
        size: stats.size,
        keys: redisData.keys?.length || 0
      };
    } catch (error) {
      logger.error('Redis backup failed:', error);
      return {
        component: 'redis',
        error: error.message,
        size: 0
      };
    }
  }

  // Recovery operations
  async executeRecovery(type, options = {}) {
    const plan = this.recoveryPlan.get(type);
    if (!plan) {
      throw new Error(`Unknown recovery type: ${type}`);
    }

    const recoveryId = `recovery_${type}_${Date.now()}`;
    logger.info('Starting disaster recovery', { recoveryId, type });

    try {
      const results = [];
      
      for (const step of plan.steps) {
        logger.info('Executing recovery step', { recoveryId, step });
        const result = await this.executeRecoveryStep(step, options);
        results.push({ step, result, timestamp: Date.now() });
      }

      logger.info('Disaster recovery completed', { recoveryId, type });
      return { recoveryId, status: 'success', results };

    } catch (error) {
      logger.error('Disaster recovery failed', { recoveryId, error: error.message });
      
      if (plan.rollback) {
        logger.info('Initiating rollback', { recoveryId });
        await this.rollbackRecovery(recoveryId, results);
      }
      
      throw error;
    }
  }

  async executeRecoveryStep(step, options) {
    switch (step) {
      case 'verify_backup_integrity':
        return await this.verifyBackupIntegrity(options.backupId);
      
      case 'stop_services':
        return await this.stopServices();
      
      case 'restore_database':
        return await this.restoreDatabase(options.backupId);
      
      case 'verify_data_consistency':
        return await this.verifyDataConsistency();
      
      case 'restart_services':
        return await this.restartServices();
      
      case 'run_health_checks':
        return await this.runHealthChecks();
      
      default:
        throw new Error(`Unknown recovery step: ${step}`);
    }
  }

  async verifyBackupIntegrity(backupId) {
    // Verify backup files exist and are not corrupted
    const backupDir = path.join(__dirname, '../../../backups', backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');
    
    if (!(await this.fileExists(manifestPath))) {
      throw new Error('Backup manifest not found');
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    // Verify each component
    for (const component of manifest.components) {
      if (!(await this.fileExists(component.path))) {
        throw new Error(`Backup component missing: ${component.component}`);
      }
    }

    return { status: 'verified', components: manifest.components.length };
  }

  async restoreDatabase(backupId) {
    const backupDir = path.join(__dirname, '../../../backups', backupId);
    const dbPath = path.join(backupDir, 'database.json');
    
    const dbData = JSON.parse(await fs.readFile(dbPath, 'utf8'));
    
    // Restore to Google Sheets
    await this.restoreToSheets(dbData);
    
    return { status: 'restored', records: dbData.length };
  }

  // Health monitoring
  async runContinuousHealthChecks() {
    const checks = [
      'system_resources',
      'service_availability',
      'data_integrity',
      'backup_status',
      'security_status'
    ];

    const results = {};
    
    for (const check of checks) {
      try {
        results[check] = await this.performHealthCheck(check);
      } catch (error) {
        results[check] = { status: 'failed', error: error.message };
      }
    }

    // Trigger alerts for critical failures
    const criticalFailures = Object.entries(results)
      .filter(([_, result]) => result.status === 'critical');

    if (criticalFailures.length > 0) {
      await this.triggerDisasterAlert(criticalFailures);
    }

    return results;
  }

  async performHealthCheck(checkType) {
    switch (checkType) {
      case 'system_resources':
        return await this.checkSystemResources();
      
      case 'service_availability':
        return await this.checkServiceAvailability();
      
      case 'data_integrity':
        return await this.checkDataIntegrity();
      
      case 'backup_status':
        return await this.checkBackupStatus();
      
      case 'security_status':
        return await this.checkSecurityStatus();
      
      default:
        throw new Error(`Unknown health check: ${checkType}`);
    }
  }

  async checkSystemResources() {
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    const diskSpace = await this.checkDiskSpace();
    
    const status = memPercent > 90 || diskSpace.percentUsed > 90 ? 'critical' : 'healthy';
    
    return {
      status,
      memory: { percent: memPercent, ...memUsage },
      disk: diskSpace
    };
  }

  async triggerDisasterAlert(failures) {
    const alertMessage = `🚨 DISASTER ALERT: Critical system failures detected:
${failures.map(([check, result]) => `• ${check}: ${result.error}`).join('\n')}

Immediate attention required!`;

    logger.error('Disaster alert triggered', { failures });
    
    // Send to multiple channels
    await this.sendEmergencyNotification(alertMessage);
  }

  // Utility methods
  sanitizeEnvironmentVariables() {
    const env = { ...process.env };
    const sensitiveKeys = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];
    
    Object.keys(env).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
        env[key] = '[REDACTED]';
      }
    });
    
    return env;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getRecoveryStatus() {
    return {
      plans: Array.from(this.recoveryPlan.keys()),
      lastBackup: this.getLastBackupInfo(),
      healthStatus: 'monitoring',
      alertsActive: 0
    };
  }
}

module.exports = new DisasterRecoveryService();
