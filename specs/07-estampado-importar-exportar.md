# 07 · Estampado, importación y exportación

## Estampar (operaciones destructivas)

Todas son deshacibles y aparecen en el historial con nombre claro.

| Comando | Atajo | Resultado |
|---|---|---|
| **Estampar forma(s)** | `Ctrl+E` | Cada forma seleccionada se renderiza (apariencia + efectos de forma) y se compone sobre el ráster base de su capa conservando el aspecto final (ver *Regla de orden* abajo). Las formas estampadas se eliminan. |
| **Estampar todas las formas de la capa** | `Ctrl+Shift+E` | Igual, para todas las formas de la capa activa. |
| **Rasterizar efectos de capa** | `Ctrl+Alt+E` | Estampa todas las formas y aplica los efectos de capa al ráster base. La capa queda solo con ráster. |
| **Aplicar efecto** | menú del efecto | Ver `06-efectos.md`. |
| **Combinar hacia abajo** | `Ctrl+Alt+↓` | Rasteriza la capa activa (formas + efectos + opacidad + modo) sobre la capa inferior, que también se rasteriza. |
| **Combinar visibles** / **Acoplar imagen** | `Ctrl+Shift+Alt+E` / — | Una sola capa ráster con la composición. |

### Regla de orden al estampar

Como el ráster base está **debajo** de todas las formas de la capa, estampar una forma que tiene otras formas debajo de ella (en la misma capa) podría cambiar el aspecto (pasaría a quedar debajo de esas formas). Para preservar el aspecto:

- Si la forma estampada **no** tiene formas no estampadas por debajo que se superpongan con ella → se estampa en el ráster base.
- Si las tiene → Pixeltor muestra un diálogo: *"Esta forma tiene otras formas debajo. ¿Estampar también las formas inferiores superpuestas / Estampar en una nueva capa encima / Cancelar?"* con la opción por defecto **Estampar en una nueva capa encima** (no se pierde nada y el aspecto es idéntico). Casilla "No volver a preguntar".

Invariante a probar: **el render de la imagen antes y después de cualquier estampado es idéntico píxel a píxel.**

## Importación

| Fuente | Comportamiento | Fase |
|---|---|---|
| PNG / JPG / BMP / WebP | Nuevo documento, o como capa (`Archivo › Colocar`), o como imágenes nuevas | F1 |
| Arrastrar y soltar archivos al lienzo | Colocar como capa nueva | F1 |
| Pegar imagen del portapapeles | Píxeles flotantes en capa activa | F1 |
| GIF animado | Una imagen por frame con su duración | F5 |
| Hoja de sprites (sprite sheet) | Diálogo: tamaño de celda o filas/columnas, margen, espaciado, orden → una imagen por celda | F5 |
| Secuencia de PNG | Seleccionar varios archivos → imágenes en orden alfabético natural | F5 |
| SVG | Importar trazados como formas (rellenos/contornos sólidos y degradados lineales/radiales) | F7 |
| Aseprite (`.ase/.aseprite`) | Capas y frames | futuro |
| Paletas `.gpl`, `.pal`, `.hex`, `.ase` (Adobe swatch) | Panel Muestras | F3 |

Las imágenes importadas más grandes que el máximo se rechazan con mensaje claro (y opción de reducir con vecino más cercano).

## Exportación

Diálogo **Exportar como…** (`Ctrl+Alt+S`) con vista previa a la izquierda y opciones a la derecha. "Exportar de nuevo" repite la última configuración guardada en el documento.

Opciones comunes:
- **Qué**: imagen actual / imágenes seleccionadas / todas / rango.
- **Escala**: ×1, ×2, ×3, ×4, ×8, ×16 o personalizada (entero), siempre **vecino más cercano**. Varios tamaños a la vez (p. ej. ×1 y ×4) con sufijo configurable (`@4x`).
- **Recortar** al contenido visible / margen extra.
- **Fondo**: transparente o color.
- **Nombre de archivo** con plantilla: `{doc}_{image}_{index}{scale}`.

| Formato | Detalles | Fase |
|---|---|---|
| **PNG** (una imagen) | RGBA 8 bits, o indexado si ≤ 256 colores (opción) | F1 |
| **Secuencia PNG** | Un archivo por imagen | F5 |
| **Hoja de sprites** | Disposición: horizontal, vertical, rejilla (columnas), empaquetada; relleno (padding) y extrusión de bordes; JSON de metadatos (formato *hash* o *array* compatible con TexturePacker/Aseprite: frame, duración, sourceSize) | F5 |
| **GIF animado** | Paleta global o por frame, umbral de transparencia, bucle, duración por imagen (redondeada a 10 ms, con aviso) | F5 |
| **APNG** | Animación con alfa completo | F5 |
| **WebP animado** | Opcional | F7 |
| **ICO** (Windows) | Combina varias imágenes del documento de distintos tamaños (16, 24, 32, 48, 64, 128, 256) en un `.ico` | F5 |
| **SVG de píxeles** | Cada píxel como `rect` agrupado por color (para web) | F7 |

Exportar es **no destructivo**: renderiza la composición completa (estampado virtual de formas y efectos) sin modificar el documento.
