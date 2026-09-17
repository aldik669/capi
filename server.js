require('dotenv').config();
const path = require('path');
const express = require('express');
const { basicAuth } = require('./lib/basicAuth');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');

const { ADMIN_USERNAME = 'admin', ADMIN_PASSWORD, PORT = 3000 } = process.env;

if (!ADMIN_PASSWORD) {
  console.error('Missing required env var: ADMIN_PASSWORD must be set (see .env.example)');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/webhook', webhookRouter);

const adminAuth = basicAuth({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD, realm: 'CAPI Admin' });
app.use('/admin', adminAuth, adminRouter);
app.use('/admin', adminAuth, express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`CAPI service listening on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
