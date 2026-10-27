# 01 · Arquitectura

## Stack

| Área | Elección | Motivo |
|---|---|---|
| Shell de escritorio | **Electron** (última estable) | Requisito; Windows + Linux con una base de código |
| Build | **electron-vite** + Vite | HMR en renderer, build separado main/preload/renderer |
| Lenguaje | **TypeScript** estricto (`strict: true`) | Modelo de datos complejo; refactors seguros |
| UI | **Vue 3** (Composition API, `<script setup>`) + **Pinia** | Reactividad fina para paneles; ecosistema conocido |
| Estilos | CSS con variables (tokens de `design/21-design-tokens.md`), CSS Modules o `<style scoped>` | Temas claro/oscuro intercambiables sin recompilar |
| Render del lienzo | **WebGL2** para mostrar; **CPU (TypedArrays)** para rasterizar y componer | Píxeles exactos y deterministas; WebGL solo para zoom/visualización |
| Trabajo pesado | **Web Workers** (pool) para efectos y composición de imágenes grandes | No bloquear la UI |
| ZIP | `fflate` | Rápido, sin dependencias nativas |
| PNG/GIF | `UPNG.js` (o `fast-png`) y `gifenc` | Codificación/decodificación en JS puro |
| Pruebas | **Vitest** (core en Node), **Playwright** (e2e con Electron) | |
| Empaquetado | **electron-builder**: Windows (NSIS + portable), Linux (AppImage + .deb) | |
| Lint/format | ESLint + Prettier | |

> El núcleo (`src/core`) NO DEBE depender del DOM, de Vue ni de Electron. Debe poder ejecutarse en Node y en un Worker. Esto permite probar rasterización, efectos y serialización con pruebas unitarias deterministas (comparando buffers de píxeles).

## Procesos

```
┌──────────────────────────── Main process ────────────────────────────┐
│ ventanas, menú nativo/atajos globales, diálogos abrir/guardar,        │
│ lectura/escritura de archivos, autoguardado, archivos recientes,      │
│ preferencias (userData/settings.json), asociación de extensión        │
└──────────────▲───────────────────────────────────────────────────────┘
               │ IPC tipado (invoke/handle) vía preload + contextBridge
┌──────────────┴──────────── Renderer (una ventana por documento) ─────┐
│ Vue UI (paneles, barras, diálogos)                                    │
│ Stores Pinia  ──►  DocumentSession (core)  ──► CommandBus + History   │
│ Viewports (WebGL2 + overlay)  ◄── RenderScheduler ◄── Worker pool     │
└───────────────────────────────────────────────────────────────────────┘
```

- Seguridad: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP estricta. El renderer solo accede al sistema de archivos a través de la API expuesta en preload.
- Una ventana puede contener varios documentos en pestañas (como Illustrator). Arrastrar una pestaña fuera de la ventana PUEDE crear una ventana nueva [F7].
- Barra de título personalizada (`titleBarStyle: 'hidden'` + `titleBarOverlay` en Windows). En Linux, opción en Preferencias para usar el marco nativo (algunos gestores de ventanas lo requieren).

## Estructura de carpetas

```
pixeltor/
├─ CLAUDE.md
├─ specs/                     ← este directorio
├─ design/                    ← exportaciones de Claude Design (referencia visual)
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ resources/                 ← iconos de la app, archivos de asociación
├─ src/
│  ├─ main/                   ← proceso principal
│  │  ├─ index.ts
│  │  ├─ windows.ts
│  │  ├─ menu.ts              ← menú de la app (también usado para atajos)
│  │  ├─ files.ts             ← abrir/guardar/exportar/recientes
│  │  ├─ autosave.ts
│  │  └─ settings.ts
│  ├─ preload/
│  │  └─ index.ts             ← API tipada window.pixeltor.*
│  ├─ shared/                 ← tipos compartidos main/renderer (IPC)
│  ├─ core/                   ← TS puro, sin DOM
│  │  ├─ model/               ← Document, Image, Layer, Shape, Appearance, Effect
│  │  ├─ geometry/            ← vec2, matrices, bezier, flatten, bbox, hit-test, booleanas
│  │  ├─ raster/              ← Bitmap RGBA, blend modes, rasterizador de polígonos/trazos, flood fill, pinceles
│  │  ├─ paint/               ← color, degradados, dithering, paletas
│  │  ├─ effects/             ← un archivo por efecto + registro
│  │  ├─ render/              ← composición de capa/imagen, cachés, invalidación por regiones
│  │  ├─ commands/            ← comandos deshacibles
│  │  ├─ history/
│  │  ├─ io/                  ← serialización .pixeltor, PNG, GIF, APNG, ICO, sprite sheet
│  │  └─ session.ts           ← DocumentSession: estado vivo de un documento abierto
│  ├─ workers/
│  │  └─ render.worker.ts
│  └─ renderer/
│     ├─ main.ts
│     ├─ App.vue
│     ├─ styles/              ← tokens.css, themes/dark.css, themes/light.css
│     ├─ i18n/                ← es.json, en.json
│     ├─ stores/              ← workspace, tools, selection, preferences, documents
│     ├─ tools/               ← implementación de cada herramienta (eventos puntero → comandos)
│     ├─ viewport/            ← WebGL2 renderer, overlays vectoriales, guías, cuadrícula
│     ├─ components/          ← componentes base (NumberField, ColorSwatch, Panel, Flyout…)
│     ├─ panels/              ← Capas, Apariencia, Propiedades, Efectos, Color, Muestras, Degradado,
│     │                          Contorno, Alinear, Navegador, Historial, Animación
│     ├─ dialogs/             ← Nuevo, Exportar, Tamaño de imagen, Preferencias, editores de efectos
│     └─ layout/              ← TitleBar, MenuBar, ControlBar, ToolBar, Dock, StatusBar, ViewportSplitter
└─ tests/
   ├─ core/                   ← pruebas unitarias con imágenes "golden" (PNG de referencia)
   └─ e2e/
```

## Flujo de datos

1. Una herramienta traduce eventos de puntero (en coordenadas de imagen) a **comandos** (`PaintStroke`, `CreateShape`, `MoveAnchors`, `SetEffectParam`…).
2. El `CommandBus` ejecuta el comando sobre el modelo, lo registra en el `History` y emite un **cambio** con la región sucia (`dirtyRect`) y los IDs afectados.
3. El `RenderScheduler` invalida las cachés afectadas y programa la recomposición (en el frame siguiente; trabajos grandes al worker).
4. La imagen compuesta se sube como textura WebGL; cada visor la dibuja con su zoom/pan y superpone las guías vectoriales.
5. Los stores de Pinia exponen solo lo que los paneles necesitan (proyecciones), no el modelo completo, para evitar reactividad costosa sobre buffers de píxeles. **Los buffers de píxeles NUNCA deben ser reactivos** (`markRaw`).

## Interacción en curso vs. comandos

Durante un arrastre (pincel, mover ancla, cambiar un parámetro con scrubbing), el estado se actualiza en vivo como **"previsualización transitoria"** y al soltar se confirma un único comando en el historial. Un parámetro de efecto cambiado por scrubbing durante 2 s genera **una** entrada de historial.

## Plataformas

- Windows 10/11 x64 (principal), Linux x64 (Ubuntu 22.04+, Fedora 39+; X11 y Wayland).
- Rutas, fin de línea y atajos (Ctrl en ambos) DEBEN ser independientes de la plataforma.
- Tableta gráfica: usar Pointer Events (`pressure`) para tamaño/opacidad opcional del pincel [F7].
