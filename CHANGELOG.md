# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Cada fase del roadmap (`specs/30-roadmap.md`) cierra con una entrada.

## [0.1.0] — F0 · Esqueleto

### Añadido

- Proyecto electron-vite con TypeScript estricto, Vue 3 (`<script setup>`), Pinia, Vitest, ESLint y Prettier. Tres `tsconfig` (`core` sin DOM ni Node, `node`, `web`) y una regla de ESLint que impide importar Vue, Electron o el renderer desde `src/core`.
- Proceso principal seguro: `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta, navegación bloqueada e instancia única. API tipada en `window.pixeltor` (preload CommonJS) con contrato IPC en `src/shared`.
- Ajustes persistentes en `userData/settings.json` con guardado atómico (tema).
- Barra de título personalizada con `titleBarOverlay` (Windows y Linux) que se recolorea con el tema.
- Tokens y componentes de `design/` (`tokens.css`, `components.css`), temas **Oscuro**, **Gris medio** y **Claro** conmutables desde Ver › Tema, y fuentes Inter y JetBrains Mono empaquetadas (licencias OFL en `resources/licenses/`).
- 135 iconos propios del diseño mediante `<PtIcon name>`.
- **Registro único de acciones** (`src/renderer/actions/`): de él salen los menús, los tooltips (nombre + atajo, 500 ms) y el despachador de atajos. Atajos de `specs/04-herramientas.md`, con prueba de que no hay duplicados ni acciones sin etiqueta.
- Shell maquetado según la pantalla 03: barra de título con menú, barra de control, barra de herramientas con flyouts (pulsación larga o clic derecho) y widget relleno/contorno, pestañas de documento, visor con cabecera, tira de imágenes colapsada, columna de iconos con paneles flotantes, dock (Propiedades · Capas/Apariencia · Color/Muestras) y barra de estado.
- `Tab` y `Mayús+Tab` ocultan los paneles; los toggles de la barra de estado y de la cabecera del visor funcionan.
- Texto de UI en español vía `src/renderer/i18n/es.json`.
- Smoke e2e con Playwright (apertura, menú con atajos, atajos de herramienta, cambio de tema persistente, ocultar paneles).
- `electron-builder.yml` con instalador NSIS (Windows) y AppImage (Linux).

### Pendiente o limitado

- **Linux sin verificar**: el AppImage está configurado pero no se ha construido ni probado (el desarrollo de F0 fue en Windows).
- El lienzo es una maqueta (tablero y cuadrícula de píxeles sobre un documento 32×32 de ejemplo); el modelo, el visor WebGL2 y los comandos llegan en F1.
- Los menús son funcionales pero casi todos los elementos están deshabilitados hasta que existan sus comandos.
- Los selectores de espacio de trabajo y la paleta de comandos (F3) están maquetados sin función.
- Sin icono de aplicación propio: se usa el de Electron (F7).

### Notas de entorno

- Si la red intercepta TLS (certificado autofirmado en la cadena), `npm install` puede dejar sin descargar el binario de Electron. Se resuelve con `NODE_USE_SYSTEM_CA=1 node node_modules/electron/install.js`, que usa el almacén de certificados del sistema sin desactivar la verificación.
- VS Code define `ELECTRON_RUN_AS_NODE`; hay que quitarlo del entorno para lanzar Electron (el e2e ya lo hace).
