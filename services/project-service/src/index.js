import './config.js';

import express from 'express';
import cors from 'cors';

import { requireAuth } from './middleware/auth.js';
import projectRoutes from './Routes/project.js';
import entryRoutes from './Routes/entries.js';
import priorityRoutes from './Routes/priority.js';
import fieldRoutes from './Routes/field.js';
import archiveRoutes from './Routes/archive.js';
import naturalLanguageRoutes from './Routes/natural_language.js';

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
  res.json({ service: 'project-service', status: 'healthy' });
});

// All /service routes require a valid Supabase JWT.
// The verified user's email is attached to req.userEmail by requireAuth.
app.use('/service', requireAuth, projectRoutes);
app.use('/service', requireAuth, entryRoutes);
app.use('/service', requireAuth, priorityRoutes);
app.use('/service', requireAuth, fieldRoutes);
app.use('/service', requireAuth, archiveRoutes);
app.use('/service', requireAuth, naturalLanguageRoutes);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Service running on port ${PORT}`);
});
