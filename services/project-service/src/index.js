import './config.js';

import express from 'express';
import cors from 'cors';

import projectRoutes from './Routes/project.js';
import entryRoutes from './Routes/entries.js';
import priorityRoutes from './Routes/priority.js';
import fieldRoutes from './Routes/field.js';
import archiveRoutes from './Routes/archive.js';

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
  res.json({ service: 'project-service', status: 'healthy' });
});

app.use('/service', projectRoutes);
app.use('/service', entryRoutes);
app.use('/service', priorityRoutes);
app.use('/service', fieldRoutes);
app.use('/service', archiveRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Service running on port ${PORT}`);
});
