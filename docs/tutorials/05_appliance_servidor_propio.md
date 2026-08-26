# 📺 Episodio 05: Servidor Autónomo Doméstico y Alpine Appliance

> **Objetivo:** Aprender a autoalojar la infraestructura completa de señalización y relé TURN con el binario autónomo en Go o flasheando el Appliance inmutable de Alpine Linux en una Raspberry Pi Zero W ($10).  
> **Duración estimada:** 07:00 min.

---

## 🎬 Guión Técnico de Grabación

| Tiempo | Pantalla / Acción | Locución (Voz en off) |
| :--- | :--- | :--- |
| **00:00 - 00:45** | Gráfico de arquitectura: Móvil A y Móvil B conectándose a través del nodo doméstico con DuckDNS. | *«En este capítulo final de la masterclass aprenderemos a desplegar nuestro propio nodo independiente de Pingo. Tener tu propio servidor te brinda soberanía absoluta y asegura que siempre puedas conectar con tus contactos, incluso en redes móviles con cortafuegos estrictos.»* |
| **00:45 - 02:00** | Terminal ejecutando `./p2pt-server -wizard`. El asistente en consola pregunta DuckDNS, token y puertos. | *«El servidor de Pingo está desarrollado en Go en un único binario ligero sin dependencias. Puedes ejecutarlo en cualquier PC o servidor con el flag '-wizard': el asistente interactivo te guiará para configurar tu subdominio gratuito de DuckDNS y activará automáticamente la apertura de puertos UPnP en tu router.»* |
| **02:00 - 03:30** | Navegador abriendo el **Dashboard Web** en `http://localhost:9000/`. Se muestra el código QR y la tarjeta de diagnóstico UPnP y CGNAT. | *«Al arrancar, el servidor ofrece un panel de control web en el puerto 9000. Desde aquí podemos ver en tiempo real el diagnóstico de nuestra conexión a Internet, si nuestro router soporta UPnP y el código QR interactivo para vincular nuestra app en un solo clic.»* |
| **03:30 - 05:00** | Grabación de la MicroSD con **Raspberry Pi Imager** usando la imagen `p2pt-box-rpi-zero.img.gz`. | *«Para un funcionamiento desatendido las 24 horas del día, hemos creado el Alpine Appliance: una imagen de disco inmutable basada en Alpine Linux diseñada para hardware de bajo coste como la Raspberry Pi Zero W de 10 dólares.»* |
| **05:00 - 06:15** | Tarjeta SD montada en el PC: abrir la partición FAT32 y crear el archivo `wifi.txt` con `SSID=...` y `PASS=...`. Meter en la Pi Zero y encender. | *«Configurar la WiFi es tan fácil como crear un archivo de texto llamado 'wifi.txt' en la partición FAT32 de la tarjeta SD. Al encender la Raspberry Pi, el sistema arranca en memoria RAM en pocos segundos, se conecta a tu WiFi y deja el servidor P2P listo y funcionando, resistente a cualquier corte brusco de corriente.»* |
| **06:15 - 07:00** | En la App móvil Pingo: abrir *Ajustes &rarr; Servidores Personalizados* e importar el QR o JSON del nodo propio. Conexión completada. Cierre de masterclass. | *«En la app Pingo, escaneamos el código QR de nuestro nuevo nodo y listo: ya tenemos nuestra propia red privada de geolocalización, mensajería y streaming 100% autónoma y descentralizada. ¡Gracias por acompañarnos en esta masterclass de Pingo!»* |

---

## 💡 Cues y Elementos Visuales
* **B-roll / Animación**: Visual de la Raspberry Pi Zero W encendiéndose y conectándose a la WiFi doméstica.
* **Callout gráfico**: Explicación de la resistencia a fallos del sistema *Alpine Diskless* (tmpfs en RAM) frente a apagones de luz.
