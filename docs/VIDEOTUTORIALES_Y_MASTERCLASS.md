# 🎬 Pingo — Masterclass y Serie de Videotutoriales

> **Estructura oficial de contenidos audiovisuales para la plataforma Pingo.**  
> Esta guía contiene los guiones técnicos, minutajes, acciones en pantalla y locuciones para la grabación de videotutoriales paso a paso y masterclass de arquitectura P2P Local-First.

---

## 🧭 Mapa de Episodios

```
[Masterclass Pingo]
   ├── 📺 Episodio 1: Identidad Criptográfica, Privacidad y Agenda P2P
   ├── 📺 Episodio 2: Mapa en Tiempo Real, Geovallas y Modo Persistente
   ├── 📺 Episodio 3: Workspace Cartográfico, Grabación REC y Git en el Navegador
   ├── 📺 Episodio 4: Chat Mesh, Streaming P2P y Búsqueda Semántica con IA Local
   └── 📺 Episodio 5: Servidor Autónomo Doméstico (Alpine Appliance) y Soberanía
```

---

## 📑 Índice de Episodios y Minutaje

| Episodio | Título | Duración Estimada | Dificultad | Enfoque |
| :--- | :--- | :---: | :---: | :--- |
| **01** | [Identidad Criptográfica y Agenda Privada](tutorials/01_identidad_y_agenda.md) | 04:30 min | 🟢 Básico | Usuarios / Onboarding |
| **02** | [Mapa en Vivo, Geovallas y Persistencia](tutorials/02_mapa_geovallas_persistencia.md) | 05:00 min | 🟢 Básico | Familias y Deporte |
| **03** | [Workspace Cartográfico y Control de Versiones Git](tutorials/03_workspace_rutas_git.md) | 06:30 min | 🟡 Intermedio | Senderismo / Campo |
| **04** | [Comunicación Mesh, Streaming e IA Local](tutorials/04_mesh_chat_streaming_ia.md) | 06:00 min | 🟡 Intermedio | Grupos y Equipos |
| **05** | [Servidor Doméstico Autónomo y Appliance Alpine](tutorials/05_appliance_servidor_propio.md) | 07:00 min | 🔴 Avanzado | DevOps y SysAdmins |

---

## 🎥 Estándar de Grabación y Producción

### 1. Especificaciones de Captura
* **Resolución**: 1920x1080 (1080p Full HD) a 60 fps.
* **Interfaz**: Tema Oscuro nativo con estilo Glassmorphism.
* **Dispositivos**: Navegador Desktop (Chrome/Firefox) + Emulador Móvil PWA (Android Pixel 7).
* **Audio**: Voz en off clara, locución neutra y explicativa.

### 2. Automatización con Playwright
Los capítulos pueden grabarse automáticamente mediante el script de Playwright disponible en:
```bash
npx playwright test docs/tutorials/scripts/record_tutorials.spec.js
```
Este comando ejecuta paso a paso los tours interactivos integrados en la aplicación y genera los archivos de vídeo `.webm` listos para montaje.

---

## 📂 Enlaces a los Guiones Detallados

- [Guión 01: Identidad y Agenda](tutorials/01_identidad_y_agenda.md)
- [Guión 02: Mapa, Geovallas y Persistencia](tutorials/02_mapa_geovallas_persistencia.md)
- [Guión 03: Workspace, Rutas REC y Git](tutorials/03_workspace_rutas_git.md)
- [Guión 04: Red Mesh, Streaming de Vídeo e IA](tutorials/04_mesh_chat_streaming_ia.md)
- [Guión 05: Servidor Autónomo y Alpine Appliance](tutorials/05_appliance_servidor_propio.md)
