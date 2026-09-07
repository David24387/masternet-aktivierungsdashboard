# Masternet-Aktivierungsdashboard

Internes Dashboard für die wöchentlich aktualisierte Aktivierungsquote im Masternet.

## Datenschutz

Die originale Staffbase-CSV darf **nicht** in dieses Repository geladen werden. Sie enthält personenbezogene Daten. Im Repository liegt nur die anonymisierte Datei `dist/data.json` mit aggregierten Standortwerten.

## Wöchentlich aktualisieren

1. `dist/update.html` lokal im Browser öffnen.
2. Den aktuellen Staffbase-CSV-Export auswählen.
3. `data.json` herunterladen.
4. Die vorhandene Datei `dist/data.json` im Repository durch die neue Datei ersetzen.

Die Verarbeitung findet ausschließlich lokal im Browser statt.

## Dateien

- `dist/index.html` – Dashboard
- `dist/styles.css` – Gestaltung
- `dist/app.js` – Darstellung, Suche und Filter
- `dist/data.json` – anonymisierte Wochenwerte
- `dist/update.html` – lokaler, sicherer CSV-Konverter
