import fs from 'node:fs';

const [input, output = './dist/data.json'] = process.argv.slice(2);
if (!input) throw new Error('CSV-Datei fehlt.');

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()])));
}

const records = parseCSV(fs.readFileSync(input, 'utf8'));
const centerRows = records.filter(r => r['Gruppe: Mitarbeiter | In Center']?.toLowerCase() === 'true');
const groups = new Map();

for (const row of centerRows) {
  const name = row['Euromaster Standort'] || row['Standort'] || 'Nicht zugeordnet';
  const key = name.toLocaleLowerCase('de-DE');
  if (!groups.has(key)) groups.set(key, {
    name,
    scNumbers: new Map(),
    state: row['Bundesland'] || 'Nicht zugeordnet',
    region: row['Bereich'] || 'Nicht zugeordnet',
    area: row['Gebiet'] || 'Nicht zugeordnet',
    centerType: row['Centertyp (Light / Mixed / Heavy)'] || 'Unbekannt',
    activated: 0,
    pending: 0
  });
  const group = groups.get(key);
  const sc = row['SC Nummer (3-stellige Nr. /HQ )'];
  if (sc) group.scNumbers.set(sc, (group.scNumbers.get(sc) || 0) + 1);
  if (row['Status'] === 'activated') group.activated++;
  if (row['Status'] === 'pending') group.pending++;
}

const centers = [...groups.values()].map(g => {
  const sc = [...g.scNumbers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const total = g.activated + g.pending;
  return {
    name: g.name, sc, state: g.state, region: g.region, area: g.area,
    centerType: g.centerType, activated: g.activated, pending: g.pending,
    total, rate: total ? Math.round(g.activated / total * 1000) / 10 : 0
  };
}).sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));

const total = centers.reduce((s, c) => s + c.total, 0);
const activated = centers.reduce((s, c) => s + c.activated, 0);
const sourceDate = input.match(/(20\d{2})-(\d{2})-(\d{2})/)?.slice(1).join('-') || new Date().toISOString().slice(0,10);
const data = {
  updated: sourceDate,
  summary: { centers: centers.length, total, activated, pending: total - activated, rate: Math.round(activated / total * 1000) / 10 },
  centers
};
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
console.log(`Anonymisierte Daten erstellt: ${centers.length} Standorte, ${total} Personen.`);

