Viewed TODO.md:1-48
Searched for "isomorphic-git"

¡Excelente dirección para evolucionar el proyecto! Al usar **isomorphic-git** en el navegador, tienes mucha flexibilidad pero también algunos retos propios de entornos distribuidos (P2P). 

Aquí tienes diferentes opciones arquitectónicas y de implementación para cada uno de los 4 puntos que mencionas:

---

### 1. Visualización del árbol de commits (Grafo con propietarios)
El objetivo es que los usuarios puedan ver visualmente cómo se bifurca o unifica la información, y quién aportó qué de un vistazo.

*   **Opción A: Uso de librerías especializadas (Ej: `Gitgraph.js`)**
    *   **Cómo:** Extraes el log de tu repositorio usando `git.log()` de isomorphic-git. Parseas el historial reconstruyendo las ramas y los padres (parents) de cada commit.
    *   **Propietarios:** Extraes el campo `author.name` o `author.email` (que puede corresponder al ID de PeerJS del usuario) y usas eso para colorear los nodos del grafo o incluso inyectar un pequeño avatar/iniciales al lado del nodo usando las opciones de renderizado custom de la librería.
*   **Opción B: Renderizado en red con `vis-network` o `D3.js`**
    *   **Cómo:** Si quieres una visualización que no sea estrictamente el "típico árbol vertical de git" sino un mapa mental o un grafo flotante. Cada nodo es un commit, y las aristas son los enlaces *parent-child*.
    *   **Ventaja:** Permite mucha más interacción visual, como agrupar nodos por usuario o arrastrar partes de la historia para explorarlas interactivamente.
*   **Opción C: Timeline vertical simplificado**
    *   **Cómo:** Si la historia es mayormente lineal (porque hacéis merges constantes), crear una UI personalizada estilo "Timeline de Twitter/Chat". Agrupas los commits consecutivos del mismo usuario en un solo bloque visual para no sobrecargar la UI.

### 2. Compartir commits antiguos (Seleccionar y compartir)
En un sistema P2P clásico de Git, se comparten ramas enteras. Compartir un "grupo de commits arbitrario" es más complejo, pero posible.

*   **Opción A: Intercambio directo de objetos (P2P Cherry-picking)**
    *   **Cómo:** El usuario selecciona en la UI los commits que quiere enviar. Tu app usa `git.readObject()` para leer esos commits específicos, junto con sus *trees* y *blobs* (archivos modificados) correspondientes.
    *   **Envío:** Empaquetas estos objetos JSON/binarios y los envías a través de la conexión WebRTC (PeerJS).
    *   **Recepción:** El peer receptor usa `git.writeObject()` para inyectarlos en su base de datos local y, si quiere, los aplica a su rama actual creando un nuevo commit que referencie los cambios.
*   **Opción B: Generación de parches (Patches / Diffs)**
    *   **Cómo:** En lugar de lidiar con objetos crudos de Git, generas un archivo `patch` (el equivalente a las diferencias de texto) entre los commits seleccionados.
    *   **Envío:** Envías ese texto (diff) al otro peer.
    *   **Recepción:** El peer receptor lee el parche y modifica sus archivos locales, decidiendo si quiere hacer un nuevo commit propio con esa información.
*   **Opción C: Ramas efímeras para compartir**
    *   **Cómo:** Cuando alguien quiere compartir 5 commits antiguos, tu app crea una nueva rama oculta que apunte al último de esos commits, hace un *push/fetch* normal de Git a través del canal P2P sobre esa rama específica, y luego el receptor la lee. Es lo más nativo para isomorphic-git.

### 3. Gestión del olvido (Ocultar/eliminar commits)
El "derecho al olvido" choca directamente con la inmutabilidad criptográfica de Git (un hash de commit depende de todos sus predecesores).

*   **Opción A: Soft-Delete o "Bloqueo en la UI" (Recomendada)**
    *   **Cómo:** Los commits se quedan en la base de datos de Git, pero mantienes una lista negra (`Blocklist`) local en IndexedDB con los IDs/Nombres de los usuarios que quieres olvidar.
    *   **Efecto:** Al leer la base de datos (por ejemplo, para pintar los puntos en el mapa o ver la lista de noticias), tu app filtra e ignora automáticamente cualquier dato/commit cuyo autor esté en esa lista.
    *   **Ventaja:** No rompes tu historial de Git. Si reescribes la historia, perderás la sincronización P2P con el resto de la red.
*   **Opción B: Aislamiento por Ramas**
    *   **Cómo:** En lugar de mezclar todos los datos de todos los peers en la rama `main`, mantienes una rama independiente por cada peer (ej: `refs/heads/peer_jose`, `refs/heads/peer_maria`). Para ver el mapa global, tu app lee de todas las ramas simultáneamente.
    *   **Efecto:** Para "olvidar" a alguien, simplemente eliminas su rama. Al no haber hecho *merge* en tu código central, su historia desaparece de tu dispositivo limpiamente.
*   **Opción C: Hard-Delete (Reescribir la historia - Peligroso)**
    *   **Cómo:** Tienes que iterar por la historia, saltarte los commits del usuario, y volver a generar los árboles de todos los commits posteriores (porque sus hashes cambiarán).
    *   **Efecto:** Tu historial será incompatible con el resto de la red. Si te conectas con alguien que no ha borrado a ese usuario, te volverán a llegar sus commits en la siguiente sincronización.

### 4. Tokens / Nodos de conocimiento (Relacionar conceptos)
Este es un acercamiento fascinante, llevar el repositorio hacia un **Personal Knowledge Graph** (PKM) descentralizado.

*   **Opción A: Enlaces bidireccionales tipo Obsidian/Roam (Basado en texto)**
    *   **Cómo:** Cada concepto es un archivo `.md` o `.json`. Dentro del texto se usan convenciones como `[[Concepto A]]` para referenciar a otros.
    *   **Indexación local:** Cuando se hace un commit, un pequeño *worker* en JavaScript lee los archivos nuevos, extrae esos enlaces y construye un índice relacional en IndexedDB.
    *   **Visualización:** Cuando abres un concepto, consultas el índice para mostrar "Qué otros conceptos enlazan a este" (Backlinks), creando redes de conocimiento.
*   **Opción B: Búsqueda Semántica Local (IA en el Navegador)**
    *   **Cómo:** Utilizar una librería como `Transformers.js` (que corre IA 100% offline en el navegador) para convertir el texto de cada archivo/commit en un *Embedding* (un vector numérico).
    *   **Guardado:** Esos vectores se guardan en archivos JSON dentro de Git.
    *   **Relación automática:** Cuando el usuario lee un concepto, el sistema calcula matemáticamente la "distancia" de ese vector con el resto y te sugiere **"Información cercana"** (conceptos que hablan de temas similares aunque no compartan palabras clave).
*   **Opción C: Ontologías mediante Front-Matter**
    *   **Cómo:** En cada documento/nodo que se guarda en Git, se añade una cabecera con metadatos estructurados (ej. YAML Front-matter).
    *   **Estructura:** Etiquetas (tags), categoría, entidades mencionadas, etc. Luego construyes una UI que te permita filtrar toda tu base de conocimientos pivotando sobre estos metadatos.

¿Qué aproximaciones encajan mejor con el estado actual de Pingo y hacia dónde quieres llevarlo? Si quieres, podemos profundizar en la implementación técnica de alguna en concreto.