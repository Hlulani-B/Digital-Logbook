import express from 'express';

import searchRouter from './Routes/search.js';

const app = express();
const PORT = process.env.PORT || 5003;

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
  res.json({ service: 'dashboard-service', status: 'ok' });
});

app.use('/service', searchRouter);

app.listen(PORT, () => {
  console.log(`dashboard-service running on port ${PORT}`);
});

export default app;