// lapa-casa-hostel/backend/src/monitoring/metrics.ts
// ventana6
//
// Metricas basicas en memoria: requests por minuto, latencia promedio,
// tasa de error. Deliberadamente simple -- un solo proceso, sin
// persistencia, se resetea en cada deploy/restart. Suficiente para un
// GET /api/metrics que un dashboard interno o un chequeo manual pueda
// leer; no reemplaza un APM real si el proyecto crece a mas instancias
// (ahi el candidato natural es Prometheus, ver infrastructure/monitoring/
// prometheus.yml, hoy sin wire-up real a este backend).

import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;

interface RequestSample {
  timestampMs: number;
  latencyMs: number;
  statusCode: number;
  path: string;
}

const samples: RequestSample[] = [];
const MAX_SAMPLES = 5000;

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    samples.push({
      timestampMs: start,
      latencyMs: Date.now() - start,
      statusCode: res.statusCode,
      path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
    });
    if (samples.length > MAX_SAMPLES) {
      samples.splice(0, samples.length - MAX_SAMPLES);
    }
  });
  next();
}

export interface MetricsSnapshot {
  windowSeconds: number;
  requestsInWindow: number;
  requestsPerMinute: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  statusCounts: Record<string, number>;
  topPaths: Array<{ path: string; count: number }>;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const now = Date.now();
  const windowSamples = samples.filter((s) => now - s.timestampMs <= WINDOW_MS);

  const statusCounts: Record<string, number> = {};
  const pathCounts: Record<string, number> = {};
  let latencySum = 0;
  let errorCount = 0;

  const latencies: number[] = [];
  for (const s of windowSamples) {
    latencySum += s.latencyMs;
    latencies.push(s.latencyMs);
    const bucket = `${Math.floor(s.statusCode / 100)}xx`;
    statusCounts[bucket] = (statusCounts[bucket] || 0) + 1;
    if (s.statusCode >= 500) errorCount++;
    pathCounts[s.path] = (pathCounts[s.path] || 0) + 1;
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95LatencyMs = latencies.length ? latencies[Math.min(p95Index, latencies.length - 1)] : 0;

  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return {
    windowSeconds: WINDOW_MS / 1000,
    requestsInWindow: windowSamples.length,
    requestsPerMinute: windowSamples.length,
    avgLatencyMs: windowSamples.length ? Math.round(latencySum / windowSamples.length) : 0,
    p95LatencyMs,
    errorRate: windowSamples.length ? Number((errorCount / windowSamples.length).toFixed(4)) : 0,
    statusCounts,
    topPaths,
  };
}
