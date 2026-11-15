# Prijzen voor half zes.

Dit project houdt één klein bestand bij: [`prijzen.json`](prijzen.json). Daarin staan de
actuele prijs en inhoud van de producten van Albert Heijn die de app half zes. gebruikt om
uit te rekenen wat een weekmenu bij de kassa kost.

- De prijzen komen uit het open prijsbestand van [Checkjebon](https://www.checkjebon.nl/)
  ([supermarkt/checkjebon](https://github.com/supermarkt/checkjebon)).
- Een geautomatiseerde taak haalt dat bestand elke ochtend op en bewaart alleen de producten
  uit [`koppelingen.json`](koppelingen.json).
- Gaat het ophalen mis, of ziet het bestand er vreemd uit, dan blijft de vorige versie staan.

Dit is geen officiële gegevensbron van Albert Heijn. Prijzen kunnen afwijken van de winkel.
