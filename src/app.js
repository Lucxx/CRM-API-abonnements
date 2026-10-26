const express = require('express');
const { randomUUID } = require('node:crypto');
const { dates__nextDue } = require('./dates');

const CATALOG__DEFAULT = {
  starter: { name: 'Starter', monthly: 19, annual: 190, maxUsers: 3 },
  pro: { name: 'Pro', monthly: 49, annual: 490, maxUsers: 10 },
  business: { name: 'Business', monthly: 99, annual: 990, maxUsers: 50 },
};
const PERIODS = ['monthly', 'annual'];

function createApp({ crm, now = () => new Date() }) {
  const app = express();
  app.use(express.json());

  const catalog__plans = structuredClone(CATALOG__DEFAULT);
  const subs__byId = {};

  const http__error = (status, message) => Object.assign(new Error(message), { status });

  const catalog__price = (plan, period) => catalog__plans[plan][period];

  function catalog__check(plan, period) {
    if (plan !== undefined && !catalog__plans[plan]) throw http__error(422, 'plan invalide');
    if (period !== undefined && !PERIODS.includes(period)) throw http__error(422, 'billingPeriod invalide');
  }

  function subs__find(id) {
    const sub = subs__byId[id];
    if (!sub) throw http__error(404, 'Abonnement inconnu');
    return sub;
  }

  function subs__view(sub) {
    const isActive = sub.status === 'active';
    return {
      id: sub.id,
      companyId: sub.companyId,
      plan: sub.plan,
      billingPeriod: sub.billingPeriod,
      status: sub.status,
      price: sub.price,
      startedAt: sub.startedAt,
      nextBilling: isActive
        ? { date: dates__nextDue(sub.periodStart, sub.billingPeriod, now()).toISOString(), amount: sub.price }
        : null,
      endsAt: sub.endsAt,
      crmSynced: sub.crmSynced,
    };
  }

  // On enregistre chez nous d'abord. Si le CRM échoue, crmSynced reste à false.
  async function subs__syncCrm(sub) {
    const mrr = sub.billingPeriod === 'monthly' ? sub.price : Math.round((sub.price / 12) * 100) / 100;
    const data = sub.status === 'active'
      ? { customerStatus: 'customer', currentPlan: sub.plan, mrr }
      : { customerStatus: 'former_customer', currentPlan: null, mrr: 0 };
    try {
      await crm.updateCompany(sub.companyId, data);
      sub.crmSynced = true;
    } catch {
      sub.crmSynced = false;
    }
  }

  // --- catalogue ---
  app.get('/catalog', (req, res) => res.json(catalog__plans));

  app.put('/catalog/:plan', (req, res) => {
    const plan = catalog__plans[req.params.plan];
    if (!plan) throw http__error(404, 'Formule inconnue');
    const { monthly, annual } = req.body;
    if (monthly === undefined && annual === undefined) throw http__error(422, 'monthly et/ou annual requis');
    for (const value of [monthly, annual]) {
      if (value !== undefined && (typeof value !== 'number' || value <= 0)) throw http__error(422, 'prix invalide');
    }
    if (monthly !== undefined) plan.monthly = monthly;
    if (annual !== undefined) plan.annual = annual;
    res.json(catalog__plans);
  });

  // --- abonnements ---
  app.post('/subscriptions', async (req, res) => {
    const { companyId, plan, billingPeriod } = req.body;
    if (!companyId || !plan || !billingPeriod) throw http__error(422, 'companyId, plan et billingPeriod requis');
    catalog__check(plan, billingPeriod);

    try {
      await crm.getCompany(companyId);
    } catch (err) {
      if (err.notFound) throw http__error(404, 'Entreprise inconnue du CRM');
      throw http__error(503, 'CRM indisponible');
    }

    const existing = Object.values(subs__byId).find((s) => s.companyId === companyId && s.status === 'active');
    if (existing) throw http__error(409, `Abonnement déjà actif (${existing.id})`);

    const sub = {
      id: `sub_${randomUUID().slice(0, 8)}`,
      companyId,
      plan,
      billingPeriod,
      status: 'active',
      price: catalog__price(plan, billingPeriod), // prix copié : les anciens clients gardent leur prix
      startedAt: now().toISOString(),
      periodStart: now().toISOString(),
      endsAt: null,
      crmSynced: false,
    };
    subs__byId[sub.id] = sub;
    await subs__syncCrm(sub);
    res.status(201).json(subs__view(sub));
  });

  app.get('/subscriptions/:id', (req, res) => res.json(subs__view(subs__find(req.params.id))));

  app.get('/companies/:companyId/subscriptions', (req, res) => {
    const list = Object.values(subs__byId).filter((s) => s.companyId === req.params.companyId);
    res.json(list.map(subs__view));
  });

  app.patch('/subscriptions/:id', async (req, res) => {
    const sub = subs__find(req.params.id);
    if (sub.status !== 'active') throw http__error(409, 'Abonnement résilié');
    const { plan, billingPeriod } = req.body;
    if (plan === undefined && billingPeriod === undefined) throw http__error(422, 'plan et/ou billingPeriod requis');
    catalog__check(plan, billingPeriod);
    const newPlan = plan ?? sub.plan;
    const newPeriod = billingPeriod ?? sub.billingPeriod;
    if (newPlan === sub.plan && newPeriod === sub.billingPeriod) throw http__error(422, 'Aucun changement');

    // changement immédiat, nouveau cycle à partir d'aujourd'hui
    sub.plan = newPlan;
    sub.billingPeriod = newPeriod;
    sub.price = catalog__price(newPlan, newPeriod);
    sub.periodStart = now().toISOString();
    await subs__syncCrm(sub);
    res.json(subs__view(sub));
  });

  app.post('/subscriptions/:id/cancel', async (req, res) => {
    const sub = subs__find(req.params.id);
    if (sub.status !== 'active') throw http__error(409, 'Abonnement déjà résilié');
    sub.endsAt = dates__nextDue(sub.periodStart, sub.billingPeriod, now()).toISOString();
    sub.status = 'canceled';
    await subs__syncCrm(sub);
    res.json(subs__view(sub));
  });

  // --- erreurs ---
  app.use((req, res) => res.status(404).json({ error: 'Route inconnue' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  });

  return app;
}

module.exports = { createApp };
