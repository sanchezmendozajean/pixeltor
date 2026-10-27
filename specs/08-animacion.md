# 08 · Varias imágenes y animación

## Concepto

Un documento contiene **una o más imágenes**. Cada imagen tiene sus propias capas, formas y efectos, y una **duración en milisegundos**. En orden, forman una animación. También sirven como colección (p. ej. un juego de iconos en 16, 32 y 48 px).

## Panel Imágenes / Animación

Panel acoplado por defecto en la parte inferior (workspace *Animación*) y colapsable. Dos modos de vista conmutables:

**Modo tira (por defecto)**
```
[◀◀][◀][▶ Play][▶][▶▶] [⟳ Bucle ▾]  Velocidad 1× ▾   [◐ Cebolla ▾]   Total: 1 200 ms · 12 imágenes
┌────┐┌────┐┌────┐┌────┐┌────┐
│ 🖼 ││ 🖼 ││ 🖼 ││ 🖼 ││ 🖼 │  ...  [+]
└────┘└────┘└────┘└────┘└────┘
 1     2     3     4     5
100ms 100ms 150ms 100ms 80ms
```
- Miniatura de cada imagen (con tablero de transparencia), número, nombre (al pasar el cursor) y campo de **duración en ms** editable (con scrubbing).
- Imagen activa resaltada con borde de acento. Selección múltiple con `Shift`/`Ctrl`.
- Arrastrar para **reordenar**; `Alt+arrastrar` duplica.
- Menú contextual: Nueva imagen, Duplicar, Eliminar, Establecer duración… (aplica a todas las seleccionadas), Invertir orden, Excluir de la animación (la miniatura se muestra atenuada y tachada), Propiedades (nombre, tamaño).
- Barra de **línea de tiempo** proporcional a la duración [F7] (opcional, como Aseprite).

**Modo rejilla**: miniaturas grandes en rejilla, útil para colecciones de iconos.

## Reproducción

- Vista previa en **una ventana flotante/panel "Vista previa"** con zoom propio (1×–8×), fondo (transparente, color, tablero), y además se puede reproducir en cualquier **visor** (botón Play del visor).
- Modos: **Bucle**, **Ping-pong**, **Una vez**. Velocidad: 0,25×, 0,5×, 1×, 2×.
- Reproducción precisa: el reloj usa `performance.now()` y acumula tiempos (no `setInterval` por frame); muestra FPS efectivos en la vista previa.
- Las imágenes de tamaño distinto se centran en un lienzo del tamaño máximo.
- Reproducir rango: seleccionar imágenes y "Reproducir selección".

## Papel cebolla

- Activado con `O` o en el panel. Configuración: nº de imágenes anteriores (0–5) y siguientes (0–5), opacidad base (decreciente por distancia), **tinte** (anteriores en rojo, siguientes en azul, o sin tinte), solo contorno [F7].
- Se dibuja en los visores como overlay; nunca se exporta.

## Relación entre imágenes

- **Nueva imagen** (`Ctrl+Alt+N`): opciones *vacía* (mismas capas, sin contenido) o *duplicar actual* (por defecto).
- La estructura de capas **no** está enlazada entre imágenes en v1: cada imagen tiene capas independientes. Para facilitar el trabajo:
  - Seleccionar una capa por nombre en la imagen siguiente al cambiar de imagen (si existe una con el mismo nombre se activa).
  - **Capas enlazadas (celdas compartidas)** [F7/futuro]: una capa puede compartir su contenido entre varias imágenes (como las *linked cels* de Aseprite).
- **Efectos animables** [F5, opcional]: parámetros como la fase de *Onda* pueden incrementarse automáticamente por imagen ("Distribuir parámetro en imágenes").

## Atajos

`,` / `.` imagen anterior/siguiente · `Ctrl+Enter` reproducir/pausar · `Home`/`End` primera/última (con el panel enfocado) · `O` papel cebolla.
