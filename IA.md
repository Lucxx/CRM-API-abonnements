# Journal d'usage de l'IA

Outil : Claude.

## Ce que j'ai demandé
- Me donner tout d'abord un plan à suivre pour faire l'exercice en 3h avec un temps estimé pour chaque tâche.
- De réaliser l'API complète (souscrire, consulter, lister, changer de formule, résilier, prix, fiche CRM), avec des tests et des exemples d'appels simples.
- `src/app.js` : les routes de l'API (catalogue, souscrire, consulter, lister, changer de formule, résilier) avec les règles : un seul abonnement actif par entreprise, prix copié dans l'abonnement, codes d'erreur (404, 409, 422, 503).
- `src/crm.js` : la communication avec le CRM (clé API, lecture et mise à jour d'une entreprise) et 3 essais quand il renvoie une erreur 503.
- `src/dates.js` : le calcul de la prochaine échéance, avec le cas du 31 + 1 mois.
- `test/` : des tests avec un faux CRM, pour ne pas dépendre du vrai.
- Des explications sur ce qu'il me proposait de mettre en place et que je ne comprenais pas : prorata, format des dates pour l'API, variable CRM_FAIL_RATE, rôle du CRM


## Ce que j'ai gardé
- Express pour créer l'API : simple à lire, c'est le framework Node le plus courant.
- Un seul abonnement actif par entreprise, pour que la fiche CRM n'affiche qu'une seule formule en cours.
- Le prix copié dans l'abonnement, pour garder les anciens prix quand le catalogue change.
- Changement de formule immédiat, et résiliation avec accès jusqu'à la fin de la période payée.
- 3 essais quand le CRM plante, et un champ `crmSynced` si la mise à jour du CRM échoue.
- Des tests avec un faux CRM.

## Ce que j'ai corrigé ou refusé
- Modifié le nom des variables pour que ce soit plus facile de savoir de quoi on parle (ex : catalog__price, dates__nextDue)
- Décidé moi-même du comportement de la résiliation : accès jusqu'à la fin de la période payée, sans remboursement.
- Réduit les commentaires du code à ceux qui sont vraiment utiles.
- Choisi de ne pas faire de prorata (non demandé dans l'énoncé, et les règles autour demandaient des choix que je ne voulais pas faire à moitié), noté dans DECISIONS.md.

## Ce que j'ai vérifié moi-même
- Le code en lui-même.
- Lancé `npm test`.
- Testé les routes avec requests.http (Extension REST Client) et avec curl.
- Regardé la fiche entreprise dans le CRM après une souscription.
- Testé avec le CRM qui plante (CRM_FAIL_RATE=0.3) (30% des requêtes renvoient une erreur)
