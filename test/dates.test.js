const test = require('node:test');
const assert = require('node:assert/strict');
const { dates__addMonths, dates__nextDue } = require('../src/dates');

const day = (d) => d.toISOString().slice(0, 10);

test('31 janvier + 1 mois = 28 février', () => {
  assert.equal(day(dates__addMonths(new Date('2026-01-31T00:00:00Z'), 1)), '2026-02-28');
});

test('passage d\'année', () => {
  assert.equal(day(dates__addMonths(new Date('2026-12-15T00:00:00Z'), 1)), '2027-01-15');
});

test('échéance mensuelle sans dérive', () => {
  const start = new Date('2026-01-31T00:00:00Z');
  assert.equal(day(dates__nextDue(start, 'monthly', new Date('2026-03-10T00:00:00Z'))), '2026-03-31');
});

test('échéance annuelle', () => {
  const start = new Date('2026-01-15T00:00:00Z');
  assert.equal(day(dates__nextDue(start, 'annual', new Date('2026-06-01T00:00:00Z'))), '2027-01-15');
});
