# Informe – Laboratorio 9: Escalamiento en Azure (vertical y horizontal)

**Escuela Colombiana de Ingeniería – Arquitecturas de Software (ARSW)**
**Autor:** Andrés Vivas

> Las imágenes de este informe se leen de la carpeta `evidencias/`. Guarde cada pantallazo con el
> nombre exacto que aparece en el enlace para que se vea automáticamente en GitHub.
> Los textos marcados con `TODO` se completan con los datos que obtenga en sus pruebas.

---

## Parte 0 – Escenario de calidad

| Elemento | Valor |
|---|---|
| Fuente | Conjunto de usuarios concurrentes |
| Estímulo | Consultan el enésimo número de Fibonacci (n > 1 000 000) |
| Artefacto | FibonacciApp (Node.js + Express) |
| Ambiente | Operación normal |
| Respuesta | Todas las peticiones son respondidas |
| Medida | 100 % de peticiones exitosas y CPU ≤ 70 % |

---

## Parte 1 – Escalabilidad vertical

### Creación de la VM

> **Nota sobre el tamaño de la VM:** con la suscripción *Azure for Students* los tamaños de 1 vCPU
> (B1ls, B1s, A1_v2, B1ms) aparecen como **"Tamaño no disponible"** en todas las regiones probadas
> (Brazil South, East US 2, ...). Por eso la VM se creó con **Standard_D2s_v3** (2 vCPU, 8 GiB) en
> **East US 2**, y el escalamiento vertical se hizo hacia el siguiente tamaño de la misma familia,
> **Standard_D4s_v3** (4 vCPU, 16 GiB), en lugar de B1ls → B2ms. El objetivo del experimento —comparar
> la misma VM antes y después de aumentar su tamaño— se mantiene.

![B1ls no disponible en Brazil South](evidencias/part1/p1-00-b1ls-no-disponible-brazil.png)
![Tamaños de 1 vCPU no disponibles](evidencias/part1/p1-00-b1ls-no-disponible.png)

![Configuración de la VM](evidencias/part1/p1-01-vm-config.png)
![Configuración de la VM (detalle)](evidencias/part1/p1-01-vm-config-2.png)

![VM creada](evidencias/part1/p1-01-vm-creada.png)

![Recursos del grupo](evidencias/part1/p1-02-recursos-grupo.png)

![Conexión SSH](evidencias/part1/p1-03-ssh-conexion.png)

![Node instalado](evidencias/part1/p1-04-node-version.png)

![npm install](evidencias/part1/p1-05-npm-install.png)

App ejecutada con `node FibonacciApp.js` mientras la sesión SSH está abierta:

![App con SSH abierto](evidencias/part1/p1-06a-app-con-ssh.png)

Después de cerrar la sesión SSH, la misma URL responde `ERR_CONNECTION_REFUSED`:

![App cae al cerrar SSH](evidencias/part1/p1-06b-app-cae-sin-ssh.png)

![Reglas antes de abrir el 3000](evidencias/part1/p1-07-reglas-antes.png)

![Inbound rule 3000](evidencias/part1/p1-07-inbound-rule-3000.png)

App ejecutada con `forever` (un solo proceso):

![forever list](evidencias/part1/p1-08a-forever-list.png)

Tras cerrar la sesión SSH la app sigue respondiendo:

![fibonacci/6 sin SSH](evidencias/part1/p1-08b-app-sin-ssh.png)

### Preguntas

**1. ¿Cuántos y cuáles recursos crea Azure junto con la VM?**

En el grupo `SCALABILITY_LAB` quedaron **6 recursos** (la VM y otros **5 recursos** que Azure crea junto con ella), todos en East US 2 (ver `p1-02-recursos-grupo.png`):

| # | Recurso (tipo) | Nombre |
|---|---|---|
| 1 | Máquina virtual | `VERTICAL-SCALABILITY` |
| 2 | Dirección IP pública | `VERTICAL-SCALABILITY-ip` (20.242.45.21) |
| 3 | Grupo de seguridad de red (NSG) | `VERTICAL-SCALABILITY-nsg` |
| 4 | Interfaz de red (NIC) | `vertical-scalability99` |
| 5 | Disco (disco del SO) | `VERTICAL-SCALABILITY_OsDisk_...` |
| 6 | Red virtual (con su subred `snet-eastus2-1`) | `vnet-eastus2-1` |

No aparece un recurso de llave SSH porque se usó una llave pública existente en lugar de generarla en Azure.

**2. ¿Para qué sirve cada recurso?**

- **Virtual machine:** cómputo (vCPU + RAM) donde corre el sistema operativo y la aplicación.
- **OS Disk:** disco administrado persistente que contiene el sistema operativo y los archivos de la VM (sobrevive a reinicios y cambios de tamaño).
- **Network interface:** tarjeta de red virtual que conecta la VM a la subred, tiene la IP privada y referencia la IP pública y el NSG.
- **Public IP address:** dirección accesible desde Internet para entrar por SSH y consumir el servicio.
- **Network security group:** firewall con reglas de entrada/salida (puerto, protocolo, origen, destino, prioridad) que filtran el tráfico de la NIC/subred.
- **Virtual network + subnet:** red privada aislada en Azure donde viven los recursos; define el espacio de direcciones privadas.
- **SSH key:** guarda la llave pública usada para autenticarse en la VM.

**3. ¿Por qué se cae la aplicación al cerrar la conexión SSH? ¿Por qué hay que crear un *Inbound port rule*?**

- El proceso `node FibonacciApp.js` se lanza como hijo de la shell de la sesión SSH. Cuando la sesión termina, el sistema envía la señal **SIGHUP** a la sesión y a sus procesos hijos, que terminan. Por eso se usa `forever` (o `nohup`, `pm2`, `systemd`), que ejecuta el proceso como *daemon* desacoplado de la terminal y además lo reinicia si falla.
- El NSG que se crea con la VM **niega por defecto todo el tráfico entrante desde Internet** (regla `DenyAllInBound`) y solo se abrieron los puertos 22/80. La app escucha en el **puerto 3000**, así que sin una regla que lo permita los paquetes se descartan antes de llegar a la VM.

**4. Tabla de tiempos e interpretación**

Tiempos medidos desde la consola del navegador con [scripts/medir-tiempos.js](scripts/medir-tiempos.js) (peticiones secuenciales):

![Tiempos D2s_v3](evidencias/part1/p1-09-tiempos-d2sv3.png)
![Tiempos D4s_v3](evidencias/part1/p1-13-tiempos-d4sv3.png)

| n | D2s_v3 (s) | D4s_v3 (s) |
|---|---|---|
| 1 000 000 | 11.05 | 10.77 |
| 1 010 000 | 11.26 | 11.14 |
| 1 020 000 | 11.49 | 10.84 |
| 1 030 000 | 11.67 | 11.23 |
| 1 040 000 | 11.99 | 11.35 |
| 1 050 000 | 12.25 | 11.48 |
| 1 060 000 | 12.28 | 11.71 |
| 1 070 000 | 12.63 | 11.97 |
| 1 080 000 | 12.71 | 12.81 |
| 1 090 000 | 12.78 | 12.86 |
| **Promedio** | **12.01** | **11.62** |

Todas las peticiones respondieron `200`, pero cada una tarda **más de 11 segundos**. Además, el tiempo crece más rápido que `n`: al pasar de 1 000 000 a 1 090 000 (+9 % en `n`) el tiempo sube de 11.05 s a 12.78 s (+15.7 %), lo que es consistente con un costo superlineal (≈ O(n²)).

La función tarda tanto porque:
- Recorre la secuencia completa (n − 1 iteraciones) en cada petición: **no hay memoización ni caché**, aunque el valor ya se haya calculado antes.
- Usa `big-integer`: F(1 000 000) tiene ≈ **208 988 dígitos**. Cada suma cuesta O(número de dígitos), así que el costo total es aproximadamente **O(n²)** y no O(n).
- Cada iteración crea un nuevo objeto `bigInt` inmutable, lo que genera mucha basura y trabajo para el *garbage collector*.
- Node.js ejecuta JavaScript en **un solo hilo**: mientras se calcula una petición, el *event loop* queda bloqueado y las demás esperan en cola.
- Existen algoritmos O(log n) (multiplicación de matrices / *fast doubling*) que serían mucho más rápidos.

**5. Consumo de CPU e interpretación**

![CPU D2s_v3](evidencias/part1/p1-10-cpu-d2sv3.png)

Métrica *Percentage CPU (Max)* de la última hora. Durante la prueba de tiempos (≈ 5:09–5:12 p. m.) la CPU llegó a un máximo de **46.19 %**. Los picos anteriores (≈ 37 % a las 4:30 y ≈ 35 % a las 4:43) corresponden a la instalación de Node y a `npm install`.

El cálculo es **CPU-bound**: es un ciclo sin I/O que mantiene ocupado el núcleo hasta terminar. Como Node.js ejecuta el JavaScript en **un solo hilo**, el cálculo ocupa al 100 % **uno** de los **2 vCPU** de la D2s_v3, y Azure muestra el promedio de toda la VM: ≈ 50 % (el 46 % medido). Es decir, la VM no está "a media carga": el núcleo que usa la app está saturado y el otro queda prácticamente sin uso. Por eso agregar más vCPU no acelera una petición individual.

**6. Resumen de la ejecución de Postman (newman)**

Dos ejecuciones de newman en paralelo (10 iteraciones cada una, `nth = 1000000`) contra la VM D2s_v3, lanzadas con [scripts/run-newman.ps1](scripts/run-newman.ps1):

Ejecución 1:

![Newman D2s_v3 ejecución 1](evidencias/part1/p1-11-newman-d2sv3-1a.png)
![Newman D2s_v3 ejecución 1 – fallos](evidencias/part1/p1-11-newman-d2sv3-1b.png)

Ejecución 2:

![Newman D2s_v3 ejecución 2](evidencias/part1/p1-11-newman-d2sv3-2a.png)
![Newman D2s_v3 ejecución 2 – fallos](evidencias/part1/p1-11-newman-d2sv3-2b.png)

Resumen (`node scripts/resumen-newman.js evidencias/part1/newman/d2sv3`, tiempos solo de las peticiones exitosas):

| Ejecución | Peticiones | Exitosas | Fallidas | Prom. (s) | Mín. (s) | Máx. (s) | Duración total (s) |
|---|---|---|---|---|---|---|---|
| newman-1 | 10 | 5 | 5 | 13.14 | 10.84 | 21.73 | 119.7 |
| newman-2 | 10 | 6 | 4 | 12.77 | 10.85 | 21.70 | 119.9 |
| **Total** | **20** | **11 (55 %)** | **9 (45 %)** | **12.94** | | | |

Resultado de cada iteración (s = tiempo de respuesta, ERR = `ECONNRESET`):

| Iteración | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| newman-1 | 21.7 | ERR | 11.1 | ERR | 11.0 | ERR | 11.1 | ERR | 10.8 | ERR |
| newman-2 | 21.7 | 10.9 | ERR | 11.1 | ERR | 11.0 | ERR | 11.0 | ERR | 10.9 |

- **Tiempos de ejecución:** las peticiones exitosas tardaron entre **10.8 s y 21.7 s** (promedio 12.9 s; newman reporta 15.3 s y 13.6 s porque incluye también el tiempo de las fallidas). La primera petición de cada ejecución tardó **21.7 s**, casi el doble de lo normal: llegaron las dos al mismo tiempo y, como Node atiende **una sola petición a la vez** en su único hilo, una tuvo que esperar a que terminara el cálculo de la otra (≈ 10.8 s + 10.8 s). Cada ejecución duró ~2 minutos.
- **Fallos:** **9 de 20 peticiones (45 %) fallaron** con `read ECONNRESET`, es decir, el servidor cerró la conexión TCP. Los fallos **se alternan** entre las dos ejecuciones (cuando una responde, la otra falla), lo que muestra que no es un fallo aleatorio sino un efecto de la concurrencia:
  1. newman reutiliza la misma conexión TCP (*keep-alive*) para todas sus peticiones, y Node cierra una conexión *keep-alive* que lleva más de 5 s inactiva.
  2. Mientras la VM calcula la petición de la ejecución A (~11 s), el *event loop* de Node está bloqueado y no puede atender la nueva petición que la ejecución B ya envió por su conexión.
  3. Cuando el cálculo termina, Node procesa sus temporizadores atrasados, ve que la conexión de B lleva más de 5 s "inactiva" y la cierra, descartando la petición que estaba esperando → B recibe `ECONNRESET`.
  
  ![CPU durante newman](evidencias/part1/p1-11-cpu-newman-d2sv3.png)

  Durante la prueba con newman (≈ 5:31–5:35 p. m.) la CPU se mantuvo en un máximo de **48.66 %**, es decir, un núcleo saturado y el otro libre.

  La causa no es falta de recursos de la VM (la CPU total estaba en ~50 %), sino que el cálculo bloquea el único hilo de Node. Por eso el sistema **no cumple** el escenario de calidad: no todas las peticiones concurrentes son respondidas.

**7. Diferencia entre B2ms y B1ls**

| | B1ls | B2ms |
|---|---|---|
| vCPU | 1 | 2 |
| RAM | 0.5 GiB | 8 GiB |
| Rendimiento base de CPU (burstable) | ~5 % | ~60 % |
| Créditos acumulables | pocos | muchos más |
| Discos de datos / IOPS / red | límites muy bajos | límites mayores |
| Costo aprox. (Linux, pago por uso) | ~US$ 4 / mes | ~US$ 60 / mes |

Más allá del hardware: la B1ls está pensada para cargas casi inactivas (pruebas, servidores pequeños) y solo puede usar ráfagas cortas de CPU; la B2ms soporta cargas sostenidas mucho más altas antes de agotar créditos y tiene más memoria para manejar varias peticiones simultáneas, pero cuesta ~15 veces más.

**Tamaños usados realmente en este laboratorio** (B1ls no estaba disponible, ver nota al inicio):

| | Standard_D2s_v3 (inicial) | Standard_D4s_v3 (escalada) |
|---|---|---|
| vCPU | 2 | 4 |
| RAM | 8 GiB | 16 GiB |
| Tipo de CPU | Rendimiento fijo (no *burstable*: puede usar el 100 % de sus núcleos todo el tiempo, sin créditos) | Igual |
| Discos de datos máx. | 4 | 8 |
| IOPS máx. | 3 200 | 6 400 |
| Almacenamiento temporal | 16 GiB | 32 GiB |
| Ancho de banda de red aprox. | 1 000 Mbps | 2 000 Mbps |
| Costo (East US 2, Linux, pago por uso) | ≈ USD 0.096/h (≈ USD 70/mes) | ≈ USD 0.192/h (**USD 140.16/mes**, según el portal) |

Al pasar a D4s_v3 **todo se duplica, incluido el precio**. La diferencia con la pareja B1ls/B2ms es que la serie D no usa créditos de CPU, por lo que el rendimiento de la máquina pequeña no se degrada con el tiempo; lo único que gana la grande es más núcleos, más memoria y más capacidad de disco y red.

**8. ¿Aumentar el tamaño de la VM es una buena solución? ¿Qué pasa con la FibonacciApp al cambiar el tamaño?**

No es una buena solución en este escenario:
- Node.js usa un solo hilo para el JavaScript, así que **un solo proceso no aprovecha la segunda vCPU**: cada cálculo sigue tardando casi lo mismo; solo mejora la memoria y los créditos de CPU.
- Hay un **límite** de tamaño y el costo crece mucho más rápido que el beneficio.
- Sigue siendo un **único punto de falla**.

Al cambiar el tamaño, Azure **detiene y reinicia la VM** (incluso puede moverla a otro host físico). La FibonacciApp **se detiene** y, como `forever` no está configurado para arrancar con el sistema, queda caída hasta que se vuelva a ejecutar `forever start FibonacciApp.js`.

Evidencia: cambio de tamaño de **Standard_D2s_v3 → Standard_D4s_v3** (4 vCPU, 16 GiB, ≈ USD 140/mes frente a ≈ USD 70/mes) y, justo después, la app deja de responder (`ERR_CONNECTION_REFUSED`) porque la VM se reinició:

![Resize a D4s_v3](evidencias/part1/p1-12a-resize-d4sv3.png)
![VM con el nuevo tamaño](evidencias/part1/p1-12b-vm-d4sv3.png)
![App caída tras el resize](evidencias/part1/p1-12c-app-cae-tras-resize.png)

Hubo que entrar de nuevo por SSH y ejecutar `forever start FibonacciApp.js`; `nproc` confirma los 4 núcleos:

![App levantada de nuevo en D4s_v3](evidencias/part1/p1-12d-forever-d4sv3.png)

**9. ¿Qué pasa con la infraestructura al cambiar el tamaño? Efectos negativos**

- La VM se reinicia → **tiempo de inactividad** (indisponibilidad del servicio).
- Se pierde el contenido del disco temporal y el estado en memoria.
- Si la IP pública es dinámica puede cambiar.
- El nuevo tamaño puede no estar disponible en el clúster/zona actual.
- Aumenta el costo fijo aunque la carga baje (no es elástico) y el escalamiento es manual.

**10. ¿Hubo mejora en el consumo de CPU o en los tiempos de respuesta?**

CPU con D4s_v3 (en la misma gráfica se ven, a la izquierda, los picos de ~46–49 % de las pruebas con D2s_v3):

![CPU D4s_v3](evidencias/part1/p1-14-cpu-d4sv3.png)

newman (2 en paralelo) con D4s_v3:

![Newman D4s_v3 ejecución 1](evidencias/part1/p1-15-newman-d4sv3-1a.png)
![Newman D4s_v3 ejecución 1 – fallos](evidencias/part1/p1-15-newman-d4sv3-1b.png)
![Newman D4s_v3 ejecución 2](evidencias/part1/p1-15-newman-d4sv3-2a.png)
![Newman D4s_v3 ejecución 2 – fallos](evidencias/part1/p1-15-newman-d4sv3-2b.png)

| Ejecución | Peticiones | Exitosas | Fallidas | Prom. (s) | Mín. (s) | Máx. (s) | Duración total (s) |
|---|---|---|---|---|---|---|---|
| newman-1 | 10 | 6 | 4 | 12.31 | 10.40 | 20.84 | 115.5 |
| newman-2 | 10 | 5 | 5 | 12.65 | 10.48 | 20.80 | 115.3 |
| **Total** | **20** | **11 (55 %)** | **9 (45 %)** | **12.46** | | | |

Comparación:

| Métrica | D2s_v3 | D4s_v3 | Cambio |
|---|---|---|---|
| Tiempo promedio secuencial (10 valores) | 12.01 s | 11.62 s | −3.2 % |
| CPU máxima (*Percentage CPU*, Max) | 46.19 % | 22.44 % | −51 % |
| newman: peticiones exitosas | 11 / 20 | 11 / 20 | igual |
| newman: tiempo promedio de las exitosas | 12.94 s | 12.46 s | −3.7 % |
| newman: duración de cada ejecución | ~120 s | ~115 s | −4 % |
| Costo | ≈ USD 70/mes | ≈ USD 140/mes | +100 % |

**No hubo una mejora real.**
- El **porcentaje de CPU bajó a la mitad**, pero solo en apariencia: sigue habiendo **un núcleo al 100 %** (el del hilo de Node) y ahora el promedio se divide entre 4 núcleos en vez de 2 (≈ 25 %). Los otros 3 núcleos quedan sin usar.
- Los **tiempos de respuesta mejoraron solo un ~3–4 %** (variación normal entre ejecuciones o un procesador ligeramente distinto tras el reinicio), porque cada cálculo sigue corriendo en un solo hilo y a la misma velocidad de reloj.
- La **tasa de éxito con newman no cambió** (55 %) y los `ECONNRESET` siguen apareciendo con el mismo patrón alternado: el cuello de botella es el *event loop* bloqueado, no la cantidad de núcleos o de memoria.
- A cambio, el **costo se duplicó**.

**11. Cuatro ejecuciones paralelas de newman. ¿El comportamiento es porcentualmente mejor?**

Cuatro ejecuciones de newman en paralelo contra la VM D4s_v3 (pantallazo de una de ellas):

![Newman 4 en paralelo](evidencias/part1/p1-16-newman-d4sv3-4paralelo-a.png)
![Newman 4 en paralelo – fallos](evidencias/part1/p1-16-newman-d4sv3-4paralelo-b.png)

| Ejecución | Peticiones | Exitosas | Fallidas | Prom. (s) | Mín. (s) | Máx. (s) | Duración total (s) |
|---|---|---|---|---|---|---|---|
| newman-1 | 10 | 5 | 5 | 27.59 | 20.41 | 29.61 | 186.5 |
| newman-2 | 10 | 5 | 5 | 29.59 | 29.42 | 30.13 | 196.2 |
| newman-3 | 10 | 5 | 5 | 31.56 | 29.43 | 39.78 | 206.1 |
| newman-4 | 10 | 6 | 4 | 27.89 | 9.87 | 49.49 | 206.3 |
| **Total** | **40** | **21 (52.5 %)** | **19 (47.5 %)** | **29.10** | | | |

La primera petición de cada ejecución tardó **20.4 s, 30.1 s, 39.8 s y 49.5 s**: llegaron las 4 a la vez y Node las resolvió **una detrás de otra**, ~10 s cada una.

![CPU 4 en paralelo](evidencias/part1/p1-16-cpu-d4sv3-4paralelo.png)

La CPU máxima fue **23.36 %**, igual que con 2 ejecuciones: sigue habiendo un solo núcleo ocupado de los 4.

| Métrica (D4s_v3) | 2 en paralelo | 4 en paralelo |
|---|---|---|
| Peticiones enviadas | 20 | 40 |
| Exitosas | 11 (55 %) | 21 (52.5 %) |
| Tiempo promedio de las exitosas | 12.46 s | **29.10 s** (×2.3) |
| Duración de la prueba | ~115 s | ~206 s |
| Peticiones exitosas por minuto | ≈ 5.7 | ≈ 6.1 |
| CPU máxima | 22.44 % | 23.36 % |

**No, el comportamiento no es porcentualmente mejor.** Al duplicar la concurrencia el porcentaje de éxito se mantiene o baja un poco (55 % → 52.5 %), los tiempos de respuesta se multiplican por ~2.3 y el *throughput* real queda igual (~6 respuestas por minuto, es decir, una cada ~10 s). La VM tiene 4 núcleos pero la app solo usa uno, así que su capacidad no depende del tamaño de la máquina: cada petición extra simplemente espera en la cola del único hilo. Escalar verticalmente no aumenta la capacidad de procesamiento concurrente de esta aplicación.

### Evaluación del escenario de calidad (paso 12)

> *Cuando un conjunto de usuarios consulta un enésimo número (superior a 1 000 000) de la secuencia de Fibonacci de forma concurrente (…), todas las peticiones deben ser respondidas y el consumo de CPU del sistema no puede superar el 70 %.*

| Condición | D2s_v3 | D4s_v3 | ¿Cumple? |
|---|---|---|---|
| Todas las peticiones concurrentes respondidas | 55 % (11/20) | 55 % (11/20); 52.5 % con 4 en paralelo | **No** |
| CPU ≤ 70 % | 46–49 % | 22–23 % | Sí (en apariencia) |

**El escenario no se cumple con escalamiento vertical.** Aunque el porcentaje de CPU de la VM queda por debajo del 70 %, casi la mitad de las peticiones concurrentes falla (`ECONNRESET`) y las que responden tardan entre 10 s y 50 s. Además, el bajo porcentaje de CPU es engañoso: el núcleo que usa la aplicación está al 100 %, y los demás no aportan nada. Aumentar el tamaño de la VM duplicó el costo sin mejorar la tasa de éxito ni los tiempos, porque el cuello de botella es el único hilo de Node.js en un único nodo. Para cumplirlo se necesita repartir las peticiones entre varios procesos o máquinas (escalamiento horizontal, Parte 2) y/o mejorar el algoritmo.

### Regreso al tamaño inicial (paso 13)

La VM se devolvió a **Standard_D2s_v3** para reducir el costo:

![VM devuelta a D2s_v3](evidencias/part1/p1-17-resize-back-d2sv3.png)

---

## Parte 2 – Escalabilidad horizontal

### Infraestructura

![VNet](evidencias/part2/p2-01-vnet.png)
![Load balancer](evidencias/part2/p2-02-lb.png)
![Backend pool](evidencias/part2/p2-03-backend-pool.png)
![Health probe](evidencias/part2/p2-04-health-probe.png)
![Load balancing rule](evidencias/part2/p2-05-lb-rule.png)
![VM1 básico](evidencias/part2/p2-06-vm1-basics.png)
![VM1 networking](evidencias/part2/p2-07-vm1-networking.png)
![NSG](evidencias/part2/p2-08-nsg.png)
![VM en balanceador](evidencias/part2/p2-09-vm-lb.png)
![VMs creadas](evidencias/part2/p2-10-vms-creadas.png)
![App VM1](evidencias/part2/p2-11-app-vm1.png)
![App VM2](evidencias/part2/p2-11-app-vm2.png)
![App VM3](evidencias/part2/p2-11-app-vm3.png)
![Backend pool saludable](evidencias/part2/p2-12-backend-pool-saludable.png)
![LB raíz](evidencias/part2/p2-13-lb-hello.png)
![LB fibonacci/1](evidencias/part2/p2-14-lb-fibonacci1.png)

### Preguntas

**¿Cuáles son los tipos de balanceadores de carga en Azure y en qué se diferencian?**

| Servicio | Capa | Alcance | Uso típico |
|---|---|---|---|
| **Azure Load Balancer** | 4 (TCP/UDP) | Regional | Repartir conexiones entre VMs; puede ser **público** (frontend con IP pública) o **interno** (IP privada dentro de la VNet). |
| **Application Gateway** | 7 (HTTP/HTTPS) | Regional | Enrutamiento por URL/host, terminación TLS, afinidad por cookie, WAF. |
| **Azure Front Door** | 7 (HTTP/HTTPS) | Global | Entrada global con CDN, WAF y enrutamiento al backend más cercano/saludable. |
| **Traffic Manager** | DNS | Global | Reparte tráfico entre regiones resolviendo DNS (prioridad, peso, geografía, rendimiento). |
| **Gateway Load Balancer** | 3/4 | Regional | Insertar appliances virtuales de red (firewalls) de forma transparente. |

**¿Qué es SKU, qué tipos hay y en qué se diferencian?**

El SKU (*Stock Keeping Unit*) es el nivel/edición del recurso, que define sus capacidades, SLA y precio. Para el Load Balancer:

| | Basic | Standard | Gateway |
|---|---|---|---|
| Estado | Retirado (30 sep 2025) | Recomendado | Para appliances |
| Tamaño backend pool | hasta 300 instancias | hasta 1 000 instancias | – |
| Zonas de disponibilidad | No | Sí (zonal / zone-redundant) | – |
| Seguridad | Abierto por defecto | **Cerrado por defecto**: requiere NSG que permita el tráfico | – |
| Health probes | TCP, HTTP | TCP, HTTP, HTTPS | – |
| SLA | Sin SLA | 99.99 % | 99.99 % |
| Costo | Gratis | Por reglas y datos procesados | Por uso |

Las IP públicas también tienen SKU Basic/Standard; un LB Standard requiere IP pública Standard.

**¿Por qué el balanceador de carga necesita una IP pública?**

Porque es un balanceador **público** (de cara a Internet): su *frontend* es el único punto de entrada al sistema. Los clientes se conectan a esa IP y el balanceador reenvía cada conexión a una VM del *backend pool*. Así los clientes no necesitan conocer las IP de cada VM y se pueden agregar/quitar nodos sin cambiar la dirección pública.

**¿Cuál es el propósito del *Backend Pool*?**

Es el conjunto de instancias (NIC/IP de las VMs o de un VM Scale Set) que recibirán el tráfico. El balanceador solo reparte hacia los miembros del pool; escalar horizontalmente consiste en agregar más VMs a este pool.

**¿Cuál es el propósito del *Health Probe*?**

Verificar periódicamente que cada instancia del pool pueda atender tráfico (en el lab: conexión TCP al puerto 3000 cada 5 s; tras 2 fallos consecutivos la instancia se marca como no saludable). Las instancias no saludables se sacan de la rotación hasta que vuelvan a responder, lo que da **tolerancia a fallos**.

**¿Cuál es el propósito de la *Load Balancing Rule*? ¿Qué tipos de sesión persistente existen, por qué es importante y cómo afecta la escalabilidad?**

La regla une todo: define qué tráfico del *frontend* (IP + protocolo + puerto, aquí TCP 80) se envía a qué *backend pool* y a qué puerto (3000), qué *health probe* se usa, el *idle timeout* y el modo de distribución.

Tipos de persistencia de sesión (*session persistence*):
- **None (5-tuple hash):** IP origen, puerto origen, IP destino, puerto destino y protocolo. Cada conexión nueva puede ir a una VM distinta. Mejor reparto.
- **Client IP (2-tuple):** IP origen + IP destino. Todas las conexiones de un mismo cliente van a la misma VM.
- **Client IP and protocol (3-tuple):** IP origen + IP destino + protocolo.

Es importante cuando la aplicación guarda **estado en memoria** (sesiones, carritos): si una petición cae en otra VM, el estado se pierde. Pero afecta la escalabilidad: el reparto se vuelve desigual (muchos clientes detrás de un mismo NAT terminan en una sola VM), las VMs nuevas no reciben tráfico de clientes existentes y si una VM cae se pierden sus sesiones. Lo ideal es que la aplicación sea **stateless** (como FibonacciApp) y usar `None`.

**¿Qué es una *Virtual Network*? ¿Qué es una *Subnet*? ¿Para qué sirven el *address space* y el *address range*?**

- **Virtual Network (VNet):** red privada y aislada en Azure, donde los recursos se comunican entre sí con IP privadas; se puede conectar a otras VNets o a redes on-premise.
- **Subnet:** segmento de la VNet que agrupa recursos y al cual se le pueden aplicar NSG o tablas de rutas propias.
- **Address space:** rango CIDR total de la VNet. `10.1.0.0/16` → 10.1.0.0 – 10.1.255.255 (65 536 direcciones).
- **Address range:** rango CIDR de cada subnet, contenido dentro del address space y sin solaparse con otras subnets. `10.1.0.0/24` → 10.1.0.0 – 10.1.0.255 (256 direcciones, de las cuales Azure reserva 5).

**¿Qué son las *Availability Zones* y por qué seleccionamos 3 zonas diferentes? ¿Qué significa que una IP sea *zone-redundant*?**

Una zona de disponibilidad es uno o más datacenters **físicamente separados** dentro de una misma región, con energía, refrigeración y red independientes. Al poner VM1, VM2 y VM3 en las zonas 1, 2 y 3, la falla de un datacenter completo solo tumba una VM y el balanceador sigue enviando tráfico a las otras dos (SLA de VMs del 99.99 %).

Una IP **zone-redundant** se sirve simultáneamente desde todas las zonas de la región, de modo que sigue funcionando aunque una zona falle (una IP *zonal* depende de una única zona).

**¿Cuál es el propósito del *Network Security Group*?**

Es un firewall distribuido con reglas *stateful* de permitir/denegar según origen, destino, puerto y protocolo, evaluadas por prioridad. Se asocia a NICs o subnets. En el laboratorio permite SSH (22) para administrar y el puerto 3000 para que el balanceador entregue tráfico a la app; todo lo demás se bloquea. Con un LB Standard es obligatorio, ya que este es “cerrado por defecto”. El tráfico del *health probe* (etiqueta `AzureLoadBalancer`) se permite con una regla por defecto.

### Informe de newman 1 (punto 2): vertical vs. horizontal

![Newman LB 1](evidencias/part2/p2-15-newman-lb-2paralelo-1.png)
![Newman LB 2](evidencias/part2/p2-15-newman-lb-2paralelo-2.png)

TODO: pegar la tabla de `node scripts/resumen-newman.js evidencias/part2/newman/lb-3vms`.

| Métrica (2 newman en paralelo, 10 iteraciones c/u) | 1 VM B1ls | 1 VM B2ms | LB + 3 VMs B1ls |
|---|---|---|---|
| Peticiones totales | 20 | 20 | 20 |
| Peticiones exitosas | TODO | TODO | TODO |
| Tasa de éxito | TODO | TODO | TODO |
| Tiempo promedio (s) | TODO | TODO | TODO |
| Tiempo máximo (s) | TODO | TODO | TODO |
| Duración total de la prueba (s) | TODO | TODO | TODO |
| Costo aprox. mensual (US$) | TODO (~4) | TODO (~60) | TODO (3×~4 + LB ~18 + 4 IPs ~15) |

TODO: verificar los costos en la calculadora de Azure (región, Linux, pago por uso) y adjuntar `p2-19-costos.png`.

![Costos](evidencias/part2/p2-19-costos.png)

Análisis: TODO. Comparación esperada: con el balanceador cada newman queda atendido por una VM distinta, así que las peticiones ya no compiten por el mismo hilo/CPU; el tiempo de respuesta se acerca al de una petición aislada y la tasa de éxito aumenta. Además, la solución horizontal es tolerante a fallos (3 zonas) y crece agregando nodos baratos; su costo es comparable o menor que el de una sola B2ms.

> Nota: el LB usa *hash* de 5-tupla por conexión. Newman reutiliza la conexión TCP (*keep-alive*) durante una ejecución, por lo que normalmente todas las peticiones de una ejecución caen en la misma VM y cada ejecución paralela en una VM diferente. El script de resumen muestra cuántas peticiones atendió cada VM (encabezado `X-Served-By`).

### Punto 3: 4 VMs y 4 ejecuciones paralelas

![VM4](evidencias/part2/p2-16-vm4.png)
![Newman 4 paralelo](evidencias/part2/p2-17-newman-lb-4paralelo.png)
![CPU 4 VMs](evidencias/part2/p2-18-cpu-4vms.png)

TODO: pegar la tabla de `node scripts/resumen-newman.js evidencias/part2/newman/lb-4vms`.

| VM | Zona | CPU máx. (%) | Peticiones atendidas |
|---|---|---|---|
| VM1 | 1 | TODO | TODO |
| VM2 | 2 | TODO | TODO |
| VM3 | 3 | TODO | TODO |
| VM4 | TODO | TODO | TODO |

¿Por qué aumentó la tasa de éxito? TODO: con sus datos. Explicación: la carga se **reparte** entre 4 nodos independientes; cada VM procesa aproximadamente una ejecución de newman a la vez, por lo que no se forman colas en un único hilo, la memoria de cada VM no se agota y la CPU de cada una vuelve a estar libre entre peticiones. La capacidad total crece de forma casi lineal con el número de nodos, cosa que no ocurre al agrandar una sola VM.

### Diagrama de despliegue

```mermaid
flowchart LR
    C["Cliente<br/>(navegador / newman)"] -->|"HTTP :80"| PIP

    subgraph AZ["Azure – Resource group SCALABILITY_LAB (región)"]
        PIP["SCALABILITY_LAB_LOAD_BALANCER_IP<br/>IP pública Standard, zone-redundant"]
        subgraph LB["SCALABILITY_LAB_LOAD_BALANCER (Standard, público)"]
            R["Load balancing rule<br/>TCP 80 → 3000"]
            HP["Health probe<br/>TCP 3000 c/5 s"]
            BP["Backend pool<br/>SCALABILITY_LAB_BACKEND_POOL"]
        end
        PIP --> R --> BP
        HP -.-> BP

        subgraph VNET["SCALABILITY_LAB_VIRTUAL_NETWORK 10.1.0.0/16"]
            subgraph SUB["SCALABILITY_LAB_SUBNET 10.1.0.0/24 · NSG LOAD_BALANCER_NSG (22, 3000)"]
                subgraph Z1["Zona 1"]
                    VM1["VM1 · Ubuntu B1ls<br/>Node.js + forever<br/>FibonacciApp :3000"]
                end
                subgraph Z2["Zona 2"]
                    VM2["VM2 · Ubuntu B1ls<br/>Node.js + forever<br/>FibonacciApp :3000"]
                end
                subgraph Z3["Zona 3"]
                    VM3["VM3 · Ubuntu B1ls<br/>Node.js + forever<br/>FibonacciApp :3000"]
                end
                VM4["VM4 · Ubuntu B1ls<br/>FibonacciApp :3000"]
            end
        end
        BP --> VM1 & VM2 & VM3 & VM4
    end
```

### Conclusiones

TODO: 3–5 conclusiones propias, por ejemplo:
- El escalamiento vertical tiene un techo, requiere reinicio (downtime) y no aprovecha más núcleos en una app Node de un solo hilo.
- El escalamiento horizontal con balanceador reparte la carga, aumenta la tasa de éxito y da alta disponibilidad entre zonas.
- La causa raíz del consumo de CPU es el algoritmo; optimizarlo (memoización, *fast doubling*) mejoraría ambas arquitecturas.
