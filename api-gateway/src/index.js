import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServiceWake } from './service-wake.js';

const app = express();

const PORT = process.env.PORT || 4000;
const PROXY_TIMEOUT = Number(process.env.PROXY_TIMEOUT_MS || 120000);
function positiveSetting(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : fallback;
}

const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  'https://digital-logbook-dhtq.onrender.com',
  'https://digital-logbook-bxgv.onrender.com',
  'https://digital-logbook-bjev.onrender.com',
  'https://digital-logbook-hlulani.onrender.com',

  'http://localhost:5173',
  'http://localhost:3000',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`[gateway] Blocked CORS origin: ${origin}`);

    return callback(null, false);
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

function normalizeTarget(value, fallback, serviceName) {
  const rawValue = (value || fallback).trim();

  try {
    const parsed = new URL(rawValue);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}`);
    }

    return parsed.origin;
  } catch (error) {
    console.error(`[gateway] Invalid ${serviceName} URL: "${rawValue}"`);

    throw error;
  }
}

const services = {
  auth: normalizeTarget(process.env.AUTH_SERVICE_URL, 'http://localhost:5001', 'AUTH_SERVICE_URL'),

  dashboard: normalizeTarget(
    process.env.DASHBOARD_SERVICE_URL,
    'http://localhost:5002',
    'DASHBOARD_SERVICE_URL'
  ),

  project: normalizeTarget(
    process.env.PROJECT_SERVICE_URL,
    'http://localhost:5003',
    'PROJECT_SERVICE_URL'
  ),

  profile: normalizeTarget(
    process.env.PROFILE_SERVICE_URL,
    'http://localhost:5004',
    'PROFILE_SERVICE_URL'
  ),
};

const serviceWake = createServiceWake(services, {
  timeoutMs: positiveSetting('WAKE_TIMEOUT_MS', 115000),
  probeTimeoutMs: positiveSetting('WAKE_PROBE_TIMEOUT_MS', 10000),
  retryIntervalMs: positiveSetting('WAKE_RETRY_INTERVAL_MS', 1000),
  ttlMs: positiveSetting('WAKE_TTL_MS', 60000),
});

app.get('/', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'healthy',
  });
});

function serviceUnavailable(res, service) {
  res.setHeader('Retry-After', '5');
  res.status(503).json({
    success: false,
    code: 'SERVICE_UNAVAILABLE',
    error: 'Backend service is starting or unavailable. Please try again.',
    service,
  });
}

function ensureServiceAwake(service) {
  return async (req, res, next) => {
    const pending = serviceWake.wakeAll(service);
    const result = await pending[service];
    if (req.aborted || res.destroyed) return;
    if (result.status !== 'awake') return serviceUnavailable(res, service);
    next();
  };
}

app.get('/api/wake', async (req, res) => {
  const service = req.query.service;
  if (service !== undefined && (typeof service !== 'string' || !Object.hasOwn(services, service))) {
    return res.status(400).json({ success: false, error: 'Unknown backend service' });
  }
  res.setHeader('Cache-Control', 'no-store');
  const pending = serviceWake.wakeAll(service);
  const results = service ? [await pending[service]] : await Promise.all(Object.values(pending));
  if (req.aborted || res.destroyed) return;
  const failed = results.filter((result) => result.status !== 'awake');
  if (service && failed.length) return serviceUnavailable(res, service);
  res.status(failed.length === 0 ? 200 : 207).json({
    success: failed.length === 0,
    services: results,
  });
});

function createServiceProxy(serviceName, target) {
  return createProxyMiddleware({
    target,

    changeOrigin: true,

    proxyTimeout: PROXY_TIMEOUT,
    timeout: PROXY_TIMEOUT,

    on: {
      proxyReq: (proxyReq, req) => {
        console.log(
          `[gateway] -> ${serviceName}`,
          `${req.method} ${req.originalUrl}`,
          `target=${target}${req.url}`
        );
      },

      proxyRes: (proxyRes, req) => {
        if ([502, 503, 504].includes(proxyRes.statusCode)) serviceWake.invalidate(serviceName);
        console.log(
          `[gateway] <- ${serviceName}`,
          `${req.method} ${req.originalUrl}`,
          `status=${proxyRes.statusCode}`
        );
      },

      error: (err, req, res) => {
        serviceWake.invalidate(serviceName);
        console.error(`[gateway] ${serviceName} proxy error`);

        console.error({
          code: err.code,
          message: err.message,
          method: req.method,
          url: req.originalUrl,
          target,
        });

        if (res.destroyed || res.writableEnded) return;
        if (res.headersSent) return res.destroy();
        serviceUnavailable(res, serviceName);
      },
    },
  });
}

app.use('/api/auth', ensureServiceAwake('auth'), createServiceProxy('auth', services.auth));

app.use(
  '/api/dashboard',
  ensureServiceAwake('dashboard'),
  createServiceProxy('dashboard', services.dashboard)
);

app.use(
  '/api/project',
  ensureServiceAwake('project'),
  createServiceProxy('project', services.project)
);

app.use(
  '/api/profile',
  ensureServiceAwake('profile'),
  createServiceProxy('profile', services.profile)
);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Gateway route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Proxy timeout: ${PROXY_TIMEOUT}ms`);
  console.log(`AUTH      -> ${services.auth}`);
  console.log(`DASHBOARD -> ${services.dashboard}`);
  console.log(`PROJECT   -> ${services.project}`);
  console.log(`PROFILE   -> ${services.profile}`);
  console.log('========================================');
});

export default app;
