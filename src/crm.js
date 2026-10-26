const CRM__URL = process.env.CRM_URL || 'http://localhost:4000';
const CRM__KEY = process.env.CRM_API_KEY || 'crm-demo-key';
const CRM__TRIES = 3;

const crm__wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Le CRM renvoie parfois 503 : on réessaie, sauf si l'erreur n'est pas une panne
async function crm__request(path, options = {}) {
  let lastError;
  for (let i = 1; i <= CRM__TRIES; i++) {
    try {
      const res = await fetch(CRM__URL + path, {
        ...options,
        headers: { 'x-api-key': CRM__KEY, 'content-type': 'application/json' },
      });
      if (res.status === 404) throw Object.assign(new Error('not found'), { notFound: true });
      if (res.status >= 500) throw new Error(`CRM ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`CRM ${res.status}`), { noRetry: true });
      return await res.json();
    } catch (err) {
      if (err.notFound || err.noRetry) throw err;
      lastError = err;
      if (i < CRM__TRIES) await crm__wait(100 * i);
    }
  }
  throw Object.assign(new Error(`CRM indisponible (${lastError.message})`), { unavailable: true });
}

const crm__getCompany = (id) => crm__request(`/companies/${encodeURIComponent(id)}`);
const crm__updateCompany = (id, data) =>
  crm__request(`/companies/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });

// objet passé à createApp (remplaçable par un faux dans les tests)
module.exports = { getCompany: crm__getCompany, updateCompany: crm__updateCompany };
