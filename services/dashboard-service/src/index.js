import express from 'express';
import cors from 'cors';

import searchRouter from './Routes/search.js';

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'dashboard-service', status: 'ok' });
});

app.use('/service', searchRouter);

app.listen(PORT, () => {
  console.log(`dashboard-service running on port ${PORT}`);
});

export default app;