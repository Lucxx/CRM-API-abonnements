// Ajoute n mois en gardant le jour (31 janv + 1 mois = 28 févr, pas 3 mars)
function dates__addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

// Prochaine échéance après "now". On repart toujours de periodStart pour ne pas dériver.
function dates__nextDue(periodStart, billingPeriod, now) {
  const step = billingPeriod === 'monthly' ? 1 : 12;
  let n = 1;
  let due = dates__addMonths(periodStart, n * step);
  while (due <= now) {
    n++;
    due = dates__addMonths(periodStart, n * step);
  }
  return due;
}

module.exports = { dates__addMonths, dates__nextDue };
