// Lee los reportes JSON que generó run-newman.ps1 y muestra un resumen en tabla
// Markdown (lista para pegar en INFORME.md).
// Uso: node scripts/resumen-newman.js evidencias/part1/newman/b1ls
const fs = require('fs');
const path = require('path');

const folder = process.argv[2];
if (!folder) {
  console.error('Uso: node scripts/resumen-newman.js <carpeta_con_reportes>');
  process.exit(1);
}

const files = fs.readdirSync(folder)
  .filter(f => /^newman-\d+\.json$/.test(f))
  .sort();
if (!files.length) {
  console.error(`No hay reportes newman-*.json en ${folder}`);
  process.exit(1);
}

const seg = ms => (ms === undefined ? '-' : (ms / 1000).toFixed(2));
const todos = [];
const porVm = {};
const errores = [];

console.log('| Ejecución | Peticiones | Exitosas | Fallidas | Prom. (s) | Mín. (s) | Máx. (s) | Duración total (s) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const file of files) {
  const run = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')).run;
  const tiempos = [];
  let fallidas = 0;
  for (const e of run.executions) {
    if (e.requestError || !e.response || e.response.code >= 400) {
      fallidas++;
      const err = e.requestError || {};
      errores.push(`${file}: ${err.code || (e.response && e.response.code) || ''} ${err.message || ''}`.trim());
      continue;
    }
    tiempos.push(e.response.responseTime);
    const h = (e.response.header || []).find(x => x.key.toLowerCase() === 'x-served-by');
    if (h) porVm[h.value] = (porVm[h.value] || 0) + 1;
  }
  todos.push(...tiempos);
  const prom = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : undefined;
  const min = tiempos.length ? Math.min(...tiempos) : undefined;
  const max = tiempos.length ? Math.max(...tiempos) : undefined;
  const dur = (run.timings.completed - run.timings.started) / 1000;
  console.log(`| ${file.replace('.json', '')} | ${run.executions.length} | ${tiempos.length} | ${fallidas} | ${seg(prom)} | ${seg(min)} | ${seg(max)} | ${dur.toFixed(1)} |`);
}

if (todos.length) {
  console.log(`\nPromedio global de respuestas exitosas: ${seg(todos.reduce((a, b) => a + b, 0) / todos.length)} s`);
}
if (errores.length) {
  console.log('\nErrores:');
  errores.forEach(e => console.log(`  - ${e}`));
}
if (Object.keys(porVm).length) {
  console.log('\nPeticiones atendidas por cada VM (encabezado X-Served-By):');
  Object.keys(porVm).sort().forEach(vm => console.log(`  - ${vm}: ${porVm[vm]}`));
}
