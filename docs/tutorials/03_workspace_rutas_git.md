# 📺 Episodio 03: Workspace Cartográfico y Control de Versiones Git

> **Objetivo:** Aprender a grabar rutas GPS en vivo (REC), crear notas y POIs georreferenciados, entender la base de datos Git local (`isomorphic-git`) y sincronizar con Gitea/GitHub.  
> **Duración estimada:** 06:30 min.

---

## 🎬 Guión Técnico de Grabación

| Tiempo | Pantalla / Acción | Locución (Voz en off) |
| :--- | :--- | :--- |
| **00:00 - 00:45** | Clic en la pestaña **Workspace & Git** (`#nav-editor-btn`). Se muestra el visor de Working Copy, el botón REC y la lista de archivos. | *«Bienvenidos al Workspace Cartográfico de Pingo. A diferencia de las aplicaciones tradicionales que guardan tus tracks en formatos planos o nubes opacas, Pingo incorpora un repositorio Git completo ejecutándose directamente dentro de tu navegador.»* |
| **00:45 - 02:00** | Clic en **Iniciar Grabación (REC)**. El HUD muestra el cronómetro, distancia recorrida y puntos capturados. Simular desplazamiento por el mapa. | *«Al iniciar una excursión o inspección, pulsamos 'Iniciar Grabación'. El panel superior nos muestra el tiempo en marcha, los kilómetros recorridos y los puntos GPS registrados en tiempo real sobre el mapa.»* |
| **02:00 - 03:15** | Clic en **Detener y Guardar**. Asignar nombre `Ruta_Cascadas_2026.geojson`, marcar visibilidad Pública/Privada y confirmar. | *«Al finalizar la ruta, pulsamos 'Detener y Guardar'. Asignamos un nombre descriptivo y elegimos si la ruta será indexable para búsqueda compartida o estrictamente privada. Al confirmar, Pingo crea instantáneamente un Commit Git firmado criptográficamente en el almacenamiento local de tu dispositivo.»* |
| **03:15 - 04:30** | Clic en **Nueva Nota**. Redactar una nota de campo con coordenadas georreferenciadas. Guardar como commit. | *«Además de rutas, podemos redactar notas de campo, bitácoras o puntos de interés (POIs). Cada nota es un documento versionado en Git que podemos editar, fusionar o compartir en cualquier momento.»* |
| **04:30 - 05:30** | Clic en **Ver Grafo de Commits (Git Graph)**. Se despliega el diagrama SVG interactivo con la genealogía de ramas y cambios. | *«Pulsando en 'Ver Grafo de Commits', podemos inspeccionar visualmente todo el historial: cada track, cada nota y cada ruta recibida de otros compañeros queda registrada con su autor original, fecha y hash SHA-1.»* |
| **05:30 - 06:30** | Mostrar los botones de **Subir ⬆️ (Push)** y **Bajar ⬇️ (Pull)** hacia un servidor Gitea/GitHub. Cierre. | *«Si queremos respaldar nuestras rutas en un servidor privado propio como Gitea, basta con configurar la URL de nuestro repositorio y pulsar 'Subir'. En el próximo capítulo descubriremos el chat mesh, la retransmisión de vídeo en directo y la búsqueda semántica con IA local.»* |

---

## 💡 Cues y Elementos Visuales
* **Transición visual**: Zoom al panel de *Git Graph* mostrando las bifurcaciones y commits de rutas importadas.
* **Callout gráfico**: Explicación de la arquitectura `isomorphic-git + IndexedDB` en el navegador sin dependencias de servidor.
