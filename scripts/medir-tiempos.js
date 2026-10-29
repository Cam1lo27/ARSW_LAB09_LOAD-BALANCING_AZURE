// Pegue este código en la consola del navegador (F12 > Console) estando en
// http://<IP_VM>:3000/  (o http://<IP_BALANCEADOR>/ en la parte 2).
// Hace las 10 peticiones una tras otra y muestra una tabla con los tiempos.
(async () => {
  const valores = [1000000, 1010000, 1020000, 1030000, 1040000,
                   1050000, 1060000, 1070000, 1080000, 1090000];
  const resultados = [];
  for (const nth of valores) {
    const inicio = performance.now();
    try {
      const resp = await fetch(`/fibonacci/${nth}`, { cache: 'no-store' });
      await resp.text();
      const segundos = (performance.now() - inicio) / 1000;
      resultados.push({ nth, estado: resp.status, 'tiempo (s)': +segundos.toFixed(2),
                        vm: resp.headers.get('X-Served-By') });
      console.log(`nth=${nth} -> ${segundos.toFixed(2)} s`);
    } catch (e) {
      resultados.push({ nth, estado: 'ERROR', 'tiempo (s)': null, vm: String(e) });
    }
  }
  const ok = resultados.filter(r => r['tiempo (s)'] !== null);
  const promedio = ok.reduce((s, r) => s + r['tiempo (s)'], 0) / (ok.length || 1);
  console.table(resultados);
  console.log(`Promedio: ${promedio.toFixed(2)} s`);
})();
