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

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
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
