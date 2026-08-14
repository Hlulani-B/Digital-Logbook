import './config.js';

import express from 'express';
import cors from 'cors';

import loginRoutes from './Routes/login.js';
import profileRoutes from './Routes/profile.js';

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'profile-service', status: 'healthy' });
});

app.use('/service', loginRoutes);
app.use('/service', profileRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Profile Service running on port ${PORT}`);
});
