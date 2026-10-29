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

![VM creada](evidencias/part1/p1-01-vm-config.png)

![Recursos del grupo](evidencias/part1/p1-02-recursos-grupo.png)

![Conexión SSH](evidencias/part1/p1-03-ssh-conexion.png)

![Node instalado](evidencias/part1/p1-04-node-version.png)

![npm install](evidencias/part1/p1-05-npm-install.png)

![App cae al cerrar SSH](evidencias/part1/p1-06-app-cae-sin-forever.png)

![Inbound rule 3000](evidencias/part1/p1-07-inbound-rule-3000.png)

![fibonacci/6](evidencias/part1/p1-08-fibonacci-6.png)

### Preguntas

**1. ¿Cuántos y cuáles recursos crea Azure junto con la VM?**

Además de la máquina virtual, Azure crea en el grupo `SCALABILITY_LAB` (ver `p1-02-recursos-grupo.png`):

| # | Recurso | Ejemplo de nombre |
|---|---|---|
| 1 | Virtual machine | `VERTICAL-SCALABILITY` |
| 2 | Disk (disco del SO) | `VERTICAL-SCALABILITY_OsDisk_1_...` |
| 3 | Network interface (NIC) | `vertical-scalability123` |
| 4 | Public IP address | `VERTICAL-SCALABILITY-ip` |
| 5 | Network security group (NSG) | `VERTICAL-SCALABILITY-nsg` |
| 6 | Virtual network (con su subnet `default`) | `VERTICAL-SCALABILITY-vnet` |
| 7 | SSH key (solo si Azure generó la llave) | `VERTICAL-SCALABILITY_key` |

TODO: ajustar la tabla a lo que muestre su pantallazo (normalmente son 6 recursos + la VM, o 7 si Azure generó la llave SSH).

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

![Tiempos B1ls](evidencias/part1/p1-09-tiempos-b1ls.png)
![Tiempos B2ms](evidencias/part1/p1-13-tiempos-b2ms.png)

| n | B1ls (s) | B2ms (s) |
|---|---|---|
| 1 000 000 | TODO | TODO |
| 1 010 000 | TODO | TODO |
| 1 020 000 | TODO | TODO |
| 1 030 000 | TODO | TODO |
| 1 040 000 | TODO | TODO |
| 1 050 000 | TODO | TODO |
| 1 060 000 | TODO | TODO |
| 1 070 000 | TODO | TODO |
| 1 080 000 | TODO | TODO |
| 1 090 000 | TODO | TODO |
| **Promedio** | TODO | TODO |

La función tarda tanto porque:
- Recorre la secuencia completa (n − 1 iteraciones) en cada petición: **no hay memoización ni caché**, aunque el valor ya se haya calculado antes.
- Usa `big-integer`: F(1 000 000) tiene ≈ **208 988 dígitos**. Cada suma cuesta O(número de dígitos), así que el costo total es aproximadamente **O(n²)** y no O(n).
- Cada iteración crea un nuevo objeto `bigInt` inmutable, lo que genera mucha basura y trabajo para el *garbage collector*.
- Node.js ejecuta JavaScript en **un solo hilo**: mientras se calcula una petición, el *event loop* queda bloqueado y las demás esperan en cola.
- Existen algoritmos O(log n) (multiplicación de matrices / *fast doubling*) que serían mucho más rápidos.

**5. Consumo de CPU e interpretación**

![CPU B1ls](evidencias/part1/p1-10-cpu-b1ls.png)

TODO: anotar el pico de CPU observado (≈ __ %).

El cálculo es **CPU-bound**: es un ciclo sin I/O que mantiene ocupado el núcleo hasta terminar. La B1ls tiene **1 vCPU**, por lo que mientras haya una petición en curso la CPU se acerca al 100 %. Además, la serie B es *burstable*: la VM acumula créditos cuando está por debajo de su línea base y los gasta al superar esa línea; si se agotan, Azure limita la CPU a la línea base y los tiempos crecen aún más.

**6. Resumen de la ejecución de Postman (newman)**

![Newman B1ls 1](evidencias/part1/p1-11-newman-b1ls-1.png)
![Newman B1ls 2](evidencias/part1/p1-11-newman-b1ls-2.png)

TODO: pegar la tabla que imprime `node scripts/resumen-newman.js evidencias/part1/newman/b1ls`.

- **Tiempos de ejecución:** TODO (promedio, mínimo, máximo). Con 2 ejecuciones paralelas cada petición tarda aproximadamente el doble que en la prueba secuencial, porque Node atiende una petición a la vez y la otra queda en cola.
- **Fallos:** TODO. Si aparecen errores `ECONNRESET`, `ETIMEDOUT` o `socket hang up`, se deben a que la VM (1 vCPU, 0.5 GiB de RAM) se satura: la cola de peticiones crece, el proceso puede quedarse sin memoria (cada respuesta ocupa ~200 KB y los `bigInt` intermedios mucho más) y el sistema operativo o `forever` reinicia el proceso, cortando las conexiones abiertas.

**7. Diferencia entre B2ms y B1ls**

| | B1ls | B2ms |
|---|---|---|
| vCPU | 1 | 2 |
| RAM | 0.5 GiB | 8 GiB |
| Rendimiento base de CPU (burstable) | ~5 % | ~60 % |
| Créditos acumulables | pocos | muchos más |
| Discos de datos / IOPS / red | límites muy bajos | límites mayores |
| Costo aprox. (Linux, pago por uso) | ~US$ 4 / mes | ~US$ 60 / mes |

Más allá del hardware: la B1ls está pensada para cargas casi inactivas (pruebas, servidores pequeños) y solo puede usar ráfagas cortas de CPU; la B2ms soporta cargas sostenidas mucho más altas antes de agotar créditos y tiene más memoria para manejar varias peticiones simultáneas, pero cuesta ~15 veces más. TODO: verificar los precios en la [calculadora de Azure](https://azure.microsoft.com/es-es/pricing/calculator/) para la región usada.

**8. ¿Aumentar el tamaño de la VM es una buena solución? ¿Qué pasa con la FibonacciApp al cambiar el tamaño?**

No es una buena solución en este escenario:
- Node.js usa un solo hilo para el JavaScript, así que **un solo proceso no aprovecha la segunda vCPU**: cada cálculo sigue tardando casi lo mismo; solo mejora la memoria y los créditos de CPU.
- Hay un **límite** de tamaño y el costo crece mucho más rápido que el beneficio.
- Sigue siendo un **único punto de falla**.

Al cambiar el tamaño, Azure **detiene y reinicia la VM** (incluso puede moverla a otro host físico). La FibonacciApp **se detiene** y, como `forever` no está configurado para arrancar con el sistema, queda caída hasta que se vuelva a ejecutar `forever start FibonacciApp.js`.

**9. ¿Qué pasa con la infraestructura al cambiar el tamaño? Efectos negativos**

- La VM se reinicia → **tiempo de inactividad** (indisponibilidad del servicio).
- Se pierde el contenido del disco temporal y el estado en memoria.
- Si la IP pública es dinámica puede cambiar.
- El nuevo tamaño puede no estar disponible en el clúster/zona actual.
- Aumenta el costo fijo aunque la carga baje (no es elástico) y el escalamiento es manual.

**10. ¿Hubo mejora en el consumo de CPU o en los tiempos de respuesta?**

![CPU B2ms](evidencias/part1/p1-14-cpu-b2ms.png)
![Newman B2ms 1](evidencias/part1/p1-15-newman-b2ms-1.png)
![Newman B2ms 2](evidencias/part1/p1-15-newman-b2ms-2.png)

TODO: Sí/No según sus datos. Interpretación esperada: el **porcentaje de CPU baja** (≈ 50 %) porque el mismo hilo ocupado ahora se promedia sobre 2 vCPU, y desaparece el *throttling* por créditos. Los **tiempos por petición mejoran poco** porque el algoritmo sigue ejecutándose en un solo hilo; la mejora principal es la estabilidad (más RAM → menos fallos).

**11. Cuatro ejecuciones paralelas de newman. ¿El comportamiento es porcentualmente mejor?**

![Newman B2ms 4 paralelo](evidencias/part1/p1-16-newman-b2ms-4paralelo.png)
![CPU B2ms 4 paralelo](evidencias/part1/p1-16-cpu-b2ms-4paralelo.png)

TODO: pegar tabla de `node scripts/resumen-newman.js evidencias/part1/newman/b2ms-4`.

Interpretación esperada: **no**. Al duplicar la concurrencia, las peticiones se encolan en el único hilo de Node, por lo que los tiempos de respuesta aproximadamente se duplican y la tasa de éxito no mejora (o empeora). Escalar verticalmente no aumenta la capacidad de procesamiento concurrente de esta aplicación.

### Evaluación del escenario de calidad (paso 12)

TODO: con sus datos. Conclusión esperada: **no se cumple**. La CPU supera el 70 % durante las pruebas (y con B1ls llega a ~100 %) y/o hay peticiones fallidas o con tiempos muy altos. El escalamiento vertical no resuelve el problema porque la aplicación no aprovecha más núcleos y sigue existiendo un único nodo.

![VM devuelta a B1ls](evidencias/part1/p1-17-resize-back-b1ls.png)

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
