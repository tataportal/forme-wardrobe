import { readFileSync } from 'node:fs';
const operator = JSON.parse(readFileSync(new URL('../shared/legal-operator.json', import.meta.url), 'utf8'));
const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operator.email || '');
const contactUrlReady = /^https:\/\//.test(operator.contactUrl || '');
if (!operator.name?.trim() || !operator.country?.trim() || (!emailReady && !contactUrlReady)) {
  console.error('No se puede publicar: configura el nombre del servicio, país y un canal público de contacto en shared/legal-operator.json.');
  process.exit(1);
}
