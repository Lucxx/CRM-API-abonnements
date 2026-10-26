# DECISIONS

## Données
Un abonnement : `id, companyId, plan, billingPeriod, status, price, startedAt, periodStart, endsAt, crmSynced`.
- `price` est copié du catalogue à la souscription, donc changer un prix du catalogue ne touche pas les abonnements existants.
- La prochaine échéance n'est pas stockée, elle est calculée à partir de `periodStart`.
- Statuts : `active` et `canceled`.
- Tout est en mémoire (voir « Pas fait »).

## Règles choisies
- **Un seul abonnement actif par entreprise** (409 sinon). Après résiliation, elle peut se réabonner.
- **Anciens prix** : un client garde son prix. S'il change de formule, il passe au prix actuel du catalogue.
- **Changement de formule ou de périodicité** : immédiat, un nouveau cycle commence le jour du changement. Pas de prorata.
- **Résiliation** : statut `canceled` tout de suite, l'accès reste valable jusqu'à `endsAt` (fin de la période payée). Pas de remboursement. Un abonnement résilié ne peut plus être modifié (409).
- **Prix HT**, TVA non calculée.
- **Fin de mois** : 31 janvier + 1 mois = 28 février, sans dérive ensuite (testé).

## CRM
Mon API fait foi, le CRM est une copie : `customerStatus` (`customer` ou `former_customer`), `currentPlan`, `mrr` (annuel divisé par 12).
- Le CRM plante parfois : 3 essais avant d'abandonner.
- Souscrire a besoin du CRM (l'entreprise doit exister) : s'il est en panne, 503 et rien n'est créé.
- Changer ou résilier : je sauvegarde d'abord, puis je préviens le CRM. S'il échoue, la requête réussit quand même avec `crmSynced: false`.

## Pas fait (manque de temps) et comment je le ferais
- **Resynchronisation du CRM** : aujourd'hui un abonnement avec `crmSynced: false` n'est remis à jour qu'au prochain changement. Je ferais une route `POST /subscriptions/:id/resync`, ou une tâche qui tourne toutes les minutes sur les abonnements à `false`.
- **Sauvegarde** : si on redémarre, tout est perdu. Je sauvegarderais dans un fichier JSON.
- **Prorata** : au changement de formule, calculer le crédit des jours non utilisés (prix × jours restants / jours de la période) et le déduire de la prochaine facture.
- **Limite d'utilisateurs** : affichée dans le catalogue mais pas appliquée, l'API ne connaît pas les utilisateurs. À la rétrogradation il faudrait vérifier que l'entreprise rentre dans la nouvelle limite.
- **Authentification** : n'importe qui peut modifier le catalogue. Je protégerais `PUT /catalog` avec une clé admin.
- TVA, essais gratuits, pagination.
