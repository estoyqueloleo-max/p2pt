# 📺 Episodio 02: Mapa en Tiempo Real, Geovallas y Persistencia

> **Objetivo:** Dominar el visor cartográfico, la precisión GPS adaptativa, la creación de zonas seguras (geofencing local y remoto) y el modo persistente (Wake Lock).  
> **Duración estimada:** 05:00 min.

---

## 🎬 Guión Técnico de Grabación

| Tiempo | Pantalla / Acción | Locución (Voz en off) |
| :--- | :--- | :--- |
| **00:00 - 00:45** | Clic en la pestaña **Localización** (`#nav-location-btn`). El mapa Leaflet oscuro se carga con animación suave. Aparece el marcador azul del usuario. | *«En este segundo capítulo exploraremos el mapa interactivo de Pingo. En pantalla vemos nuestro marcador azul en tiempo real. El halo semitransparente que lo rodea indica la precisión GPS satelital: cuanto más compacto, mayor es la exactitud de la lectura.»* |
| **00:45 - 01:45** | Se conecta un contacto remoto. Aparece el marcador verde del contacto con su Alias y la estela de rastro (trail) dibujándose tras él. | *«Cuando un contacto de nuestra agenda se conecta por WebRTC, su posición aparece en vivo con su propio color y Alias. A medida que se desplaza, Pingo dibuja una estela de rastro que nos permite conocer su dirección y velocidad de movimiento.»* |
| **01:45 - 03:00** | Activar el interruptor **Zona Segura (Geovalla)**. Mover el control deslizante de radio (150m). Centrar en la posición del contacto. | *«Una de las herramientas más potentes para familias y grupos es la Geovalla o Zona Segura. Activamos el interruptor y ajustamos el radio con el deslizador, por ejemplo a 150 metros. Si el contacto sale del perímetro establecido, nuestro teléfono emitirá una alerta sonora y visual inmediata.»* |
| **03:00 - 04:00** | Activar el interruptor **Modo Persistente** y explicar el Screen Wake Lock. | *«Los sistemas operativos modernos suelen apagar el GPS al apagar la pantalla para ahorrar batería. Para evitar cortes durante una excursión o guardia, activamos el 'Modo Persistente': esto solicita un bloqueo de suspensión para que el seguimiento se mantenga ininterrumpido.»* |
| **04:00 - 05:00** | Mostrar el interruptor de **Servicios en la Nube (Relay/Push)** para redes móviles 4G/5G con CGNAT. Cierre. | *«Si tu contacto está en una red móvil con cortafuegos estricto, activa el interruptor de Servicios en la Nube: esto habilitará el relé TURN y las notificaciones push para despertar la app en segundo plano. En el próximo episodio aprenderemos a grabar rutas en vivo y guardarlas en Git local.»* |

---

## 💡 Cues y Elementos Visuales
* **Animación**: Simulación de un contacto saliendo del círculo de la geovalla y salto de la alerta sonora/visual.
* **Badge**: Icono de *Screen Wake Lock* activo en el navegador.
