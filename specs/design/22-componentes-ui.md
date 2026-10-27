# 22 · Componentes de UI

Cada componente debe diseñarse con estados: **normal, hover, activo/presionado, foco (teclado), deshabilitado** y, cuando aplique, **seleccionado, mixto (valores distintos en la selección) y error**.

## Componentes base

| Componente | Descripción |
|---|---|
| **IconButton** | 22×22 (panel) / 32×32 (herramientas). Activo: fondo `--bg-active` + icono blanco; herramienta activa añade barra de acento de 2 px a la izquierda. |
| **ToolButton con flyout** | Triángulo de 3 px en esquina inferior derecha. Pulsación larga (300 ms) o clic derecho → flyout horizontal con todas las variantes y sus atajos; opción "arrancar" (tear-off) para dejarlo flotante [F7]. |
| **Button** | Primario (acento), secundario (borde), fantasma (sin borde). 22 px compacto, 26 px en diálogos. |
| **NumberField** | Etiqueta (scrubbable) + campo + unidad + flechas de incremento opcionales. Acepta expresiones. Estado *mixto* muestra campo vacío con placeholder "—". |
| **TextField**, **Select/Dropdown**, **Checkbox**, **Toggle**, **Radio/SegmentedControl** | Densos, 22 px, radio 2 px. |
| **Slider** | Pista de 2 px, cabezal de 10 px; siempre acompañado de NumberField. |
| **ColorSwatch** | Cuadro con tablero bajo el color si alfa < 100 %; estado "ninguno" con línea roja diagonal; estado "degradado" muestra el degradado. Clic → popover de color. |
| **FillStrokeWidget** | Dos cuadros superpuestos (relleno arriba-izquierda, contorno como cuadro hueco abajo-derecha), flecha de intercambio y mini botón por defecto. |
| **ColorPicker (popover)** | Cuadrado S/V 180×180, barra H vertical, barra alfa, pestañas HSV/RGB/HSL, HEX, botón cuentagotas, fila de recientes, acceso a Muestras. |
| **GradientBar** | Barra de vista previa con paradas (triángulos/círculos) arrastrables, punto medio en rombo; debajo, vista previa del **modo de píxel**. |
| **Panel** | Cabecera con pestañas (grupo), botón menú ≡ (opciones del panel), colapsar ▾. Cuerpo con scroll fino (6 px, aparece en hover). Pie opcional con botones de acción (iconos 16 px). |
| **Dock / IconColumn** | Columna de iconos de paneles colapsados; al hacer clic abre el panel como popover anclado a la izquierda del icono. |
| **Menu / ContextMenu** | Fondo `--bg-panel-raised`, ancho mínimo 200 px, ítems de 24 px, atajos en `--text-secondary` alineados a la derecha, checkmarks, submenús. |
| **Tooltip** | Fondo `#111`, texto 11 px, nombre en blanco + atajo en gris, radio 3 px. |
| **Dialog** | Modal centrado, cabecera con título 13 px/600, cuerpo con secciones, pie con botones a la derecha (orden según plataforma). |
| **Popover** | Para editores de efecto y selectores; flecha de anclaje opcional. |
| **Tabs** | Pestañas de documento (con cerrar, indicador de cambios) y de grupo de panel. |
| **Splitter** | 4 px, hover muestra línea de acento. |
| **Toast / Notificación** | Esquina inferior derecha sobre la barra de estado, 3–5 s, con acción opcional ("Deshacer"). |
| **ProgressIndicator** | Barra fina indeterminada en barra de estado y en diálogos de exportación. |

## Componentes de dominio

### Fila de capa (panel Capas)
```
[👁][🔒] [▸] [miniatura 28×28] Nombre de la capa        [fx][●]
```
- 👁 visibilidad, 🔒 bloqueo (columnas fijas a la izquierda, como Illustrator).
- ▸ expandir para ver **formas** de la capa como sub-filas indentadas (icono del tipo de forma ◇ ▭ ◯ ✒, nombre, fx si tiene efectos). El ráster base aparece como sub-fila fija al final: "Píxeles".
- **Indicador de color de capa**: barra vertical de 3 px a la izquierda de la miniatura.
- ● **Indicador de objetivo/selección** a la derecha (círculo hueco = objetivo; círculo relleno = tiene objetos seleccionados), como el "target" de Illustrator; clic selecciona todo lo de la capa.
- Doble clic en nombre = renombrar; doble clic en miniatura = opciones de capa (nombre, color, opacidad, modo de fusión, bloquear transparencia).
- Arrastrar para reordenar capas y mover formas entre capas.
- Pie: Nueva capa, Nueva capa desde selección, Agrupar [F7], fx, Estampar formas, Eliminar. Encima de la lista: Opacidad y Modo de fusión de la capa activa y botón de **bloquear transparencia**.

### Panel Propiedades (contextual, como Illustrator)
Secciones que cambian según la selección:
- *Nada seleccionado*: documento/imagen (tamaño, fondo, cuadrícula, botones "Tamaño de imagen", "Tamaño de lienzo", "Preferencias").
- *Forma*: Transformar (X, Y, W, H, ángulo, voltear), Apariencia rápida (relleno, contorno, opacidad, + enlace "Más opciones" → panel Apariencia), parámetros de forma (radios, lados), Acciones rápidas (Estampar, Convertir en trazado, Agrupar, Organizar).
- *Anclas*: X/Y del ancla, tipo, acciones de anclas.
- *Selección de píxeles*: tamaño, posición, acciones (recortar, rellenar, voltear, nueva capa).
- *Herramienta de pintura activa sin selección*: opciones del pincel.

### Panel Apariencia
Ver `05-formas-y-vectores.md`. Filas de 26 px con muestrario a la izquierda, descripción compacta, ojo a la derecha; filas de efectos con prefijo **fx** en cursiva y nombre subrayado al hover (clic abre editor).

### Editor de efecto (popover)
Ancho 300 px. Cabecera: nombre del efecto + objetivo. Secciones plegables; sección "Salida" común al final; pie: Presets ⋯, Restablecer, Cancelar, Aceptar. Vista previa en vivo en el lienzo.

### Panel Imágenes / Animación
Ver `08-animacion.md`. Miniaturas 48 px (tira) / 96 px (rejilla), número arriba a la izquierda en badge, duración editable debajo. Activa: borde 2 px acento. Excluida: 40 % opacidad + icono ⊘. Controles de transporte con iconos de 16 px.

### Cabecera de visor
24 px, fondo `--bg-panel` al 85 % con desenfoque de fondo; controles compactos (ver `09-visores.md`).

### Barra de estado
Segmentos separados por divisores de 1 px; el zoom es un campo editable con dropdown de niveles; los toggles de ajuste son iconos de 16 px conmutables.

### Navegador
Miniatura de la imagen con rectángulo rojo/acento del área visible del visor activo; deslizador de zoom abajo.
