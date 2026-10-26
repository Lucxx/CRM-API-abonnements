# API d'abonnements

API REST (Node.js 20+, Express) pour gérer les abonnements Starter / Pro / Business, en mensuel ou annuel, et mettre à jour la fiche entreprise du CRM.

## Lancer

```bash
# terminal 1 (dossier kit-exercice-1) : le faux CRM
npm run crm            # http://localhost:4000

# terminal 2 (ici) : l'API
npm install
npm start        # http://localhost:3000
```

Le faux CRM doit tourner à côté (`npm run crm` dans le kit, port 4000).
Variables optionnelles : `PORT`, `CRM_URL`, `CRM_API_KEY`.

Tests : `npm test` (pas besoin du CRM, il est simulé).

## Routes

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/catalog` | Formules et prix HT |
| PUT | `/catalog/:plan` | Changer un prix (`{ "monthly": 59 }`), nouveaux clients seulement |
| POST | `/subscriptions` | Souscrire `{ companyId, plan, billingPeriod }` |
| GET | `/subscriptions/:id` | Formule, statut, prochaine échéance et montant |
| GET | `/companies/:companyId/subscriptions` | Abonnements d'une entreprise |
| PATCH | `/subscriptions/:id` | Changer de formule et/ou de périodicité |
| POST | `/subscriptions/:id/cancel` | Résilier |

`plan` : `starter`, `pro`, `business`. `billingPeriod` : `monthly`, `annual`.
Exemples d'appels dans `examples/requests.http`. Choix et limites : `DECISIONS.md`.
