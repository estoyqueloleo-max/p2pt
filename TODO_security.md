# 🛡️ Pingo Security Roadmap

Este documento detalla la evolución planificada para la arquitectura de seguridad y autenticación P2P de Pingo. Actualmente Pingo funciona con un modelo de confianza basado en un secreto simétrico ("Salt"), y el objetivo a futuro es migrar a un modelo de Confianza Criptográfica de Confianza Cero (Zero Trust).

## 1. Estado Actual: El Problema del "Salt Global"
Actualmente, la autenticación entre pares se realiza mediante un `salt` configurado en "Mi Identidad".
* **Vulnerabilidad (El problema del "Pasapalo"):** El `salt` funciona como una contraseña maestra. Si el Usuario A (propietario) le da su `salt` al Usuario B para que se conecte, el Usuario B podría darle ese mismo `salt` a un Usuario C. El sistema aceptará al Usuario C, porque la llave (el `salt`) encaja, perdiendo el control de quién se conecta realmente.

## 2. Evolución Arquitectónica: Criptografía Asimétrica
Para evitar que las credenciales de acceso sean transferibles, se debe abandonar el concepto de contraseña compartida y adoptar **Claves Públicas y Privadas** (Criptografía Asimétrica), similar a Signal o WhatsApp.

### Implementación Propuesta
1. **Generación de Llaves:** Al inicializar la app, usar `window.crypto.subtle` para generar un par de claves (RSA o ECDSA).
2. **Clave Privada In-copiable:** La clave privada se generará con la bandera `extractable: false`. Esto asegura que la clave se quede anclada al navegador/dispositivo actual. **Soluciona el problema de la suplantación:** un usuario no puede (fácilmente) exportar su clave privada para dársela a otro. Funciona como un DNI físico intransferible.
3. **Intercambio de Claves Públicas:** Cuando dos usuarios quieren conectar, se intercambian sus Claves Públicas (por ejemplo, mediante un código QR o un "Enlace de Invitación").
4. **Desafío Criptográfico (Handshake):**
   * Cuando Alice se conecta a Bob, Bob genera un texto aleatorio (Challenge).
   * Alice debe "firmar" ese texto usando su Clave Privada oculta en su navegador.
   * Bob verifica la firma usando la Clave Pública de Alice que tiene guardada en su agenda.
   * Si la firma es válida, la conexión se establece.

### Ventajas de este modelo
* **Intransferibilidad:** Aunque Alice le pase el "ID de conexión" a un tercero, este tercero no tiene la Clave Privada de Alice, por lo que fallará el desafío criptográfico.
* **Revocación Granular:** Si Bob quiere bloquear a Alice, simplemente borra la Clave Pública de Alice de su agenda. Alice pierde instantáneamente el acceso, sin afectar al resto de contactos de Bob.

## 3. Capa Adicional (Opcional): Sala de Espera (Knocking)
Independientemente de la criptografía, añadir una capa de **Aprobación Manual**.
* Si un PeerID no está en la agenda o intenta conectar por primera vez, retener la apertura de los canales de datos (Git, Ubicación, Chat).
* Mostrar en la interfaz: *"Dispositivo desconocido intentando conectar. ¿Permitir / Bloquear?"*
* Permite abortar conexiones no deseadas incluso si el atacante logró superar la capa de descubrimiento de PeerJS.
