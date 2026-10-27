# 20 · Entorno visual

## Carácter

Pixeltor debe sentirse como una herramienta **profesional, pulida y elegante**, en la familia visual de Adobe Illustrator: interfaz oscura neutra, densa pero ordenada, sin adornos, donde el color lo pone el trabajo del usuario. Debe ser **original**: inspirarse en la ergonomía y la jerarquía de Illustrator sin copiar sus iconos, logotipos ni marcas.

Palabras clave: *precisión · calma · densidad · nitidez · neutralidad · oficio*.

Detalle de identidad: la UI es suave (antialiasing, tipografía nítida), pero hay pequeños guiños pixelados en lugares concretos — el logotipo, los iconos de herramientas de píxel, el indicador de zoom en la barra de estado — nunca en textos ni controles.

## Distribución de la ventana (workspace *Esenciales*, 1440×900)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ◼ Pixeltor  Archivo Editar Objeto Capa Efecto Imagen Seleccionar Ver Ventana Ayuda  │ ← Barra de título + menú (32 px)
│                                                     [Esenciales ▾]  [🔍]  _ □ ✕     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Rectángulo │ Relleno ■▾ │ Contorno ■▾ 2 px ▾ │ Opacidad 100% │ X 12 Y 8 W 16 H 16 │⊞⊟│ ← Barra de control (36 px)
├──┬──────────────────────────────────────────────────────────────────┬──────────────┤
│▣ │ caminar.pixeltor @ 800% ✕ │ icono-app.pixeltor ✕ │                │ ▸ Propiedades│ ← Pestañas de documento (28 px)
│⬚ ├──────────────────────────────────────────────────────────────────┤──────────────│
│✎ │ ┌ cabecera visor ───────────────────────────────────────────────┐│ CAPAS   ≡    │
│◢ │ │                                                               ││ 👁 🔒 ▣ Luz fx│
│◯ │ │                     ┌───────────────┐                         ││ 👁    ▣ Cuerpo│
│▭ │ │                     │  lienzo 32×32 │                         ││   ▸ ◇ Rect 3 │
│✒ │ │                     │  al 800 %     │                         ││   ▸ ◇ Elipse │
│◈ │ │                     └───────────────┘                         ││ 👁    ▣ Fondo │
│🖐│ │                                                               ││──────────────│
│🔍│ └───────────────────────────────────────────────────────────────┘│ APARIENCIA ≡ │
│  │                                                                  │ ...          │
│■□├──────────────────────────────────────────────────────────────────┤──────────────│
│  │ IMÁGENES ▶  [miniaturas...]                         Total 1200 ms│ COLOR │ MUESTRAS│
├──┴──────────────────────────────────────────────────────────────────┴──────────────┤
│ 800% ▾ │ 32 × 32 px │ x 14 y 9 │ ■ #3A2F5B 100% │ Capa: Cuerpo │  ⚙ calculando…    │ ← Barra de estado (24 px)
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Regiones

1. **Barra de título (32 px)** — Logotipo pequeño (16 px), menú principal integrado en la misma barra (como Illustrator en Windows), a la derecha: selector de workspace, búsqueda/paleta de comandos, controles de ventana (en Windows vía *titleBarOverlay*).
2. **Barra de control (36 px)** — Contextual a la herramienta y la selección: muestra el tipo de objeto seleccionado a la izquierda, luego relleno, contorno, opacidad, transformación numérica (X, Y, W, H con candado de proporción, ángulo), alinear rápido, y opciones de herramienta (tamaño de pincel, tolerancia, simetría…). Los campos usan scrubbing.
3. **Barra de herramientas (izquierda, 40 px)** — Una columna (opción de dos columnas). Iconos de 20 px en botones de 32 px. Grupos separados por divisores finos. Flyouts con triángulo de 3 px en la esquina inferior derecha. Abajo: cuadros de relleno/contorno superpuestos, intercambiar, por defecto, y botones Color/Degradado/Ninguno. Al final: modo de pantalla.
4. **Pestañas de documento (28 px)** — Nombre, zoom actual y "•" si hay cambios sin guardar; cerrar al pasar el cursor.
5. **Área de trabajo** — Fondo `--canvas-bg` (más oscuro que los paneles). Lienzo centrado con sombra suave. Visores divididos con separadores finos. Reglas opcionales (16 px) en px de imagen.
6. **Dock derecho (240–320 px, redimensionable)** — Grupos de paneles apilados con cabeceras de pestañas; cada grupo colapsable a su cabecera; el dock entero colapsa a una **columna de iconos** (36 px) donde cada icono abre su panel como flotante anclado (comportamiento Illustrator). Paneles arrastrables para reagrupar o hacer flotantes.
7. **Panel Imágenes/Animación (inferior, 120–200 px)** — Colapsable; en workspace *Esenciales* está colapsado a una tira de 32 px con miniaturas pequeñas.
8. **Barra de estado (24 px)** — Zoom editable, tamaño de imagen, coordenadas del cursor en px de imagen, color bajo el cursor (muestra + hex + alfa), capa activa, indicadores de ajuste (snapping) conmutables, indicador de trabajo en segundo plano.

### Paneles por workspace

| Workspace | Dock derecho | Inferior |
|---|---|---|
| **Esenciales** | Propiedades · Capas / Apariencia · Color / Muestras | Imágenes (colapsado) |
| **Animación** | Capas · Color / Muestras · Vista previa | Animación (expandido, 200 px) |
| **Vectores** | Propiedades · Apariencia / Contorno / Degradado · Alinear / Buscatrazos · Capas | — |
| **Mínimo** | Columna de iconos | — |

## Comportamientos que transmiten "pulido"

- **Scrubbing**: arrastrar horizontalmente sobre la etiqueta de un campo numérico cambia su valor (`Shift` ×10, `Alt` ×0,1); el cursor cambia a ↔.
- Campos numéricos aceptan **expresiones** (`16*2`, `+4`) y unidades (`px`, `%`, `ms`, `°`).
- **Tooltips** con nombre + atajo (retraso 500 ms; instantáneos al moverse entre botones).
- **Menús** con iconos opcionales, atajos alineados a la derecha, submenús con retraso de 150 ms, separadores, elementos deshabilitados al 40 %.
- **Estado vacío** cuidado: sin documentos, pantalla de inicio con recientes y plantillas.
- **Sin saltos de layout**: los paneles mantienen su tamaño al cambiar de selección; los campos no aplicables se deshabilitan en lugar de desaparecer (salvo en la barra de control, que es contextual).
- **Microanimaciones** de 120–160 ms (`cubic-bezier(.2,0,0,1)`) en colapsar paneles, abrir flyouts y hover. Nada de rebotes. Respetar `prefers-reduced-motion`.
- **Foco visible** para navegación con teclado (anillo de 2 px en color de acento con separación de 1 px).

## Lienzo y overlays (especificación visual)

| Elemento | Aspecto |
|---|---|
| Área de trabajo | `--canvas-bg` |
| Sombra del lienzo | `0 2px 12px rgba(0,0,0,.45)` en px de pantalla |
| Tablero de transparencia | Cuadros de 8 px de pantalla, `#3A3A3A` / `#2E2E2E` (tema oscuro); configurable |
| Cuadrícula de píxeles | 1 px de pantalla, `rgba(255,255,255,.07)`; aparece con fundido entre 600 % y 800 % |
| Cuadrícula de tiles | 1 px, `rgba(61,139,255,.35)` |
| Guías | 1 px, cian `#2FD3E0` |
| Trazado de forma | 1 px, color de la capa |
| Ancla | Cuadrado de 6 px de pantalla, borde color de capa; seleccionada: relleno color de capa; no seleccionada: relleno blanco |
| Tirador | Línea 1 px + círculo de 5 px |
| Caja de selección | 1 px color de capa, 8 tiradores cuadrados de 7 px blancos con borde |
| Guías inteligentes | Magenta `#FF3EA5`, etiquetas en píldora magenta con texto blanco 10 px |
| Selección de píxeles | Hormigas en marcha blanco/negro, 1 px, alineadas a la rejilla |
| Papel cebolla | Anteriores tinte `#FF4D4D`, siguientes `#4D8DFF` |
| Visor activo | Borde interior 1 px `--accent` |
