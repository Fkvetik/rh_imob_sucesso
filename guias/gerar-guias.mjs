// Gera os PDFs dos guias da extensão com o Edge.
//   node guias/gerar-guias.mjs
// Cada guias/<nome>.html vira assets/guias/RH-IMOB-Guia-<Nome>.pdf.
// Depois é só commitar o site.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(AQUI, '..', 'assets', 'guias');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const GUIAS = {
  'base': 'Base',
  'catho': 'Catho',
  'minha-lista': 'Minha-lista-CSV',
  'banco-de-talentos': 'Banco-de-Talentos',
  'corretores-creci': 'Corretores-CRECI',
  'creci-instagram': 'CRECI-Instagram'
};

fs.mkdirSync(SAIDA, { recursive: true });
// perfil próprio: sem ele, com o Edge já aberto, o comando volta antes de gravar o PDF
const PERFIL = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-guias-'));
const esperar = (f) => { const fim = Date.now() + 30000; while (!fs.existsSync(f) && Date.now() < fim) execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 400']); };
for (const [arq, nome] of Object.entries(GUIAS)) {
  const pdf = path.join(SAIDA, `RH-IMOB-Guia-${nome}.pdf`);
  if (fs.existsSync(pdf)) fs.unlinkSync(pdf);
  execFileSync(EDGE, ['--headless', `--user-data-dir=${PERFIL}`, '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000', `--print-to-pdf=${pdf}`, pathToFileURL(path.join(AQUI, arq + '.html')).href], { stdio: 'ignore' });
  esperar(pdf);
  console.log('✓', path.basename(pdf), Math.round(fs.statSync(pdf).size / 1024) + ' KB');
}
