# TODO: Reflexiones y Alternativas sobre el Chat P2P en Malla

Actualmente, el sistema implementa una retransmisión por saltos (`relay`) de mensajes de chat en `peer-manager.js` (con un máximo de 2 saltos y de-duplicación con `seenMessages`). Sin embargo, la interfaz de usuario está orientada a **chats individuales (1 a 1)**. Esto genera una contradicción de diseño (los mensajes privados de un chat A-B se propagan por debajo a C y D).

A continuación se detallan las alternativas propuestas para su posterior revisión y decisión:

## Alternativa 1: Chat Estrictamente Privado (1 a 1)
* **Comportamiento**: Eliminar por completo el bloque de `relay` para el tipo de datos `'chat'`.
* **Flujo**: El mensaje viaja directamente por la conexión WebRTC establecida entre A y B. Si no existe conexión directa, el mensaje no se entrega (o se requiere conexión directa previa).
* **Ventaja**: Garantiza la privacidad del chat y se alinea con la UI actual de pestañas privadas por contacto.

## Alternativa 2: Chat de Difusión Local (0 Saltos de Relay)
* **Comportamiento**: Quitar el relay automático en los nodos receptores, pero permitir que el emisor envíe el mensaje a todos sus vecinos/contactos directos conectados en ese instante.
* **Flujo**: Si A está conectado con B y C, A envía el mensaje a ambos. B recibe el mensaje de A, pero **no** lo propaga hacia D.
* **Ventaja**: Permite un modelo de "grupo local" sin inundar el resto de la red.

## Alternativa 3: Chat de Malla / Sala General (Comportamiento Actual)
* **Comportamiento**: Mantener la propagación actual de 2 saltos.
* **Flujo**: Rediseñar la interfaz de usuario para que no simule chats individuales privados, sino una **Sala General / Mesh** común donde todos los mensajes recibidos o retransmitidos se consoliden en una única pantalla colectiva.
* **Ventaja**: Fomenta la comunicación comunitaria en la red local.

---

*Nota: Se ha decidido dejar el comportamiento actual (Alternativa 3 / Relay de 2 saltos) de manera temporal para priorizar la implementación del plan de pruebas de la funcionalidad de búsquedas distribuidas.*
