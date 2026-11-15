#!/usr/bin/env node
// Haalt het open prijsbestand van Checkjebon op en bewaart daaruit alleen de
// prijs en de inhoud van de AH-producten in koppelingen.json.
//
// Gebruik:  node ververs.mjs
//
// Invoer:   koppelingen.json   per product het gekozen AH-product en eventuele andere maten
// Uitvoer:  prijzen.json       klein bestand dat de app half zes. dagelijks ophaalt
//
// Gaat er iets mis bij het ophalen, of bevat het bestand opvallend weinig
// producten, dan stopt het programma met een fout en blijft het vorige
// prijzenbestand staan.

import { readFile, writeFile } from 'node:fs/promises';

const BRON = 'https://raw.githubusercontent.com/supermarkt/checkjebon/main/data/supermarkets.json';

/** Leest de inhoud van een verpakking: '190 g', '1,5 kg', '0,75 l', '3 stuks', 'per stuk', 'ca. 150 g', '2 x 100 g'. */
function leesInhoud(inhoud) {
  const tekst = inhoud.toLowerCase().replace(/ca\.?\s*/, '').replace(',', '.').trim();
  if (tekst === 'per stuk') return { hoeveelheid: 1, eenheid: 'stuk' };
  const delen = tekst.match(/^(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(g|gram|kg|ml|cl|l|liter|stuks?|st)\b/);
  if (!delen) return null;
  const aantal = Number(delen[1] ?? 1) * Number(delen[2]);
  switch (delen[3]) {
    case 'g': case 'gram': return { hoeveelheid: aantal, eenheid: 'g' };
    case 'kg': return { hoeveelheid: aantal * 1000, eenheid: 'g' };
    case 'ml': return { hoeveelheid: aantal, eenheid: 'ml' };
    case 'cl': return { hoeveelheid: aantal * 10, eenheid: 'ml' };
    case 'l': case 'liter': return { hoeveelheid: aantal * 1000, eenheid: 'ml' };
    default: return { hoeveelheid: aantal, eenheid: 'stuk' };
  }
}

const antwoord = await fetch(BRON, { headers: { 'User-Agent': 'halfzes-prijzen/0.1' } });
if (!antwoord.ok) {
  console.log(`Het prijsbestand kon niet worden opgehaald (${antwoord.status}). De vorige prijzen blijven staan.`);
  process.exit(1);
}
const ah = (await antwoord.json()).find((supermarkt) => supermarkt.n === 'ah');
if (!ah || !Array.isArray(ah.d) || ah.d.length < 5000) {
  console.log('Het prijsbestand bevat te weinig AH-producten. De vorige prijzen blijven staan.');
  process.exit(1);
}
const opId = new Map(ah.d.map((p) => [String(p.l).split('/')[0], { id: String(p.l).split('/')[0], naam: p.n, inhoud: p.s, prijs: p.p }]));

const { koppelingen } = JSON.parse(await readFile(new URL('./koppelingen.json', import.meta.url), 'utf8'));
const producten = {};
const ontbreekt = [];

for (const [boodschap, koppeling] of Object.entries(koppelingen)) {
  if (koppeling.product === null) continue;
  const maten = [];
  for (const [index, id] of [koppeling.product, ...(koppeling.andereMaten ?? [])].entries()) {
    // Het productbestand is niet compleet: staat de hoofdmaat er niet in, dan geldt wat de koppeling zelf opgeeft.
    const handmatig =
      index === 0 && koppeling.handmatig
        ? { id, naam: koppeling.handmatig.naam, inhoud: koppeling.handmatig.inhoud, prijs: koppeling.handmatig.prijsCent / 100 }
        : undefined;
    // Loopt het productbestand achter en is het product zelf nagekeken ('gaatVoor'), dan geldt de koppeling.
    const product = (handmatig && koppeling.handmatig.gaatVoor ? handmatig : undefined) ?? opId.get(id) ?? handmatig;
    // Bij de hoofdmaat mag de koppeling zelf zeggen wat er in de verpakking zit (tenen in een bol knoflook).
    const verpakking = product && ((index === 0 && koppeling.verpakking) || leesInhoud(product.inhoud));
    if (!product || !verpakking || !(product.prijs > 0)) continue;
    if (maten.length && verpakking.eenheid !== maten[0].verpakking.eenheid) continue;
    maten.push({ product: product.id, naam: product.naam, inhoud: product.inhoud, verpakking, prijsCent: Math.round(product.prijs * 100) });
  }
  if (maten.length === 0) { ontbreekt.push(boodschap); continue; }
  producten[boodschap] = { gramPerStuk: koppeling.gramPerStuk ?? null, maten };
}

// Vallen er opeens veel producten weg, dan klopt er iets niet aan de bron.
const gekoppeld = Object.values(koppelingen).filter((k) => k.product !== null).length;
if (Object.keys(producten).length < gekoppeld * 0.8) {
  console.log(`Maar ${Object.keys(producten).length} van de ${gekoppeld} gekoppelde producten gevonden. De vorige prijzen blijven staan.`);
  process.exit(1);
}

const datum = new Date().toISOString().slice(0, 10);
await writeFile(
  new URL('./prijzen.json', import.meta.url),
  JSON.stringify({ datum, bron: 'Checkjebon (checkjebon.nl), prijzen van Albert Heijn', producten, ontbreekt }, null, 2) + '\n',
);
console.log(`✓ ${Object.keys(producten).length} producten met prijs bewaard in prijzen.json (${datum})`);
if (ontbreekt.length) console.log(`  Niet meer gevonden: ${ontbreekt.join(', ')}`);
