import './config.js';

import express from 'express';
import cors from 'cors';

import loginRoutes from './Routes/login.js';
import profileRoutes from './Routes/profile.js';

const app = express();
const PORT = process.env.PORT || 5004;

// Manual CORS middleware for Express 5 compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'profile-service', status: 'healthy' });
});

app.use('/service', loginRoutes);
app.use('/service', profileRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Profile Service running on port ${PORT}`);
});
