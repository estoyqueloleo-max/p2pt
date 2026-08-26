# 📺 Episodio 01: Identidad Criptográfica y Agenda Privada

> **Objetivo:** Enseñar a crear una identidad sin servidores, comprender la derivación determinista de IDs (PBKDF2) y gestionar contactos en la agenda privada.  
> **Duración estimada:** 04:30 min.

---

## 🎬 Guión Técnico de Grabación

| Tiempo | Pantalla / Acción | Locución (Voz en off) |
| :--- | :--- | :--- |
| **00:00 - 00:30** | Portada animada con el logo de Pingo. Navegador abriendo la App en modo oscuro. | *«Bienvenidos a Pingo, la plataforma de geolocalización y colaboración local-first donde tus datos nunca pasan por servidores comerciales ni bases de datos en la nube. Hoy aprenderemos a configurar nuestra identidad privada y crear nuestra agenda de contactos.»* |
| **00:30 - 01:15** | Clic en la pestaña **Red e Identidad** (`#nav-network-btn`). Se despliega el formulario de identidad. | *«En Pingo no existen correos electrónicos ni contraseñas almacenadas en la nube. Para identificarte, solo necesitas un Alias, una Frase Secreta y una Sal de seguridad opcional.»* |
| **01:15 - 02:00** | Escribir Alias `Explorador_Norte`, Frase `mi-secreto-2026` y Sal `pingo`. Clic en **Fijar Identidad**. Aparece el ID de 8 dígitos `83920194`. | *«Al pulsar 'Fijar Identidad', el navegador utiliza el algoritmo criptográfico PBKDF2 para calcular un identificador único de 8 dígitos. Este ID es determinista: si cambias de teléfono o borras el navegador, basta con volver a escribir tu misma frase para recuperar exactamente tu identidad y tus canales de comunicación.»* |
| **02:00 - 03:00** | Abrir **Añadir a la Agenda**. Introducir los datos de un contacto o su ID directo. Guardar. El contacto aparece en la lista con punto de estado. | *«Añadir a un amigo es igual de sencillo: puedes ingresar su frase secreta si la conoces de mutuo acuerdo, o simplemente pegar su ID de 8 cifras. Tu agenda queda almacenada de forma local y cifrada en tu propio dispositivo.»* |
| **03:00 - 03:45** | Clic en **Compartir mi ubicación** / **Invitar**. Se muestra el enlace con deep-linking y código QR. | *«Para conectar al instante, pulsa 'Compartir mi ubicación'. Puedes enviar un enlace por WhatsApp o Telegram: cuando tu contacto lo pulse, Pingo se abrirá y enlazará automáticamente el túnel P2P entre ambos.»* |
| **03:45 - 04:30** | Clic en **Exportar Backup**. Se descarga el archivo `.json`. Cierre de capítulo. | *«Por último, recuerda exportar periódicamente tu copia de seguridad local en formato JSON. En el próximo capítulo veremos cómo monitorizar el mapa en vivo, configurar geovallas de seguridad y activar el modo persistente.»* |

---

## 💡 Cues y Elementos Visuales
* **Destacar con zoom**: El indicador de ID generado tras pulsar *Fijar Identidad*.
* **Overlay gráfico**: Diagrama explicando cómo `PBKDF2(Frase + Sal) -> ID de 8 cifras` sin conexión a Internet.
