const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'profile-service', status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Profile Service running on port ${PORT}`);
});
