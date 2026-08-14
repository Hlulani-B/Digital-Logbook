import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import projectRoutes from './Routes/project.js';
import entryRoutes from './Routes/entries.js';
import priorityRoutes from './Routes/priority.js';
import fieldRoutes from './Routes/field.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'project-service', status: 'healthy' });
});

app.use('/', projectRoutes);
app.use('/', entryRoutes);
app.use('/', priorityRoutes);
app.use('/', fieldRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Service running on port ${PORT}`);
});
