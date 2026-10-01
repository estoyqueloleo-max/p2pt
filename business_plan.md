# 📊 Business Plan & Estrategia de Ecosistema: Pingo / P2PT
> **De Localizador Familiar a Sistema Operativo Cartográfico, Malla P2P y Rastreador Universal Soberano**

---

## 1. Resumen Ejecutivo (Executive Summary)

**Pingo (P2PT)** es una plataforma *Local-First* de comunicación en malla, geolocalización inmutable y espacio de trabajo cartográfico distribuido. Resuelve los principales problemas de las soluciones actuales de rastreo y comunicación de campo: dependencia de servidores centrales caros, filtración/monetización de datos privados (Life360, Google, etc.), falta de conectividad en zonas remotas y altos costes recurrentes por tarjetas SIM.

Al combinar **WebRTC P2P**, **Git en el navegador (`isomorphic-git`)**, **IA vectorial on-device (`ONNX Runtime WASM`)**, un **Hardware Appliance autónomo (Alpine + Go en Raspberry Pi)** y la integración de **balizas BLE / redes Find My descentralizadas**, el proyecto cuenta con un coste marginal de infraestructura casi nulo y un foso competitivo (*moat*) sustentado en la soberanía de datos y la resiliencia offline.

---

## 2. Propuesta de Valor Única (UVP)

1. **Coste Marginal Cero:** Sin servidores pesados de procesamiento ni bases de datos gigantes en la nube. Los nodos y navegadores de los usuarios hacen el trabajo de cómputo y almacenamiento.
2. **Privacidad Radical (Privacy by Design):** Criptografía en cliente (`PBKDF2`, pares de claves asimétricas). Nadie (ni siquiera los servidores de señalización o relé TURN) puede leer coordenadas, chats o notas.
3. **Auditoría e Inmutabilidad con Git:** Cada ruta, foto o evento genera un commit verificable e imposible de alterar retroactivamente.
4. **Resiliencia Extrema (Offline & Mesh):** Comunicación y cartografía que funcionan sin Internet; sincronización automática al reencontrarse o mediante appliances tácticos.
5. **Rastreo Universal de Balizas (AirTags / BLE / Find My):** Localización mundial de personas dependientes y activos sin pagar cuotas mensuales de SIM.

---

## 3. Segmentos de Mercado y Casos de Uso (Target Verticals)

### A. B2C / Familias y "Silver Economy" (Cuidado de Dependientes y Mayores)
* **Público:** Familias con hijos pequeños, personas mayores con principios de deterioro cognitivo, o colectivos que rechazan que las grandes tecnológicas moneticen la rutina de sus seres queridos.
* **Solución:** App Pingo para smartphones + pulseras/llaveros BLE ("Pingo Tags" de bajo coste con 1 año de batería) + Appliance doméstico en RPi que avisa de llegadas/salidas del hogar de forma 100% privada.
* **Ventaja competitiva:** Sin cuota obligatoria de SIM, sin venta de datos a anunciantes (la antítesis de Life360).

### B. B2B Industrial: Inspección de Infraestructuras y Trabajo de Campo (*Field Services*)
* **Público:** Empresas de aguas, eléctricas, parques eólicos, gasoductos, constructoras y obras civiles.
* **Solución:** Cuadrillas con la App Pingo registran inspecciones mediante commits inmutables de Git (prueba pericial para aseguradoras/auditorías). Streaming P2P de vídeo en directo para soporte técnico entre operarios sin saturar servidores corporativos. Búsqueda semántica de averías en local con IA.
* **Trazabilidad de herramientas:** Balizas BLE en maquinaria y herramientas caras que son registradas automáticamente por las furgonetas (equipadas con el Appliance) y móviles de los operarios.

### C. Misiones Tácticas, Protección Civil, Rescate (SAR) y Outdoor
* **Público:** Cuerpos de bomberos, equipos de búsqueda y rescate en montaña, expediciones de aventura y ONGs en zonas de conflicto o catástrofe natural.
* **Solución:** Pingo Mesh opera en escenarios *air-gapped* o con torres de telefonía caídas. Un vehículo o puesto de mando despliega un Appliance en Raspberry Pi que centraliza la cartografía del operativo vía WiFi local, mientras los miembros del equipo sincronizan posiciones por saltos P2P.

### D. LegalTech & Seguros: Peritaje Inmutable y Prueba Notarial Digital
* **Público:** Gabinetes periciales, aseguradoras (Allianz, Mapfre), tasadores de siniestros agrícolas/inundaciones, y abogados de lindes rústicas o servidumbres de paso.
* **Solución:** Cada foto, track GPS recorrido a pie y nota técnica se sella en un **commit de Git firmado criptográficamente**. Genera un informe pericial inalterable con sellado temporal que demuestra matemáticamente que la inspección ocurrió en esas coordenadas exactas y no fue alterada a posteriori.
* **Modelo:** Cobro por informe pericial certificado (15–30 € por acta emitida) o licencia corporativa.

### E. Smart Agro & Ganadería Extensiva Soberana (Sin Cuotas de SIM)
* **Público:** Ganaderos de extensivo (vacas, caballos, ovejas en monte abierto) y explotaciones agrícolas extensas.
* **Solución:** Sustituir los collares comerciales con SIM (que cuestan 30–60 €/año por animal) por **balizas BLE / LoRa de 8 €**. Unas pocas Raspberry Pi con placa solar en bebederos/saladeros registran automáticamente el paso del ganado. El quad/todoterreno del pastor con la App Pingo audita qué reses ha visto y alerta de animales extraviados mediante geovallas.
* **Modelo:** Venta de kits de collares + estación base RPi solar. Cero cuotas de telecomunicaciones.

### F. Adventure Convoy: Guiado Off-Grid para Rallies 4x4, Safaris y Travesías
* **Público:** Clubes de 4x4, rallies por el desierto (Marruecos Challenge, etc.), travesías náuticas y guías de montaña.
* **Solución:** El vehículo guía lleva el **Appliance conectado a 12V**, emitiendo una WiFi local de largo alcance. Todos los vehículos se ven en el mapa en tiempo real, intercambian waypoints vía Git y se comunican por audio/vídeo P2P (tipo intercomunicador walkie digital) sin cobertura celular.
* **Modelo:** Venta o alquiler de "Pingo Convoy Boxes" para eventos deportivos y agencias de turismo activo.

### G. Human Rights & Whistleblower OS (Defensa, Periodismo y Alto Riesgo)
* **Público:** Periodistas de investigación, cooperantes en zonas de conflicto y activistas medioambientales (amenazados por minería ilegal o deforestación).
* **Solución:** Identidad criptográfica efímera derivada de una frase secreta (sin cuentas ni registros en servidores centrales). Botón de pánico que borra la base de datos IndexedDB al instante. Búsqueda semántica on-device con IA local para consultar documentación sensible sin enviar peticiones a APIs de OpenAI o Google.
* **Modelo:** Subvenciones internacionales de libertad de prensa (*Open Technology Fund*, *HRF*) y contratos de soporte con ONGs globales.

### H. Logística de Última Milla "Cero Comisiones" (Comercio Local y Cooperativas)
* **Público:** Restaurantes locales, farmacias de guardia, comercios de proximidad y cooperativas de mensajería que quieren evitar el 30% de comisión de plataformas como Glovo o Uber.
* **Solución:** El repartidor comparte un enlace temporal P2P. El cliente abre el link en su navegador y ve la bici/moto acercarse en tiempo real punto a punto vía WebRTC. Firma digital de recepción guardada en Git.
* **Modelo:** Suscripción mensual económica (10–19 €/mes por comercio) sin comisiones por pedido.

### I. Producto Derivado: Content Pipeline as a Service (Vídeos Formativos Automatizados)
* **Público:** Empresas de software SaaS que sufren para mantener actualizados sus videotutoriales y documentación cuando cambia la interfaz gráfica.
* **Solución:** Extraer la suite automatizada ya desarrollada en Pingo (**Playwright + Kokoro TTS + FFmpeg**) como producto independiente: genera videotutoriales Full HD con voz neural y locución sincronizada en CI/CD automáticamente en cada release.
* **Modelo:** Suscripción B2B para desarrolladores y startups de software.

---

## 4. El Factor "AirTags" y Redes de Rastreo (Apple / Android)

### ¿Cómo se integra en Pingo?
Los teléfonos móviles son caros, pesados y requieren recarga diaria. Las balizas BLE (tipo AirTag o chips nRF52/ESP32 de 3-5 €) duran entre 1 y 2 años con una simple pila de botón (CR2032).

```
                      ┌────────────────────────────────────────┐
                      │    RED PLANETARIA EXISTENTE            │
                      │  (Cientos de millones de iPhones       │
                      │   o móviles Android cercanos)          │
                      └──────────────────┬─────────────────────┘
                                         │ Captura anónima BLE
                                         │ + GPS del móvil ajeno
                                         ▼
┌──────────────────┐  BLE Advert     ┌────────────────────────┐
│ Pingo Tag / BLE  │ ──────────────► │ Servidores Apple /     │
│ (Mochila/Abuelo) │                 │ Google (Datos Cifrados)│
└──────────────────┘                 └───────────┬────────────┘
                                                 │
                                                 │ Fetch periódico
                                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  PINGO HUB (Raspberry Pi Appliance)                  │
│                                                                      │
│ 1. Antena BLE Local: Detecta presencia directa en casa / furgoneta.   │
│ 2. Gateway Find My: Descarga los reportes mundiales cifrados.        │
│ 3. Desencriptado Soberano: Usa la clave privada guardada en la RPi.  │
│ 4. Registro Git: Crea un commit local inmutable con fecha y GPS.      │
│ 5. Difusión P2P / Push: Notifica a la familia a través de la App.    │
└──────────────────────────────────────────────────────────────────────┘
```

* **Capa Local Directa (Antena Doméstica):** El Bluetooth de la propia Raspberry Pi detecta cuándo el tag entra o sale del radio del domicilio sin gastar datos ni consultar nubes.
* **Capa Global (OpenHaystack / FindMy.py en la RPi):** La RPi consulta periódicamente la API de Apple, descarga los paquetes cifrados generados por cualquier iPhone del mundo que haya pasado cerca del tag, los desencripta con tu clave privada y los publica como waypoints en tu repositorio Git de Pingo.
* **Resultado:** Rastreo satelital global de coste de comunicación cero y sin intermediarios.

---

## 5. Modelos de Monetización y Vías de Ingresos

```
                       ┌───────────────────────────────┐
                       │      MODELOS DE NEGOCIO       │
                       └──────────────┬────────────────┘
          ┌───────────────────┬───────┴───────────┬───────────────────┐
          ▼                   ▼                   ▼                   ▼
   [VENTA HARDWARE]    [FREEMIUM / SAAS]   [B2B LICENCIAS]     [CONSULTORÍA]
   • Pingo Hub (RPi)   • TURN Relay Pro    • SDK Local-First   • Despliegues
   • Pingo Tags (BLE)  • Push Gateway      • Flotas & Obra       Air-Gapped
```

### 1. Venta de Hardware Plug & Play (D2C / E-commerce)
* **Pingo Home Hub:** Kit listo para usar (Raspberry Pi en caja de diseño o aluminio + tarjeta SD inmutable preinstalada + cable de red y alimentador). Margen bruto estimado: 40-50%.
* **Pingo Pack Familiar:** 1 Hub + 2 o 3 Pingo Tags (llaveros/pulseras BLE resistentes al agua) emparejados criptográficamente mediante un código QR.
* **Pégina de venta orientada a la soberanía:** *"Rastrea a tu familia y tus cosas sin suscripciones, sin SIMs y sin que Google o Apple espíen tus movimientos"*.

### 2. Suscripción Nube Gestionada (Freemium SaaS)
* **Tier Gratis (Self-Hosted / P2P puro):** Todo el software Open Source. El usuario gestiona su propio Appliance o conecta P2P directo en redes locales/STUN.
* **Tier Pingo Cloud Pro (2,99 €/mes o 29 €/año por familia):**
  * Acceso a una red de servidores TURN de alta velocidad y baja latencia (garantiza el 100% de conexiones en redes móviles estrictas 5G/CGNAT).
  * Pasarela Push Notification prioritaria (despertar dispositivos dormidos).
  * Servicio de Gateway Find My en la nube (para quienes no deseen comprar el hardware de la RPi).

### 3. Licenciamiento B2B y Enterprise
* **Pingo Field Workspaces:** Licencia anual por dispositivo para cuadrillas de inspección técnica, empresas de logística de última milla o constructoras (trazabilidad de herramientas y firma de partes de trabajo en Git).
* **SDK P2P Local-First:** Venta de componentes del motor (`isomorphic-git` + streaming WebRTC P2P + búsqueda vectorial ONNX) como librería para que terceros construyan apps de chat confidencial o sincronización de flotas.

### 4. Servicios Profesionales y Despliegues Especializados
* Implantación de redes tácticas para Protección Civil, eventos deportivos masivos o empresas con centros de datos *air-gapped* que requieren aislamiento total de la nube pública.

---

## 6. Estructura de Costes vs. Escalabilidad

| Concepto | Coste en modelo tradicional (ej. Life360/AWS) | Coste en Pingo |
| :--- | :--- | :--- |
| **Almacenamiento de rutas/fotos** | Elevado (Base de datos centralizada, S3, copias) | **0 €** (Se guarda en IndexedDB local y en la RPi del usuario) |
| **Computación de IA (Embeddings)** | Alto (APIs de OpenAI o servidores GPU) | **0 €** (ONNX WebAssembly ejecutado en la CPU del cliente) |
| **Tráfico de Vídeo/Audio** | Elevadísimo (Servidores de streaming / CDN) | **0 €** (Streaming directo WebRTC P2P de navegador a navegador) |
| **Tráfico de Red Móvil** | Cuotas de tarjetas SIM (3–10 €/mes por tag) | **0 €** (Uso de red BLE comunitaria + WiFi doméstica) |
| **Infraestructura Central** | Clústeres de Kubernetes y microservicios | **Mínimo** (Un servidor Go ligero para señalización y STUN/TURN) |

> **Conclusión Financiera:** El modelo de Pingo tiene un **ratio de apalancamiento operativo brutal**. A medida que crece el número de usuarios, los costes de servidor casi no aumentan, dejando un margen neto extraordinariamente alto en las suscripciones y venta de hardware.

---

## 7. Hoja de Ruta de Negocio (Roadmap de Lanzamiento)

### Fase 1: Validación y Comunidad (*Early Adopters*)
- [x] Motor P2P WebRTC, Git local y IA vectorial operativa.
- [x] Receta de Appliance para Raspberry Pi con Alpine y servidor en Go.
- [ ] Documentar y prototipar el conector BLE / Find My en la Raspberry Pi.
- [ ] Presentar el proyecto en comunidades enfocadas en privacidad y self-hosting (`r/selfhosted`, `Hacker News`, `IndieHackers`).

### Fase 2: Producto Físico y Micro-SaaS
- [ ] Diseño de caja 3D e imagen oficial para el "Pingo Hub".
- [ ] Venta inicial de 50-100 unidades del kit Pingo Hub + Pingo Tags en preventa.
- [ ] Despliegue de red de relés TURN gestionada y pasarela de pago para la suscripción Pro.

### Fase 3: Expansión B2B y Ecosistema
- [ ] Modo Senior y Modo Inspección Técnica empaquetados como soluciones verticales.
- [ ] Conectores empresariales para exportación de informes Git/GPX/PDF para auditorías de obra.
- [ ] Apertura del SDK para desarrolladores de terceros.
