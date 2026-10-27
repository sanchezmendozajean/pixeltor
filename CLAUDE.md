# Pixeltor — instrucciones para Claude Code

Editor de pixel art en Electron (Windows + Linux) con **capas inteligentes**: ráster pintable + formas vectoriales rasterizadas pixel-perfect en vivo + efectos no destructivos. Varias imágenes por archivo con animación; visores divididos.

## Fuente de verdad

- **Especificaciones**: `specs/` (empieza por `specs/README.md`). Si el código y las specs discrepan, pregunta antes de cambiar cualquiera de los dos.
- **Diseño visual**: `design/` (salida de Claude Design) + `specs/design/`. Usa siempre los tokens CSS; no hardcodees colores ni tamaños.
- **Plan**: `specs/30-roadmap.md`. Trabaja fase por fase y detente al terminar cada una.

## Stack

Electron + electron-vite · TypeScript estricto · Vue 3 (`<script setup>`) + Pinia · WebGL2 para mostrar, CPU/TypedArrays para rasterizar y componer · Web Workers · fflate · Vitest · Playwright · electron-builder (NSIS, portable, AppImage, deb).

## Reglas de arquitectura

1. `src/core/` es TypeScript puro: **sin DOM, sin Vue, sin Electron**. Debe correr en Node y en Workers.
2. Todo cambio al documento pasa por un **comando** deshacible del `CommandBus`. Nada de mutar el modelo desde componentes.
3. Los buffers de píxeles **nunca** son reactivos (`markRaw`, fuera de Pinia).
4. El render es **determinista**: mismo documento → mismos bytes en cualquier plataforma. El lienzo muestra exactamente lo que se exporta.
5. Ningún efecto ni forma modifica el ráster base salvo los comandos explícitos de estampado/rasterización.
6. Invariante: estampar/rasterizar no cambia el render de la imagen (probarlo).
7. Seguridad de Electron: `contextIsolation`, `sandbox`, sin `nodeIntegration`; IPC tipado vía preload.
8. Atajos, menús y tooltips salen de un único registro de comandos.
9. Texto de UI en español vía i18n (`src/renderer/i18n/es.json`), nunca literales en componentes.
10. Rutas y comportamiento independientes de plataforma; probar en Windows y Linux.

## Pruebas

- Rasterizador, degradados con tramado y efectos: **golden tests** (PNG de referencia en `tests/core/golden/`). Para regenerar una referencia, explica por qué cambió.
- Benchmarks en `tests/core/bench` para los objetivos de `specs/03-render-pipeline.md`.
- Antes de dar algo por terminado: `npm run lint`, `npm run typecheck`, `npm test`.

## Convenciones

- Código e identificadores en inglés; comentarios y docs pueden ir en español.
- Commits pequeños en español, formato `tipo(ámbito): descripción` (feat, fix, refactor, test, docs, chore).
- Actualiza `CHANGELOG.md` al cerrar cada fase.
- No añadas dependencias pesadas sin justificarlo; prefiere implementaciones propias en `core` para algoritmos de píxel.
- No uses iconos, fuentes ni recursos con licencias incompatibles; nada de recursos de Adobe.
