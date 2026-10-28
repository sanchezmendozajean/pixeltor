# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Cada fase del roadmap (`specs/30-roadmap.md`) cierra con una entrada.

## [Sin publicar] — F2 · Formas vectoriales (en curso)

### Añadido

- **Rasterizador pixel-perfect** (`src/core`): relleno por líneas de escaneo con muestreo en el centro del píxel (`nonzero` y `evenodd`), Bézier aplanada a 0,1 px, elipse por punto medio (círculos simétricos), contorno de 1 px por Bresenham con pixel-perfect (sin recortar esquinas marcadas), contornos de grosor > 1 centrados (uniones y remates) y anillos interior/exterior con desplazamiento.
- **Formas**: rectángulo (radios por esquina), elipse, línea, polígono, estrella y trazado con anclas Bézier. Apariencia simple (relleno y contorno sólidos con orden, opacidad y modo de fusión por atributo). Las formas se guardan en `document.json` y se componen en vivo sobre el ráster de su capa sin modificarlo.
- **Estampar** (`Ctrl+E`, `Ctrl+Shift+E`) con la regla de orden: si una forma tiene otras debajo que se solapan, se estampan también las inferiores. Prueba de invariante: el render antes y después es idéntico píxel a píxel.
- **Herramientas**: Rectángulo (`M`), Elipse (`L`), Línea, Polígono, Estrella y Pluma (clic = esquina, arrastrar = ancla suave, clic en la primera = cerrar, Intro/Esc), con vista previa pixelada en vivo y Mayús para proporcional o ángulos de 45°. Selección (`V`): clic, Mayús+clic, mover arrastrando o con flechas, Supr y organizar (`Ctrl+]` y compañía).
- **Interfaz**: overlay con trazado en el color de la capa, caja delimitadora, tiradores y anclas; formas listadas bajo su capa en el panel Capas; panel Propiedades contextual (relleno, contorno, grosor, alineación, radio, opacidad); opciones de formas en la barra de control.
- Golden test de círculos de 3 a 64 px (huella en `__snapshots__`) y e2e de crear, seleccionar, mover y estampar.

- **Selección directa** (`A`): seleccionar anclas (Mayús suma), arrastrar anclas y tiradores (los suaves mantienen la simetría); editar una forma paramétrica la convierte en trazado. Herramientas Añadir, Eliminar y Convertir ancla. Objeto › Convertir en trazado (rectángulo, polígono y estrella conservan los píxeles; la elipse y los radios se aproximan con Bézier).
- **Escalar con la caja** (`V`): ocho tiradores, Mayús proporcional y Alt desde el centro; rectángulos, elipses, líneas y trazados hornean la escala en sus parámetros.

### Pendiente de F2

- Rotar con la caja, modo aislamiento y grupos, mover formas a otra capa desde la interfaz y los widgets de radio.
- `antialias` y trazos discontinuos no están implementados; el desplazamiento de contorno solo actúa con alineación interior/exterior.
- Medir el objetivo de 30 fps al editar anclas en 1000×1000 (hoy cada forma se rasteriza a tamaño completo de imagen, con caché por contenido).

## [0.2.0] — F1 · Núcleo ráster

### Añadido

- **Núcleo (`src/core`, sin DOM)**: modelo de documento (imágenes, capas con visibilidad, bloqueo, bloqueo de transparencia, opacidad y 9 modos de fusión), bitmaps RGBA8 fuera de la reactividad, composición determinista con las fórmulas de W3C Compositing and Blending y máscaras de selección.
- **Sesión, historial y comandos**: toda edición pasa por una `Transaction` que genera un único comando deshacible. Los cambios de píxeles se guardan como teselas de 64×64 (antes/después, comprimidas con fflate); los de modelo, como instantáneas de capas y selección. Límite de 200 pasos o 512 MB, fusión de cambios seguidos de una misma propiedad y detección de cambios sin guardar.
- **Herramientas**: Lápiz (pixel-perfect, Mayús+clic para línea recta), Pincel (cuadrado o redondo, tamaño con `[` y `]`), Borrador, Bote (tolerancia, contiguo, todas las capas), Cuentagotas (Alt como temporal), Mano (Espacio o botón central), Zoom, Marco rectangular (nueva/añadir/restar/intersección con Mayús/Alt), Varita mágica y mover selección o píxeles flotantes (flechas, Intro, Esc).
- **Selección**: seleccionar todo, deseleccionar, invertir, copiar, cortar, pegar, borrar y rellenar, con hormigas en marcha alineadas a la rejilla.
- **Visor**: `Viewport` (zoom y desplazamiento, independiente del render, listo para varios visores), render WebGL2 con filtro NEAREST, tablero de transparencia y cuadrícula de píxeles a partir de 800 %, overlay Canvas2D, zoom con rueda centrado en el cursor y desplazamiento ajustado a píxeles enteros.
- **Paneles**: Capas (miniaturas, visibilidad, bloqueo, renombrar con doble clic, reordenar arrastrando, opacidad, fusión, bloquear transparencia), Historial (clic para volver a un paso), Color (HSV + hexadecimal), Muestras, Navegador. Barra de control con las opciones de cada herramienta.
- **Archivos**: formato `.pixeltor` 1.0.0 (ZIP con `mimetype` sin comprimir, `document.json`, rásters PNG con SHA-256, miniatura), guardado atómico con `.bak`, tolerancia a rásters dañados (se cargan vacíos con aviso) y rechazo claro de versiones mayores. Importar PNG (Archivo › Abrir), exportar PNG con escala entera ×1–×16 y «Exportar de nuevo».
- **Autoguardado y recuperación**: cada 2 minutos y solo con cambios, en `userData/recovery`; al arrancar tras un cierre inesperado se ofrece Recuperar o Descartar. Al cerrar con cambios sin guardar se pregunta Guardar / No guardar / Cancelar.
- Códec PNG y SHA-256 propios en el core (sin dependencias nuevas salvo `fflate`).
- Pruebas: 30+ unitarias del core (deshacer 100 pasos, round-trip de `.pixeltor`, exportación ×4 pixel-perfect…), prueba de rendimiento de pincel en 1000×1000 con 20 capas y e2e de dibujo, capas, IPC de archivos y autoguardado.

### Pendiente o limitado

- **Linux sin verificar** (como en F0).
- El pincel no tiene aún opacidad ni tramado, y el Marco elíptico, el Lazo y los demás elementos de selección de píxeles de `specs/04` quedan para fases posteriores (no están en el alcance de F1).
- El Navegador no refresca su rectángulo al desplazar el visor sin cambiar el zoom.
- No se ha medido el objetivo de 60 fps en una máquina de referencia; la prueba automática solo comprueba < 16 ms por segmento de pincel.
- Recuperación tras fallo y diálogos nativos de guardado/cierre no tienen e2e (los diálogos nativos no se pueden automatizar); el IPC subyacente sí.
- `vitest bench` ya no existe en Vitest 5: los benchmarks de `tests/core/bench` son pruebas con umbral.

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
