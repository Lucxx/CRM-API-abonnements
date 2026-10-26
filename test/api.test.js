const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

// faux CRM en mémoire ; crm.down = true simule une panne
function fakeCrm() {
  const companies = {
    cmp_001: { customerStatus: 'prospect', currentPlan: null, mrr: 0 },
    cmp_002: { customerStatus: 'prospect', currentPlan: null, mrr: 0 },
  };
  const crm = {
    companies,
    down: false,
    async getCompany(id) {
      if (crm.down) throw new Error('panne');
      if (!companies[id]) throw Object.assign(new Error('inconnue'), { notFound: true });
      return companies[id];
    },
    async updateCompany(id, data) {
      if (crm.down) throw new Error('panne');
      Object.assign(companies[id], data);
    },
  };
  return crm;
}

function withApi(name, fn) {
  test(name, async () => {
    const crm = fakeCrm();
    const clock = { date: new Date('2026-01-15T00:00:00Z') };
    const server = await new Promise((resolve) => {
      const s = createApp({ crm, now: () => clock.date }).listen(0, () => resolve(s));
    });
    const base = `http://localhost:${server.address().port}`;
    const call = async (method, path, body, raw) => {
      const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: raw ?? (body ? JSON.stringify(body) : undefined),
      });
      return { status: res.status, body: await res.json() };
    };
    try { await fn({ crm, clock, call }); } finally { server.close(); }
  });
}

const subscribe = (api, extra = {}) =>
  api.call('POST', '/subscriptions', { companyId: 'cmp_001', plan: 'starter', billingPeriod: 'monthly', ...extra });

withApi('souscrire : 201, échéance et CRM à jour', async (api) => {
  const r = await subscribe(api);
  assert.equal(r.status, 201);
  assert.equal(r.body.price, 19);
  assert.deepEqual(r.body.nextBilling, { date: '2026-02-15T00:00:00.000Z', amount: 19 });
  assert.equal(r.body.crmSynced, true);
  assert.deepEqual(api.crm.companies.cmp_001, { customerStatus: 'customer', currentPlan: 'starter', mrr: 19 });
});

withApi('souscrire en annuel : mrr = prix / 12', async (api) => {
  await subscribe(api, { plan: 'pro', billingPeriod: 'annual' });
  assert.equal(api.crm.companies.cmp_001.mrr, 40.83);
});

withApi('souscrire : erreurs', async (api) => {
  assert.equal((await subscribe(api, { plan: 'gold' })).status, 422);
  assert.equal((await subscribe(api, { billingPeriod: 'weekly' })).status, 422);
  assert.equal((await api.call('POST', '/subscriptions', { plan: 'pro' })).status, 422);
  assert.equal((await api.call('POST', '/subscriptions', null, '{abc')).status, 400);
  assert.equal((await subscribe(api, { companyId: 'cmp_999' })).status, 404);
});

withApi('souscrire deux fois : 409', async (api) => {
  await subscribe(api);
  assert.equal((await subscribe(api)).status, 409);
});

withApi('CRM en panne à la souscription : 503, rien créé', async (api) => {
  api.crm.down = true;
  assert.equal((await subscribe(api)).status, 503);
  api.crm.down = false;
  assert.deepEqual((await api.call('GET', '/companies/cmp_001/subscriptions')).body, []);
});

withApi('la prochaine échéance avance avec le temps', async (api) => {
  const { body } = await subscribe(api);
  api.clock.date = new Date('2026-04-20T00:00:00Z');
  const r = await api.call('GET', `/subscriptions/${body.id}`);
  assert.equal(r.body.nextBilling.date, '2026-05-15T00:00:00.000Z');
  assert.equal((await api.call('GET', '/subscriptions/nope')).status, 404);
});

withApi('lister les abonnements d\'une entreprise', async (api) => {
  const { body } = await subscribe(api);
  await api.call('POST', `/subscriptions/${body.id}/cancel`);
  await subscribe(api, { plan: 'pro' });
  assert.equal((await api.call('GET', '/companies/cmp_001/subscriptions')).body.length, 2);
  assert.deepEqual((await api.call('GET', '/companies/cmp_002/subscriptions')).body, []);
});

withApi('changer de formule : prix, CRM, nouveau cycle', async (api) => {
  const { body } = await subscribe(api);
  api.clock.date = new Date('2026-01-20T00:00:00Z');
  const r = await api.call('PATCH', `/subscriptions/${body.id}`, { plan: 'business', billingPeriod: 'annual' });
  assert.equal(r.body.price, 990);
  assert.equal(r.body.nextBilling.date, '2027-01-20T00:00:00.000Z');
  assert.equal(api.crm.companies.cmp_001.currentPlan, 'business');
});

withApi('changer : erreurs', async (api) => {
  const { body } = await subscribe(api);
  assert.equal((await api.call('PATCH', `/subscriptions/${body.id}`, { plan: 'starter' })).status, 422);
  assert.equal((await api.call('PATCH', `/subscriptions/${body.id}`, {})).status, 422);
  await api.call('POST', `/subscriptions/${body.id}/cancel`);
  assert.equal((await api.call('PATCH', `/subscriptions/${body.id}`, { plan: 'pro' })).status, 409);
});

withApi('résilier : accès jusqu\'à la fin de période, CRM à jour, puis réabonnement possible', async (api) => {
  const { body } = await subscribe(api);
  const r = await api.call('POST', `/subscriptions/${body.id}/cancel`);
  assert.equal(r.body.status, 'canceled');
  assert.equal(r.body.endsAt, '2026-02-15T00:00:00.000Z');
  assert.equal(r.body.nextBilling, null);
  assert.deepEqual(api.crm.companies.cmp_001, { customerStatus: 'former_customer', currentPlan: null, mrr: 0 });
  assert.equal((await api.call('POST', `/subscriptions/${body.id}/cancel`)).status, 409);
  assert.equal((await subscribe(api, { plan: 'pro' })).status, 201);
});

withApi('catalogue : un nouveau prix ne touche pas les anciens abonnements', async (api) => {
  const old = (await subscribe(api, { plan: 'pro' })).body;
  assert.equal((await api.call('PUT', '/catalog/pro', { monthly: 59 })).status, 200);
  const fresh = (await subscribe(api, { companyId: 'cmp_002', plan: 'pro' })).body;
  assert.equal(fresh.price, 59);
  assert.equal((await api.call('GET', `/subscriptions/${old.id}`)).body.price, 49);
  assert.equal((await api.call('PUT', '/catalog/pro', { monthly: -5 })).status, 422);
  assert.equal((await api.call('PUT', '/catalog/gold', { monthly: 5 })).status, 404);
});

withApi('CRM en panne après la souscription : ça réussit, crmSynced=false, rattrapé au changement suivant', async (api) => {
  const { body } = await subscribe(api);
  api.crm.down = true;
  const r = await api.call('PATCH', `/subscriptions/${body.id}`, { plan: 'pro' });
  assert.equal(r.status, 200);
  assert.equal(r.body.crmSynced, false);
  api.crm.down = false;
  const r2 = await api.call('PATCH', `/subscriptions/${body.id}`, { plan: 'business' });
  assert.equal(r2.body.crmSynced, true);
  assert.equal(api.crm.companies.cmp_001.currentPlan, 'business');
});
