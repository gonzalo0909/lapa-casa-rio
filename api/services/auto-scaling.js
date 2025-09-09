"use strict";

const { logger } = require('./logger');
const metrics = require('./metrics');

class AutoScalingService {
  constructor() {
    this.instances = new Map();
    this.loadBalancer = new LoadBalancer();
    this.scalingPolicies = {
      cpu: { scaleUp: 70, scaleDown: 30, cooldown: 300000 }, // 5 min
      memory: { scaleUp: 80, scaleDown: 40, cooldown: 300000 },
      requests: { scaleUp: 100, scaleDown: 20, cooldown: 180000 } // 3 min
    };
    this.minInstances = 1;
    this.maxInstances = 5;
    this.lastScalingAction = 0;
    
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => {
      this.evaluateScaling();
    }, 60000); // Check every minute
  }

  async evaluateScaling() {
    try {
      const systemMetrics = await this.getSystemMetrics();
      const currentInstances = this.instances.size;
      
      const scalingDecision = this.makeScalingDecision(systemMetrics, currentInstances);
      
      if (scalingDecision.action !== 'none') {
        await this.executeScalingAction(scalingDecision);
      }
      
    } catch (error) {
      logger.error('Error in scaling evaluation:', error);
    }
  }

  async getSystemMetrics() {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = await this.getMemoryUsage();
    const requestRate = await this.getRequestRate();
    const responseTime = await this.getAverageResponseTime();
    
    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      requests: requestRate,
      responseTime,
      timestamp: Date.now()
    };
  }

  async getCPUUsage() {
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    return Math.min(100, (totalUsage / 1000) * 100); // Rough percentage
  }

  async getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return (memUsage.heapUsed / memUsage.heapTotal) * 100;
  }

  async getRequestRate() {
    const totalRequests = metrics.getCounters().http_requests_total || 0;
    const timeWindow = 60000; // 1 minute
    
    // Get requests from last minute (simplified)
    return Math.min(200, totalRequests / 60); // requests per second
  }

  async getAverageResponseTime() {
    const responseStats = metrics.getHistogramStats('api_request_duration');
    return responseStats ? responseStats.mean : 0;
  }

  makeScalingDecision(systemMetrics, currentInstances) {
    const now = Date.now();
    const timeSinceLastAction = now - this.lastScalingAction;
    
    // Check cooldown period
    const minCooldown = Math.min(...Object.values(this.scalingPolicies).map(p => p.cooldown));
    if (timeSinceLastAction < minCooldown) {
      return { action: 'none', reason: 'cooldown_period' };
    }

    // Scale up conditions
    if (currentInstances < this.maxInstances) {
      if (systemMetrics.cpu > this.scalingPolicies.cpu.scaleUp ||
          systemMetrics.memory > this.scalingPolicies.memory.scaleUp ||
          systemMetrics.requests > this.scalingPolicies.requests.scaleUp) {
        
        return {
          action: 'scale_up',
          reason: `High resource usage: CPU ${systemMetrics.cpu}%, Memory ${systemMetrics.memory}%, RPS ${systemMetrics.requests}`,
          targetInstances: currentInstances + 1
        };
      }
    }

    // Scale down conditions
    if (currentInstances > this.minInstances) {
      if (systemMetrics.cpu < this.scalingPolicies.cpu.scaleDown &&
          systemMetrics.memory < this.scalingPolicies.memory.scaleDown &&
          systemMetrics.requests < this.scalingPolicies.requests.scaleDown) {
        
        return {
          action: 'scale_down',
          reason: `Low resource usage: CPU ${systemMetrics.cpu}%, Memory ${systemMetrics.memory}%, RPS ${systemMetrics.requests}`,
          targetInstances: currentInstances - 1
        };
      }
    }

    return { action: 'none', reason: 'metrics_within_thresholds' };
  }

  async executeScalingAction(decision) {
    try {
      this.lastScalingAction = Date.now();
      
      if (decision.action === 'scale_up') {
        await this.scaleUp();
      } else if (decision.action === 'scale_down') {
        await this.scaleDown();
      }
      
      logger.info('Scaling action executed', decision);
      
    } catch (error) {
      logger.error('Failed to execute scaling action:', error);
    }
  }

  async scaleUp() {
    const newInstanceId = `instance_${Date.now()}`;
    
    // In real implementation, this would spawn new server instances
    const newInstance = {
      id: newInstanceId,
      status: 'starting',
      createdAt: Date.now(),
      health: 'unknown'
    };
    
    this.instances.set(newInstanceId, newInstance);
    
    // Simulate startup time
    setTimeout(() => {
      newInstance.status = 'running';
      newInstance.health = 'healthy';
      this.loadBalancer.addInstance(newInstanceId);
    }, 30000); // 30 seconds startup time
    
    return newInstanceId;
  }

  async scaleDown() {
    const instancesToRemove = Array.from(this.instances.keys())
      .filter(id => id !== 'primary') // Never remove primary
      .slice(-1); // Remove newest instance first
    
    if (instancesToRemove.length === 0) return;
    
    const instanceId = instancesToRemove[0];
    const instance = this.instances.get(instanceId);
    
    if (instance) {
      instance.status = 'terminating';
      this.loadBalancer.removeInstance(instanceId);
      
      // Graceful shutdown
      setTimeout(() => {
        this.instances.delete(instanceId);
      }, 10000); // 10 seconds drain time
    }
    
    return instanceId;
  }

  getScalingStatus() {
    return {
      currentInstances: this.instances.size,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      lastScalingAction: this.lastScalingAction,
      timeSinceLastAction: Date.now() - this.lastScalingAction,
      instances: Array.from(this.instances.values()),
      loadBalancer: this.loadBalancer.getStatus()
    };
  }
}

class LoadBalancer {
  constructor() {
    this.instances = new Map();
    this.currentIndex = 0;
    this.algorithm = 'round_robin'; // round_robin, least_connections, weighted
  }

  addInstance(instanceId, weight = 1) {
    this.instances.set(instanceId, {
      id: instanceId,
      weight,
      connections: 0,
      totalRequests: 0,
      lastRequestTime: Date.now(),
      health: 'healthy'
    });
    
    logger.info('Instance added to load balancer', { instanceId });
  }

  removeInstance(instanceId) {
    this.instances.delete(instanceId);
    logger.info('Instance removed from load balancer', { instanceId });
  }

  getNextInstance() {
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.health === 'healthy');
    
    if (healthyInstances.length === 0) {
      return null;
    }

    switch (this.algorithm) {
      case 'round_robin':
        return this.roundRobin(healthyInstances);
      case 'least_connections':
        return this.leastConnections(healthyInstances);
      case 'weighted':
        return this.weightedRoundRobin(healthyInstances);
      default:
        return this.roundRobin(healthyInstances);
    }
  }

  roundRobin(instances) {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }

  leastConnections(instances) {
    return instances.reduce((min, current) => 
      current.connections < min.connections ? current : min
    );
  }

  weightedRoundRobin(instances) {
    const totalWeight = instances.reduce((sum, inst) => sum + inst.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0]; // Fallback
  }

  trackRequest(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.connections++;
      instance.totalRequests++;
      instance.lastRequestTime = Date.now();
    }
  }

  completeRequest(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance && instance.connections > 0) {
      instance.connections--;
    }
  }

  healthCheck() {
    this.instances.forEach((instance, id) => {
      const timeSinceLastRequest = Date.now() - instance.lastRequestTime;
      
      // Mark as unhealthy if no requests for 5 minutes
      if (timeSinceLastRequest > 300000) {
        instance.health = 'unhealthy';
      }
    });
  }

  getStatus() {
    return {
      algorithm: this.algorithm,
      totalInstances: this.instances.size,
      healthyInstances: Array.from(this.instances.values())
        .filter(i => i.health === 'healthy').length,
      instances: Object.fromEntries(this.instances)
    };
  }
}

module.exports = new AutoScalingService();
