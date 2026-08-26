# Guía de Compilación y Publicación - Pingo Android

Este documento detalla los pasos para generar el archivo de producción y cómo manejar la publicación en Google Play Store.

## 0. Generar APK de Desarrollo (Debug)
Para probar la aplicación localmente sin necesidad de firmarla con una llave de producción.

Ejecuta desde la carpeta `android/`:
```bash
./gradlew :app:assembleDebug
```
El archivo se generará en:
`app/build/outputs/apk/debug/app-debug.apk`

---

## 1. Configuración de Firma (Key)
Para generar un paquete que acepte la Play Store, el archivo debe estar firmado.

### Generar la llave (solo la primera vez)
Si no tienes un archivo `.jks`, genéralo con este comando en la carpeta `android/`:
```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

### Configurar credenciales
Edita el archivo `android/key.properties` con los datos de la llave que creaste:
- `storePassword`: Contraseña del keystore.
- `keyPassword`: Contraseña de la clave/alias.
- `keyAlias`: El alias (ej. `my-key-alias`).
- `storeFile`: Nombre del archivo (ej. `my-release-key.jks`).

---

## 2. Generar el Android App Bundle (.aab)
Google Play requiere el formato `.aab` para nuevas aplicaciones.

Ejecuta desde la carpeta `android/`:
```bash
./gradlew :app:bundleRelease
```
El archivo se generará en:
`app/build/outputs/bundle/release/app-release.aab`

---

## 3. Subir al Play Store
Actualmente, **no hay una conexión directa desde este entorno para "subir" automáticamente** el archivo a Google Play sin una configuración previa de la API de Google Play Developer (que requiere un archivo JSON de cuenta de servicio).

### Proceso Manual (Recomendado):
1. Ve a la [Google Play Console](https://play.google.com/console/).
2. Selecciona tu aplicación.
3. Ve a **Producción** (o Testing interno) -> **Crear nueva versión**.
4. Sube el archivo `app-release.aab` que generaste en el paso 2.

### Automatización (Opcional)

Para automatizar la subida y no tener que entrar a la web, tienes dos opciones principales:

#### Opción A: Fastlane (Muy popular)
Es una herramienta escrita en Ruby que automatiza capturas de pantalla, beta testing y despliegue.
1. Instala Fastlane: `gem install fastlane`.
2. Inicializa en tu carpeta android: `fastlane init`.
3. Configura el archivo `Appfile` y `Fastfile`.
4. Necesitarás el archivo JSON de la **Cuenta de Servicio de Google Play**.
5. Comando para subir: `fastlane deploy` (dependiendo de tu configuración).

#### Opción B: Gradle Play Publisher (GPP)
Es un plugin de Gradle que se integra directamente en tu flujo de compilación.
1. Añade el plugin en `build.gradle` (root):
   `id("com.github.triplet.play") version "3.7.0" apply false`
2. Aplícalo en `app/build.gradle`:
   `apply plugin: 'com.github.triplet.play'`
3. Configura el bloque `play { ... }` con el path a tu JSON de credenciales.
4. Comando para subir: `./gradlew publishReleaseBundle`.

#### Requisito Indispensable para ambas:
Para cualquiera de las dos, debes ir a la **Google Play Console** -> **Configuración** -> **Acceso a la API** y crear una "Cuenta de servicio". Google te dará un archivo `.json` que es el que usarán estas herramientas para autenticarse por ti.

---

## Notas de Seguridad
- **NUNCA** subas `my-release-key.jks` ni `key.properties` a un repositorio público.
- Si pierdes el archivo `.jks`, no podrás actualizar la aplicación en la tienda.
