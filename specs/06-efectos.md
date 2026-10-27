# 06 · Efectos no destructivos

## Principios

- Un efecto **nunca modifica** el ráster base ni la geometría: es una función `RGBA → RGBA` aplicada durante el render.
- Se puede aplicar a una **forma** (sobre el resultado de su apariencia) o a una **capa** (sobre la composición ráster base + formas: "estampado virtual").
- Los efectos se apilan; el **orden importa** (se aplican de arriba abajo según la lista del panel Apariencia/Efectos).
- Cada efecto se puede activar/desactivar, duplicar, reordenar, eliminar y guardar como preset.
- **Salida pixel art**: todo efecto tiene una sección "Salida" común:
  - **Alfa**: *Conservar* (permite semitransparencias), *Umbral* (valor 0–255: el alfa se vuelve 0 o 255), *Tramado* (Bayer 4×4 sobre el alfa).
  - **Ajustar a paleta**: cuantiza los colores resultantes a la paleta elegida (con o sin tramado).
  - Por defecto: *Umbral 128* en sombras/resplandores con radio 0, *Conservar* en el resto.
- El editor de cada efecto muestra **vista previa en vivo en el lienzo** mientras se ajustan parámetros (con scrubbing). Botones **Aceptar** / **Cancelar** (cancelar restaura los valores previos sin entrada en el historial).
- Si un efecto se aplica a una capa, la capa muestra un icono **fx** en el panel Capas; la forma con efectos muestra **fx** en su fila.

## Catálogo

Todos los parámetros de distancia son **enteros en px** salvo que se indique.

### Sombras e iluminación
| Efecto (`type`) | Parámetros |
|---|---|
| **Sombra paralela** (`drop-shadow`) | dx, dy (−64..64), color, opacidad, desenfoque (0 = sombra dura), expansión/spread (0..16), modo de fusión, "solo fuera de la forma" |
| **Sombra interior** (`inner-shadow`) | dx, dy, color, opacidad, desenfoque, contracción, modo |
| **Sombra larga** (`long-shadow`) | ángulo (pasos de 45° o libre), longitud (1..256), color, desvanecimiento — muy usada en iconos planos |
| **Resplandor exterior** (`outer-glow`) | color, opacidad, radio (0..64), expansión, caída (lineal/suave/escalonada), número de escalones, modo (por defecto *Trama*) |
| **Resplandor interior** (`inner-glow`) | color, opacidad, radio, origen (borde/centro), caída, modo |
| **Iluminación direccional** (`directional-light`) | ángulo de luz, altura, color de luz, color de sombra, intensidad, ancho del bisel (1..8 px); usa el alfa como mapa de alturas para **aclarar los bordes que miran a la luz y oscurecer los opuestos** — un sombreado automático de pixel art |
| **Bisel** (`bevel`) | profundidad, tamaño, ángulo, colores de luz/sombra, estilo (interior/relieve) |

### Contornos de píxel
| Efecto | Parámetros |
|---|---|
| **Contorno de píxel** (`pixel-outline`) | grosor (1..8), posición (exterior/interior), conectividad (4 = sin diagonales, 8 = con diagonales), color, "solo esquinas" — el contorno clásico de sprites, calculado por dilatación morfológica del alfa |
| **Contorno selectivo** (`selout`) | oscurece el contorno existente hacia el color adyacente (técnica *selective outline*) [F7] |

### Desenfoque
| Efecto | Parámetros |
|---|---|
| **Desenfoque gaussiano** (`gaussian-blur`) | radio (0..64, admite 0,5), solo alfa / solo color / ambos |
| **Desenfoque de caja** (`box-blur`) | radio H, radio V, iteraciones |
| **Desenfoque de movimiento** (`motion-blur`) | ángulo, distancia |

### Distorsión
| Efecto | Parámetros |
|---|---|
| **Onda** (`wave`) | eje (H/V), amplitud (px), longitud de onda (px), fase (°) — fase animable por imagen [F5] |
| **Ondulación** (`ripple`) | centro, amplitud, longitud de onda |
| **Torsión** (`twirl`) | centro, ángulo, radio |
| **Desplazamiento** (`offset`) | dx, dy, envolver (wrap) sí/no — útil para tiles |
| **Pixelar / mosaico** (`mosaic`) | tamaño de celda W×H, muestreo (centro/promedio/moda) |
| **Esférico** (`spherize`) [F7] | cantidad, radio |

Todas las distorsiones muestrean con **vecino más cercano** por defecto (opción bilineal con salida a paleta).

### Color
| Efecto | Parámetros |
|---|---|
| **Tono/Saturación/Luminosidad** (`hsl`) | ΔH, ΔS, ΔL, colorear |
| **Brillo/Contraste** (`brightness-contrast`) | brillo, contraste |
| **Mapa de degradado** (`gradient-map`) | degradado, pixelMode |
| **Reemplazar colores** (`color-replace`) | tabla origen→destino, tolerancia — ideal para variantes de paleta (skins) |
| **Posterizar / Reducir a paleta** (`posterize`) | niveles o paleta, tramado |
| **Invertir** (`invert`) | — |
| **Superposición de color** (`color-overlay`) | color, opacidad, modo |

## Interfaz

- Menú **Efecto** (lista por categorías, como Illustrator) aplica el efecto a la selección actual: si hay formas seleccionadas → a las formas; si no → a la capa activa. El submenú **Efecto › Aplicar a la capa** fuerza la capa.
- Botón **fx** en el panel Apariencia y en el panel Capas.
- **Panel Efectos** (opcional, dockable): lista los efectos del objetivo activo con sus parámetros principales en línea, sin abrir diálogos.
- Editor de efecto: popover anclado al panel (no modal) con encabezado "Sombra paralela — Rectángulo 3", campos agrupados, sección "Salida", botón de presets (⋯), Aceptar/Cancelar.

## Implementación

- Registro de efectos: `effects/registry.ts` con, por cada tipo: esquema de parámetros (con rangos y valores por defecto), función `apply(input: Bitmap, params, ctx): Bitmap`, función `influenceRadius(params)` (para expandir regiones sucias y bounding boxes), y metadatos de UI (etiqueta, categoría, icono).
- Los efectos DEBEN ser puros y deterministas, probados con imágenes golden.
- Desenfoque gaussiano: implementación separable o 3 pasadas de box blur; resultado determinista (sin floats dependientes de la plataforma en el redondeo final).

## Operaciones destructivas relacionadas

- **Aplicar efecto** (en el menú del efecto): estampa ese efecto y los anteriores en el objetivo. En una forma, implica estampar la forma. En una capa, implica "Rasterizar efectos de capa" hasta ese efecto.
- **Rasterizar efectos de capa** (`Ctrl+Alt+E`): estampa todas las formas de la capa en el ráster base, aplica todos los efectos de capa y vacía la lista. Ver `07-estampado-importar-exportar.md`.
