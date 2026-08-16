import express from 'express';
import cors from 'cors';

import searchRouter from './Routes/search.js';

const app = express();
const PORT = process.env.PORT || 5003;

// Allowed origins for CORS
const allowedOrigins = [
  'https://digital-logbook-bxgv.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

// CORS configuration with dynamic origin checking
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} not allowed`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS options globally
app.use(cors(corsOptions));

// Safe preflight wildcard handler for Express 5 (regex instead of '*')
app.options(/(.*)/, cors(corsOptions));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'dashboard-service', status: 'ok' });
});

app.use('/service', searchRouter);

// Global error handler - ensures CORS headers on errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`dashboard-service running on port ${PORT}`);
});

export default app;