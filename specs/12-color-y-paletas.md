# 12 · Color, paletas y degradados

## Modelo de color

- Documento en **RGBA 8 bits por canal**, sRGB. No hay modo indexado obligatorio, pero existe **Restringir a paleta** (opción del documento): el selector de color y las herramientas solo usan colores de la paleta activa, y los efectos pueden cuantizar a ella.
- Selector de color con modos **HSV** (por defecto, cuadrado S/V + barra H), **RGB**, **HSL**, campo **HEX** (acepta `#RGB`, `#RRGGBB`, `#RRGGBBAA`) y deslizador de **alfa**.
- Colores recientes (16) en el panel Color.

## Paletas (panel Muestras)

- La paleta del documento es una lista ordenada de muestras (`Swatch { id, name?, color }`); también hay paletas adicionales y una biblioteca de paletas de la app (PICO-8, Game Boy (4 tonos), NES, Endesga 32, Sweetie 16, AAP-64, Resurrect 64 — verificar licencias, la mayoría son de uso libre).
- Vista: rejilla de cuadros (16/24/32 px), lista con nombres.
- Operaciones: añadir color actual, eliminar, reordenar arrastrando, ordenar por tono/luminosidad, **rampas** (generar N tonos entre dos colores con desplazamiento de tono, *hue shifting*), extraer paleta de la imagen, importar/exportar `.gpl`, `.pal`, `.hex`, `.png` (1 px por color).
- **Muestras globales** [F3]: si un relleno/contorno usa `swatchId` y se edita la muestra, todas las formas que la usan se actualizan (como los colores globales de Illustrator). El ráster no se ve afectado (salvo con el efecto *Reemplazar colores*).

## Degradados

Panel **Degradado** y herramienta Degradado (`G`):

- Tipos: **lineal**, **radial**, **angular** (cónico).
- Paradas de color con posición, color y alfa; puntos medios entre paradas; invertir; guardar como muestra de degradado.
- En el lienzo (herramienta `G`): barra anotadora del degradado (inicio, fin, paradas arrastrables) sobre la forma, como Illustrator.
- **Modo de píxel** (`pixelMode`) — la clave para que los degradados funcionen en pixel art:

| Modo | Resultado |
|---|---|
| **Suave** | Interpolación continua 8 bits (puede producir muchos colores) |
| **Bandas** | N escalones duros de color (N = 2..32) |
| **Tramado** | N escalones con transiciones tramadas usando matriz **Bayer 2×2, 4×4, 8×8** o **ajedrez**; el patrón está anclado a coordenadas de imagen (no de la forma) para que dos formas adyacentes casen |
| **Paleta** | Cada píxel se cuantiza al color más cercano de una paleta, opcionalmente con tramado ordenado |

- Vista previa del modo de píxel en el panel (barra con el resultado pixelado).

## Requisito de pruebas

Los degradados con tramado DEBEN producir exactamente el mismo patrón para la misma posición de píxel en cualquier plataforma (pruebas golden).
