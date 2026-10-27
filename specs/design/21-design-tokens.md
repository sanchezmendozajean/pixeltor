# 21 · Design tokens

Los tokens se implementan como variables CSS en `src/renderer/styles/tokens.css`, con un archivo por tema. Claude Design DEBE usar estos valores (puede proponer ajustes justificados).

## Color — Tema Oscuro (por defecto)

| Token | Valor | Uso |
|---|---|---|
| `--bg-app` | `#1F1F1F` | Fondo de ventana, barra de título |
| `--bg-panel` | `#2A2A2A` | Paneles, barra de herramientas, barra de control |
| `--bg-panel-header` | `#262626` | Cabeceras/pestañas de panel inactivas |
| `--bg-panel-raised` | `#323232` | Pestaña activa, popovers, menús |
| `--bg-input` | `#1B1B1B` | Campos de texto/número, selects |
| `--bg-hover` | `#363636` | Hover en filas y botones |
| `--bg-active` | `#404040` | Botón presionado, herramienta activa |
| `--bg-selected` | `#24344D` | Fila seleccionada (capas, imágenes) |
| `--canvas-bg` | `#161616` | Área de trabajo alrededor del lienzo |
| `--border` | `#3A3A3A` | Bordes de panel, separadores |
| `--border-subtle` | `#2F2F2F` | Divisores internos |
| `--border-input` | `#444444` | Borde de campos; foco → `--accent` |
| `--text-primary` | `#E6E6E6` | Texto principal |
| `--text-secondary` | `#A8A8A8` | Etiquetas, metadatos |
| `--text-disabled` | `#6B6B6B` | Deshabilitado |
| `--icon` | `#C8C8C8` | Iconos normales |
| `--icon-active` | `#FFFFFF` | Iconos activos |
| `--accent` | `#3D8BFF` | Foco, selección, herramienta activa (indicador), botones primarios |
| `--accent-hover` | `#5A9DFF` | |
| `--accent-muted` | `rgba(61,139,255,.18)` | Fondos de selección suaves |
| `--danger` | `#F0524F` | Eliminar, errores |
| `--warning` | `#F2B13A` | Avisos |
| `--success` | `#3DBE7A` | Confirmaciones |
| `--smart-guide` | `#FF3EA5` | Guías inteligentes |
| `--guide` | `#2FD3E0` | Guías |

**Colores de capa** (rotación al crear capas): `#4F9DFF` azul, `#FF5A5A` rojo, `#3FD07F` verde, `#D46BFF` violeta, `#2FD3E0` cian, `#FF9F43` naranja, `#F5D547` amarillo, `#FF6FB5` rosa.

## Color — Tema Gris medio

Igual estructura con fondos más claros: `--bg-app #3A3A3A`, `--bg-panel #464646`, `--bg-panel-raised #505050`, `--bg-input #333333`, `--canvas-bg #2C2C2C`, `--border #555555`, `--text-primary #EDEDED`, `--text-secondary #BDBDBD`.

## Color — Tema Claro

`--bg-app #E4E4E4`, `--bg-panel #F2F2F2`, `--bg-panel-header #EAEAEA`, `--bg-panel-raised #FFFFFF`, `--bg-input #FFFFFF`, `--bg-hover #E6E6E6`, `--bg-active #D6D6D6`, `--bg-selected #D7E6FF`, `--canvas-bg #CFCFCF`, `--border #C9C9C9`, `--text-primary #1E1E1E`, `--text-secondary #5C5C5C`, `--icon #3A3A3A`, `--accent #1F6FEB`.

Contraste mínimo **4.5:1** para texto de 11–12 px en todos los temas.

## Tipografía

| Token | Valor |
|---|---|
| `--font-ui` | `"Inter", "Segoe UI Variable", "Segoe UI", "Cantarell", "Noto Sans", system-ui, sans-serif` (Inter empaquetada con la app, licencia OFL) |
| `--font-mono` | `"JetBrains Mono", "Cascadia Mono", "DejaVu Sans Mono", monospace` (valores hex, coordenadas) |
| `--fs-xs` | 10 px — etiquetas de guías inteligentes, badges |
| `--fs-sm` | 11 px — **texto base de paneles**, campos, etiquetas |
| `--fs-md` | 12 px — menús, pestañas, barra de control |
| `--fs-lg` | 13 px — títulos de diálogo |
| `--fs-xl` | 18 px — pantalla de inicio |
| Pesos | 400 normal, 500 cabeceras de panel/pestañas activas, 600 títulos |
| `font-variant-numeric` | `tabular-nums` en todos los campos numéricos |
| Cabeceras de panel | 11 px, 500, **MAYÚSCULAS** con `letter-spacing: .04em` (opcional, a validar en diseño) |

## Espaciado y tamaños

| Token | Valor |
|---|---|
| Unidad base | 4 px |
| `--space-1..6` | 2, 4, 6, 8, 12, 16 px |
| Alto de control (campo, select, botón) | **22 px** (compacto), 26 px en diálogos |
| Alto de fila en paneles (capas) | 28 px (capas con miniatura: 36 px) |
| Padding de panel | 8 px horizontal, 6 px vertical |
| Botón de herramienta | 32×32, icono 20 px |
| Botón de icono en paneles | 22×22, icono 16 px |
| Ancho del dock | 260 px (mín. 220, máx. 400) |
| Separador de visores | 4 px (línea visible de 1 px) |

## Radios, bordes, sombras

| Token | Valor |
|---|---|
| `--radius-sm` | 2 px (campos, botones pequeños) |
| `--radius-md` | 4 px (botones, popovers, menús) |
| `--radius-lg` | 6 px (diálogos) |
| `--shadow-popover` | `0 4px 16px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.5)` |
| `--shadow-dialog` | `0 12px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.6)` |

La UI es **plana**: sin degradados en controles, sin sombras internas; la profundidad se comunica con niveles de gris.

## Iconografía

- Estilo **lineal**, trazo de 1,25 px en rejilla de 16 px (paneles) y 1,5 px en rejilla de 20 px (herramientas), esquinas ligeramente redondeadas, sin rellenos salvo para estados activos.
- Base sugerida: **Lucide** (licencia ISC) para iconos genéricos; iconos de herramientas propios.
- Las herramientas de **píxel** (lápiz, pincel, borrador, bote, varita) llevan un detalle pixelado sutil (p. ej. la punta del lápiz como 2×2 px cuadrados) para diferenciarlas de las vectoriales.
- **No** reutilizar iconos de Adobe.
- Icono de la app: monograma "P" construido sobre rejilla de píxeles 16×16 con un trazo vectorial curvo superpuesto (representa la fusión píxel + vector); colores acento azul + un segundo color cálido (`#FF9F43`). Variantes 16, 32, 48, 256 px.

## Movimiento

| Token | Valor |
|---|---|
| `--ease-standard` | `cubic-bezier(.2, 0, 0, 1)` |
| `--dur-fast` | 90 ms (hover) |
| `--dur-base` | 140 ms (flyouts, colapsar) |
| `--dur-slow` | 220 ms (diálogos) |
