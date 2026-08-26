Para sincronizar cambios entre dos repositorios que no son un *fork* directo, especialmente cuando has movido carpetas de sitio (como el `backend`) y has modificado propiedades, tienes varias opciones dependiendo de si quieres mantener el historial de *commits*, si quieres sincronizar solo cambios específicos, o si solo te importa el estado final de los archivos.

Aquí tienes las mejores opciones, ordenadas de más recomendada a menos según tu escenario:

### 1. Generar y aplicar parches (`git format-patch` y `git apply`)
Esta es probablemente la opción más flexible si las rutas de los archivos han cambiado entre el origen (`pingo`) y el destino (`estoyqueloleo`). Puedes extraer los cambios de la rama `us/video_busqueda` como un archivo de texto y aplicarlos en el otro repositorio, ajustando las rutas si es necesario.

**En el repo origen (`pingo`):**
Puedes generar un parche con los últimos cambios de tu rama:
```bash
# Crea un archivo .patch con la diferencia entre la rama principal y tu rama actual
git diff main..us/video_busqueda > mis_cambios.patch
```

**En el repo destino (`estoyqueloleo/p2pt` o `backend`):**
Puedes revisar qué haría el parche antes de aplicarlo, e incluso indicarle a Git si el nivel de los directorios ha cambiado usando `-p` o `--directory`.
```bash
# Comprobar si el parche se aplicaría limpiamente
git apply --check /ruta/a/mis_cambios.patch

# Aplicar el parche
git apply /ruta/a/mis_cambios.patch
```
*Ventaja:* Si un archivo estaba en `backend/src/app.js` y ahora está en `src/app.js`, puedes abrir `mis_cambios.patch` con un editor de texto y hacer un "Buscar y Reemplazar" rápido de las rutas antes de aplicarlo.

### 2. Añadir el origen como "Remoto Local" y hacer `git cherry-pick`
Aunque no sean un *fork* en GitHub/Gitea, localmente en tu ordenador Git te permite conectar dos repositorios. Esto es útil si quieres traerte un *commit* exacto con su mensaje, autor y fecha de la rama `us/video_busqueda`.

**En el repo destino (`estoyqueloleo/p2pt`):**
```bash
# 1. Añades tu repo pingo local como si fuera un servidor remoto
git remote add pingo_local ~/workspace/pingo

# 2. Te descargas la información (esto no modifica tus archivos, solo el historial interno)
git fetch pingo_local

# 3. Te traes un commit específico de la rama us/video_busqueda
git cherry-pick <hash-del-commit>
```
*Aviso:* Si las rutas de los archivos han cambiado drásticamente (ej. sacaste la carpeta `backend` a otro lado), Git podría darte conflictos indicando que no encuentra los archivos originales. En ese caso, la Opción 1 es mejor.

### 3. Sincronización a nivel de sistema de archivos (`rsync`)
Si no te importa el historial de Git y solo quieres que ciertos archivos o carpetas del repo destino sean exactamente iguales a los de la rama `us/video_busqueda` en tu repo origen, usa `rsync`.

```bash
# Ejemplo: Sincronizar la carpeta shared de pingo al p2pt, ignorando cosas específicas
rsync -av --exclude 'node_modules' --exclude '.git' ~/workspace/pingo/carpeta_comun/ ~/workspace/estoyqueloleo/p2pt/carpeta_comun/
```
*Ventaja:* Es brutalmente simple. Haces los cambios en `pingo`, corres el `rsync` y luego en `estoyqueloleo` haces un `git add . && git commit -m "Sincronizado desde pingo"`.

### 4. Extraer el código común a un paquete o Git Submodule (Solución a largo plazo)
Si ves que vas a estar portando código de `pingo` a `estoyqueloleo` constantemente, significa que ambos comparten una librería o un núcleo. 
En lugar de copiar y pegar (o parchear) constantemente, podrías:
1. Sacar esa parte de código a un tercer repositorio (ej. `pingo-core`).
2. Incluir `pingo-core` en `pingo` y en `estoyqueloleo/p2pt` como un **Git Submodule** o publicarlo como un paquete privado de npm/Go.

---

**Mi recomendación para tu caso actual:**
Como mencionas que cambiaste algunas propiedades en el destino y sacaste carpetas (`backend`), te recomiendo la **Opción 1 (Parches)**. Haz un `git diff`, revisa el `.patch` para asegurarte de que no estás sobreescribiendo las propiedades específicas que cambiaste en el destino, ajusta las rutas si es necesario en tu editor de texto, y aplícalo con `git apply`.

---

## El "Truco" de Git para la estructura de carpetas diferenciada

Si decides mantener el código como un Fork real pero necesitas manejar el hecho de que `estoyqueloleo` no tiene la carpeta `backend/` (o la tiene en otro sitio), cuando hagas un `git pull upstream main` desde `pingo`, Git intentará volver a crearte la carpeta `backend/`.

Para evitar que te "ensucie" el repositorio destino con carpetas que ya no quieres ahí, tienes **dos trucos principales**:

### Truco 1: Sparse Checkout (Recomendado para un Fork limpio)
Puedes decirle a Git explícitamente en el repositorio destino que **ignore** la existencia de la carpeta `backend/`, incluso si existe en el código remoto.

En el repo de `estoyqueloleo` harías esto una sola vez:
```bash
# Habilitas el modo sparse-checkout
git sparse-checkout init

# Le dices qué carpetas SÍ quieres descargar (Básicamente todo menos el backend)
git sparse-checkout set "/*" "!backend/"
```
De esta forma, cuando hagas `git pull upstream us/video_busqueda`, te traerá todas las actualizaciones del frontend y los cambios de configuración, pero ignorará por completo lo que pase en la carpeta `backend`.

### Truco 2: Dejar que Git resuelva la eliminación (Merge Delete)
Si en `estoyqueloleo` tú ya hiciste un `git rm -r backend` y lo commiteaste, Git es muy inteligente.
Cuando intentes traer los cambios de `pingo`, Git verá:
* *Repo Origen:* Ha modificado `backend/main.go`
* *Repo Destino:* Ha eliminado la carpeta `backend/` entera.

En la mayoría de casos, Git respetará tu decisión de haber eliminado la carpeta y no te la volverá a crear. Simplemente omitirá los cambios que vengan para archivos que tú ya has decidido borrar en tu rama.