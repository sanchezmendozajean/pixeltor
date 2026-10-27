# Pixeltor · Notas de diseño

- **Ronda 1** (aprobada): pantallas 3 y 13, `tokens.css`, `components.css` y set de iconos.
- **Ronda 2**: pantallas 1, 2, 4–12, 14 y 15. Sus decisiones están en la §4.

## 1. Decisiones

**Estructura pensada para Vue 3.** Cada bloque del prototipo corresponde a un componente con nombre de clase BEM-ligero (`pt-iconbtn`, `pt-toolbtn`, `pt-num`, `pt-lrow`, `pt-arow`, `pt-frame`, `pt-seg`…). Los estados se expresan con clases `is-*` (`is-hover`, `is-active`, `is-on`, `is-selected`, `is-current`, `is-hidden`, `is-error`, `is-disabled`, `is-focus`) además de las pseudoclases reales, para que la hoja de componentes pueda mostrar cada estado y para que Vue los enlace con `:class`. Todo el color sale de variables CSS; ningún componente lleva un hex de UI escrito.

| Componente Vue sugerido | Clase raíz |
|---|---|
| `IconButton`, `ToolButton` (+ `ToolFlyout`) | `.pt-iconbtn`, `.pt-toolbtn.has-fly` |
| `NumberField` (scrub + expresiones) | `.pt-num` > `.pt-num__lbl` + `.pt-numbox` |
| `Select`, `Checkbox`, `Toggle`, `Radio`, `SegmentedControl`, `Slider` | `.pt-select`, `.pt-check`, `.pt-toggle`, `.pt-radio`, `.pt-segctl`, `.pt-slider` |
| `ColorSwatch`, `FillStrokeWidget`, `ColorPicker`, `GradientBar` | `.pt-sw` (+ `--alpha`, `--none`, `--stroke`) |
| `Panel`, `PanelGroup`, `Dock`, `IconColumn` | `.pt-panel`, `.pt-phead`, `.pt-ptab`, `.pt-pfoot` |
| `LayerRow` / `ShapeRow` | `.pt-lrow`, `.pt-lrow.pt-srow` |
| `AppearanceRow` | `.pt-arow` |
| `FrameThumb` | `.pt-frame` |
| `ViewerHeader`, `StatusBar`, `DocTabs` | `.pt-vhead`, `.pt-seg`, `.pt-doctab` |
| `Menu`, `Tooltip`, `Toast`, `Popover`, `Dialog` | `.pt-menu/.pt-mi`, `.pt-tip`, `.pt-toast`, `.pt-popover`, `.pt-dialog` |

**Lienzo.** El pixel art del prototipo se dibuja como mapa de píxeles reales (un cuadrado por píxel, sin escalado de imagen), así el 1200 % es exacto y nítido. La cuadrícula de píxeles va encima como capa independiente; los overlays vectoriales van en un SVG aparte, igual que el canvas overlay 2D previsto en `09-visores.md`. En la app: textura con `NEAREST` + `image-rendering: pixelated` en cualquier `<canvas>` o `<img>` de miniatura.

**Caballero de ejemplo.** Es original y está construido como lo haría Pixeltor: *Cuerpo* = ráster + forma **Escudo** (elipse c(7,19) r(4,5) rasterizada con borde, aro y cruz) + forma **Espada** (trazado 1:1); *Contorno* = efecto Contorno de píxel calculado sobre Cuerpo; *Luz* = brillos; *Sombra* = elipse bajo los pies; *Fondo* oculto. Las 8 imágenes alternan 4 poses de piernas (100/100/150/100/100/100/150/100 ms = 900 ms). Paleta propia de 16 colores («Caballero 16»).

**Selección en pantalla 3.** Escudo seleccionado con V: trazado en el verde de la capa Cuerpo, 4 anclas huecas, caja de 8 tiradores y punto central. En una elipse los tiradores medios coinciden con las anclas; se dibuja el tirador (7 px, hueco) envolviendo el ancla (6 px, blanca), que es lo que hace Illustrator.

**Panel Capas.** Columnas fijas ojo/candado a la izquierda, barra de color de capa de 3 px, miniatura, nombre, fx, objetivo (○ hueco / ● con selección) y cuadrito de selección en el color de la capa. La capa activa usa `--bg-panel-raised`; la forma seleccionada usa `--accent-muted`. «Píxeles» (ráster base) es siempre la última sub-fila, con icono de cuadros rellenos para distinguirlo de las formas.

**Barra de estado.** El único guiño pixelado es la lupa con dos píxeles del campo de zoom. Las coordenadas y el hex van en mono tabular. Los ajustes son toggles de 16 px; las guías inteligentes usan su magenta en lugar del acento para que se reconozcan.

**Barra de control.** Cuando hay una forma seleccionada: tipo → relleno → contorno (color, grosor, alineación) → opacidad → punto de referencia + X/Y/An/Al con candado + ángulo → alinear → Estampar. «An/Al» en vez de «W/H» porque la UI está en español.

**Iconos.** 104 iconos propios, sin Lucide copiado y sin nada de Adobe. Tienen dos capas: `d` (trazo lineal, 1,5 px en 20 o 1,25 px en 16) y `f` (relleno opcional). Las herramientas de píxel (lápiz, pincel, borrador, bote, varita, degradado) usan `f` para su detalle pixelado de 2×2 en la rejilla; las vectoriales son solo trazo. `icons.json` trae los mismos datos para generar un componente `<PtIcon name>`.

**Logotipo.** Una «P» sobre una rejilla de 16 px en azul de acento, con un trazo curvo naranja `#FF9F43` superpuesto: píxel + vector. En la barra de título va a 16 px.

## 2. Desviaciones y ajustes de tokens

| Cambio | Por qué |
|---|---|
| **`--accent-solid` #2A6DD9** (oscuro/gris) y **#1A64D6** (claro) para el fondo de los botones primarios | Texto blanco 11 px sobre `--accent` #3D8BFF da 3,5:1 y no llega al 4,5:1 que pide la spec. `--accent` se sigue usando para foco, bordes, barra de herramienta activa y selección. |
| **`--accent-text`** #5A9DFF / #8DBBFF / #1A64D6 | El acento como texto (enlaces, valores conmutados) no pasaba: #3D8BFF sobre #2A2A2A da 4,1:1 y #1F6FEB sobre #F2F2F2 da 4,3:1. |
| Tema claro: `--warning` #B97800, `--smart-guide` #E6178C, `--guide` #0FA9B8 | Los originales pierden contraste sobre `--canvas-bg` claro. |
| Tokens **derivados** para gris medio y claro (`--bg-hover`, `--bg-active`, `--bg-selected`, `--border-subtle`, `--border-input`, `--text-disabled`) | La spec solo definía parte de la escala; se completaron con los mismos pasos de luminosidad que en el oscuro. |
| Tokens **nuevos**: `--border-input-hover`, `--on-accent`, `--checker-a/b`, `--pixel-grid`, `--viewer-header`, `--shadow-canvas`, `--tooltip-bg`, `--panel-header-h` y tamaños de región | Hacía falta nombrarlos para no dejar valores sueltos en los componentes. |
| **Miniatura de capa 32 × 32** (spec: 28) | Con 28 px un sprite de 32 px no cabe a 1:1 y se vería suavizado. Regla general: la miniatura usa el **mayor factor entero** que quepa (también en la tira de imágenes de 48 px: un 32 px se muestra a 1× centrado). |
| Miniaturas de la tira **colapsada**: 28 px, recortando 2 px por lado | Cabe en la tira de 32 px sin escalar. |
| Cabeceras de panel en **MAYÚSCULAS** 11 px / 500 / .04em | Se validó la opción de la spec: separa bien grupos en un dock denso. Si se prefiere estilo de título, basta con quitar `text-transform`. |
| Pantalla 3 a 1440 × 900 **fija** | Es una maqueta de ventana; la app real usa `flex` y ya está maquetada así, de modo que escala a 1280 × 720 y 1920 × 1080 sin cambios estructurales. |
| Columna de iconos (36 px) **visible junto al dock** en Esenciales | Contiene los paneles que no entran en el dock (Navegador, Alinear, Contorno, Degradado, Estilos, Vista previa, Buscatrazos), igual que la columna de paneles iconizados de Illustrator. |

## 3. Correcciones tras la ronda 1

- **Atajos**: los de la ronda 1 no coincidían con `specs/04-herramientas.md`. Ahora todas las pantallas usan los de la spec: Marco rectangular **S**, Lazo **Q**, Varita **W**, Lápiz **N**, Pincel **B**, Borrador **E**, Bote **K**, Degradado **G**, Cuentagotas **I**, Lápiz vectorial **Mayús+N**. La barra de herramientas añade el grupo de selección de píxeles (Marco, Lazo, Varita) y se marcan como flyouts las herramientas que tienen variantes en la spec (Selección directa, Marco, Lazo, Pluma, formas, Pincel, Bote).
- **Diálogo Estampar** (hoja de componentes y pantalla 11): ahora sigue la regla de `specs/07`. Ofrece «Estampar en una nueva capa encima» (por defecto) o «Estampar también las formas inferiores superpuestas», más Cancelar y la casilla «No volver a preguntar».
- Los colores de capa del ejemplo siguen el orden de creación: Fondo azul → Sombra rojo → Cuerpo verde → Contorno violeta → Luz cian.

## 4. Ronda 2 — decisiones por pantalla

**Estilos y datos compartidos.** Las pantallas 01, 02 y 04–15 cargan `compartido/pt.css` y `compartido/pt-data.js` en lugar de llevar cada una su copia. `pt.css` añade al shell las clases de layout de la ventana:

- `pt-app`, `pt-titlebar`, `pt-cbar`, `pt-body`, `pt-toolbar`, `pt-center`, `pt-viewport`, `pt-dock`, `pt-status`
- `pt-dialog`, `pt-scrim`, `pt-popover`, `pt-menu`

Equivalen a los componentes Vue `AppShell`, `TitleBar`, `ControlBar`, `Toolbar`, `ViewportArea`, `Dock`, `StatusBar`, `Dialog`, `Popover` y `Menu`. Se añade el token `--scrim` (velo bajo los diálogos modales).

| # | Decisiones |
|---|---|
| 01 Inicio | Botones Nuevo y Abrir con atajo visible. Ocho plantillas con vista previa proporcional (16 → 256 px). Recientes en tabla con miniatura pixelada, tamaño, número de imágenes, fecha y ruta. Lateral con novedades y ayuda. La casilla «Mostrar al iniciar» queda en el pie del lateral. |
| 02 Nuevo documento | Tres columnas: presets por categoría, formulario y vista previa a escala (100 % y 400 % con cuadrícula). Incluye paleta inicial con tira de colores, «Restringir a la paleta» (de `specs/12`) y cuadrícula de tiles opcional. «Guardar como plantilla» va a la izquierda del pie. |
| 04 Selección directa | Zoom 2000 % para que se vea el detalle de la espada. Anclas rellenas = seleccionadas, huecas = no seleccionadas. Se muestran los tiradores de las seleccionadas y de las adyacentes. Guía inteligente magenta con píldoras «ancla» y «45° · 5,1 px». Barra de control en modo ancla: convertir, tiradores simétricos o libres, cortar, unir, eliminar, X/Y en estado mixto y alinear anclas. El workspace pasa a **Vectores**. |
| 05 Apariencia | Se usa `icono-app.pixeltor`: un degradado tramado se ve mejor en una placa grande que en el caballero. La forma «Placa» tiene 2 contornos (exterior oscuro y central con degradado tramado), relleno lineal con Bayer 4×4, sombra paralela y resplandor exterior en modo Trama. El popover del degradado se ancla a la fila Relleno y muestra la GradientBar, el modo de píxel (Tramado, matriz 4×4, escalones) y una vista previa a ×4. En el lienzo se ven los widgets de radio de esquina y el anotador del degradado de la herramienta G. Dock del workspace Vectores: 280 px. |
| 06 Editor de efecto | Popover de 300 px junto al dock, con la flecha apuntando a la fila fx del panel Apariencia de la capa. Secciones Sombra y Salida (de `specs/06`): alfa Umbral 128 y «Ajustar a paleta». El pie lleva Presets ⋯, Restablecer, Cancelar y Aceptar. La sombra (1, 1, 60 %) se ve en vivo en el lienzo y una píldora «Vista previa en vivo» lo indica en la cabecera del visor. |
| 07 Menú Efecto | Una cabecera indica el destino («forma Escudo»). Las cinco categorías de `specs/06` llevan icono. Debajo van «Aplicar a la capa ▸» y «Rasterizar efectos de capa». El submenú muestra en una nota a qué se aplicará el efecto. |
| 08 Visores | Usa `hierba.pixeltor`. Zoom 2400 % y 600 % en lugar de 1200 % y 300 %: con un tile de 16 px los valores de la spec dejaban el lienzo diminuto. El visor activo tiene borde de acento. El mosaico 3×3 muestra la cuadrícula de tiles y marca la copia central. El Navegador refleja el visor activo. La barra de control incluye presets de disposición. |
| 09 Animación | El panel Animación (200 px) ocupa el ancho del centro y del dock. Contiene transporte, Bucle, velocidad, papel cebolla con número de imágenes y tinte, línea de tiempo proporcional a la duración (de `specs/08`, F7) y miniaturas de 48 px con duración editable. Una marca roja o azul bajo cada miniatura indica qué imágenes forman el papel cebolla. La Vista previa a 4× muestra imagen actual y FPS. Lápiz activo para enseñar la barra de control de una herramienta de pintura. |
| 10 Exportar | Vista previa con celdas marcadas y extracto del JSON (formato hash). Formatos en rejilla 2×3 y escalas como chips. Disposición, relleno y extrusión según `specs/07`. El pie lista los archivos que se van a crear. Atajo `Ctrl+Alt+S`. |
| 11 Estampar | Escenario en `icono-app.pixeltor`: la forma «Brillo» está encima de «Placa» y se superpone a ella. El diálogo muestra la pila de la capa y un «Antes = Después» para reforzar la invariante de que el render no cambia. |
| 12 Preferencias | Navegación lateral con buscador. La sección Interfaz incluye: tema con miniaturas, escala de la interfaz, cabecera de visor (al pasar el cursor o fija), barra de herramientas de 1 o 2 columnas, cabeceras en mayúsculas, tamaño de miniaturas, tooltips y animaciones. |
| 14 Tema claro | Es la pantalla 03 importada con `tema="claro"`, así que siempre coincide con ella. |
| 15 Flyouts | Flyout horizontal de formas al pulsar de forma prolongada sobre Elipse, con tooltip en Polígono. Menú contextual de «Escudo» con «Organizar» abierto. «Mover a capa» se muestra aparte, con las capas bloqueadas deshabilitadas. |

## 5. Pendiente / a validar

- Los zoom de la pantalla 08 (ver la tabla).
- El escenario «Brillo sobre Placa» de las pantallas 05 y 11, que no está en el contenido de ejemplo de la spec.
