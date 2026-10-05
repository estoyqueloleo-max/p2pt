# AGENTS.md — Reglas y Flujo de Trabajo para Pingo

Este documento establece las directrices de trabajo obligatorias para cualquier agente que desarrolle en este repositorio.

---

## 1. 🔄 Flujo de Trabajo y Sincronización

* **Desarrollo Primario en `pingo`**:
  * Cualquier cambio, refactorización o nueva funcionalidad debe implementarse y validarse **primero aquí**, en este repositorio (`/home/jose/workspace/pingo`).
* **Sincronización hacia `estoyqueloleo`**:
  * Una vez implementadas y probadas las mejoras, se debe utilizar el script `./sync_to_estoyqueloleo.sh` para propagar los cambios a los repositorios de destino (`estoyqueloleo/p2pt`, `estoyqueloleo/backend`, etc.).
  * **Nunca** editar directamente en `estoyqueloleo/p2pt` cosas que pertenecen al core de Pingo sin reflejarlas aquí primero.

---

## 2. 🧪 Testing E2E con Playwright

* **Validación Obligatoria**:
  * Cada funcionalidad añadida o modificada (especialmente en Git, WebRTC/PeerJS, Chat, y UI) debe contar con tests E2E automatizados o enriquecer los existentes en `tests/`.
* **Ejecución de Tests**:
  * Ejecutar los tests con `npx playwright test` o `./run_e2e.sh` asegurándose de que pasen en verde antes de completar una tarea.
  * Para funcionalidades visuales del grafo de Git (Gitgraph), actualizar o añadir las aserciones correspondientes en `tests/gitgraph.spec.js`.

---

## 3. 🍓 Integración con el Appliance (QEMU / Docker)

* El appliance corre localmente en la IP `192.168.1.50` (o a través de su dominio configurado `pingo-casa.duckdns.org` con terminación TLS en Apache `.3`).
* El appliance expone:
  * **Git Smart HTTP**: `http://192.168.1.50:443/git/:user/:repo.git` (o vía HTTPS público).
  * **GoToSocial (ActivityPub/Mastodon)**: en `/api/v1/`, `/oauth/`, `/auth/sign_in`, etc.
  * **TURN / STUN**: en puerto `3478`.
  * **Signaling / WebSockets**: en puerto `443`.
* Los tests de sincronización remota de Git pueden utilizar este servidor como endpoint real cuando se requiera prueba de integración completa.
