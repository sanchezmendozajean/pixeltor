# Pixeltor — Especificaciones

**Pixeltor** es un editor de imágenes pixeladas (iconos, sprites, tiles, animaciones cortas) para Windows y Linux, construido con Electron. Su diferencia frente a otros editores de pixel art es que **las capas son inteligentes**: además de pintar píxeles, cada capa puede contener **formas vectoriales que siempre se renderizan pixeladas** y **efectos no destructivos** (sombras, resplandores, desenfoques, distorsiones) que nunca alteran los datos originales hasta que el usuario decide "estampar".

> Piensa en: el flujo de pixel art de Aseprite + la edición vectorial y el panel Apariencia de Illustrator + los objetos inteligentes de Photoshop + los visores divididos de Blender.

## Índice

### Producto y funcionalidad
| Archivo | Contenido |
|---|---|
| [00-vision.md](00-vision.md) | Visión, principios, glosario, supuestos e interpretaciones |
| [01-arquitectura.md](01-arquitectura.md) | Stack técnico, procesos de Electron, estructura de carpetas |
| [02-modelo-de-documento.md](02-modelo-de-documento.md) | Documento, imágenes, capas, formas, apariencia, efectos (tipos TypeScript) |
| [03-render-pipeline.md](03-render-pipeline.md) | Rasterización pixel-perfect, composición, cachés, rendimiento, límites de tamaño |
| [04-herramientas.md](04-herramientas.md) | Herramientas de píxel y de vector, atajos de teclado |
| [05-formas-y-vectores.md](05-formas-y-vectores.md) | Edición de trazados, anclas, tiradores, alineación, ajuste (snapping), apariencia |
| [06-efectos.md](06-efectos.md) | Catálogo de efectos no destructivos y sus parámetros |
| [07-estampado-importar-exportar.md](07-estampado-importar-exportar.md) | Operaciones destructivas (estampar, rasterizar), importación y exportación |
| [08-animacion.md](08-animacion.md) | Varias imágenes por archivo, panel de animación, tiempos en ms, papel cebolla |
| [09-visores.md](09-visores.md) | Visores divididos estilo Blender, cada uno con edición completa |
| [10-formato-de-archivo.md](10-formato-de-archivo.md) | Formato `.pixeltor` |
| [11-historial-y-persistencia.md](11-historial-y-persistencia.md) | Deshacer/rehacer, autoguardado, preferencias |
| [12-color-y-paletas.md](12-color-y-paletas.md) | Modelo de color, paletas, degradados con tramado (dithering) |

### Diseño visual
| Archivo | Contenido |
|---|---|
| [design/20-entorno-visual.md](design/20-entorno-visual.md) | Distribución de la ventana, paneles, comportamiento estilo Illustrator |
| [design/21-design-tokens.md](design/21-design-tokens.md) | Colores, tipografía, espaciado, radios, iconografía |
| [design/22-componentes-ui.md](design/22-componentes-ui.md) | Componentes y sus estados |
| [design/23-pantallas.md](design/23-pantallas.md) | Lista de pantallas a diseñar, con contenido de ejemplo |

### Plan y traspaso
| Archivo | Contenido |
|---|---|
| [30-roadmap.md](30-roadmap.md) | Fases de construcción y criterios de aceptación |
| [handoff/PROMPT-CLAUDE-DESIGN.md](handoff/PROMPT-CLAUDE-DESIGN.md) | Prompt listo para pegar en Claude Design + archivos a adjuntar |
| [handoff/PROMPT-CLAUDE-CODE.md](handoff/PROMPT-CLAUDE-CODE.md) | Prompt listo para pegar en Claude Code |
| [../CLAUDE.md](../CLAUDE.md) | Instrucciones permanentes del repositorio para Claude Code |

## Flujo de trabajo sugerido

1. **Diseño** — Abrir Claude Design, adjuntar los archivos indicados en `handoff/PROMPT-CLAUDE-DESIGN.md` y pegar el prompt. Iterar hasta tener las pantallas de `design/23-pantallas.md`.
2. **Traer el diseño al repo** — Exportar el resultado de Claude Design (HTML/imágenes/tokens) a `design/` en la raíz del proyecto (`C:\Coding\pixeltor\design\`).
3. **Código** — Abrir Claude Code en `C:\Coding\pixeltor`, pegar el prompt de `handoff/PROMPT-CLAUDE-CODE.md`. Claude Code leerá `CLAUDE.md`, las specs y el diseño, y trabajará por fases (`30-roadmap.md`).

## Convenciones de estas specs

- **DEBE / NO DEBE**: requisito obligatorio. **DEBERÍA**: recomendado. **PUEDE**: opcional.
- Fases: cada requisito indica `[F1]`…`[F7]` cuando no pertenece al MVP inicial (ver roadmap).
- Unidades: siempre **píxeles de imagen** (`px`) salvo que se diga "píxeles de pantalla".
- La UI de la aplicación está en **español**, con i18n preparado para inglés.
