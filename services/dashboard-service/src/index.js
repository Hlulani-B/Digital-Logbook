const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'dashboard-service', status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard Service running on port ${PORT}`);
});