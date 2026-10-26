const { createApp } = require('./app');
const crm = require('./crm');

const PORT = process.env.PORT || 3000;
createApp({ crm }).listen(PORT, () => console.log(`API abonnements sur http://localhost:${PORT}`));
