# 00 · Visión y principios

## Problema

Los editores de pixel art (Aseprite, Pixelorama, LibreSprite) son destructivos: una sombra, un contorno o un círculo, una vez dibujados, son solo píxeles. Si el sprite cambia de forma, hay que redibujar la sombra. Los editores vectoriales (Illustrator, Inkscape) son flexibles pero producen bordes suavizados (antialiasing) que no sirven para pixel art.

## Propuesta

Pixeltor une ambos mundos:

- **Capas como papel transparente** donde se pinta píxel a píxel.
- **Formas vectoriales vivas** en la capa, que se ven siempre como píxeles nítidos pero conservan su trazado editable (anclas, tiradores, rellenos, contornos múltiples, degradados).
- **Efectos no destructivos** (sombra, resplandor, desenfoque, distorsión, iluminación…) sobre formas o capas completas: se ve el resultado, pero los datos originales se conservan.
- **Estampar** es la única forma de convertir lo vivo en píxeles, y siempre es una decisión explícita del usuario (y se puede deshacer).
- Un archivo contiene **varias imágenes** que pueden reproducirse como animación con duración en milisegundos por imagen.
- La misma imagen se puede editar en **varios visores** a la vez (por ejemplo, uno al 800 % y otro al 100 %).

## Principios de producto

1. **Pixel-perfect siempre.** Todo lo que se ve en el lienzo es exactamente lo que se exporta. Nada de suavizado salvo que el usuario lo active por forma.
2. **No destructivo por defecto, destructivo a voluntad.** Ninguna operación pierde datos sin una acción explícita (Estampar, Rasterizar, Aplicar efecto).
3. **Profesional y sobrio.** UI densa, oscura, precisa, con la ergonomía de Illustrator (panel Apariencia, barra de control contextual, flyouts de herramientas, campos con "scrubbing").
4. **Rápido en lienzos pequeños, correcto en grandes.** 16×16 a 256×256 deben sentirse instantáneos; 1000×1000 debe ser fluido para pintar y editar.
5. **Teclado primero.** Todas las herramientas y comandos frecuentes tienen atajo; los atajos de Illustrator se respetan cuando tienen sentido.
6. **Archivos abiertos y estables.** El formato `.pixeltor` es un ZIP con JSON + PNG, versionado y migrable.

## Público

- Diseñadores de iconos y UI pixelada.
- Desarrolladores de juegos indie (sprites, tiles, animaciones cortas).
- Usuarios de Illustrator que quieren hacer pixel art sin perder flexibilidad.

## Glosario

| Término | Definición |
|---|---|
| **Documento** | Un archivo `.pixeltor`. Contiene una o más imágenes, paletas y ajustes. |
| **Imagen** | Un lienzo de W×H px con su pila de capas. Equivale a un "frame" cuando se anima. |
| **Capa** | Hoja transparente con: un **ráster base** (píxeles pintados), una lista de **formas** y una lista de **efectos de capa**. |
| **Ráster base** | Mapa de bits RGBA de la capa, donde actúan pincel, lápiz, borrador y cubo. |
| **Forma** | Objeto vectorial (rectángulo, elipse, línea, polígono, estrella, trazado libre o grupo) que vive en una capa y se rasteriza en vivo. |
| **Apariencia** | Pila ordenada de **rellenos** y **contornos** de una forma (como el panel Apariencia de Illustrator). |
| **Efecto** | Transformación no destructiva aplicada al resultado de una forma o de una capa. |
| **Estampar** | Convertir una forma (con su apariencia y efectos) en píxeles del ráster base y eliminar el vector. Destructivo. |
| **Rasterizar efectos de capa** | Aplicar los efectos de capa sobre el ráster base y vaciar la lista de efectos. Destructivo. |
| **Visor** | Una vista del lienzo con su propio zoom y desplazamiento. Puede haber varios. |
| **Papel cebolla** | Mostrar imágenes anteriores/siguientes semitransparentes al editar una animación. |

## Supuestos e interpretaciones (validar con el autor)

1. **"Si se aplica un efecto a una capa, primero estampará todos los vectores"** se interpreta como un estampado **virtual en el render**: el efecto de capa se calcula sobre la composición *ráster base + formas*, pero las formas siguen siendo editables. Existe además el comando destructivo **Capa › Rasterizar efectos** que sí estampa las formas y aplica los efectos al ráster base de forma permanente.
2. Dentro de una capa, el orden de composición es: **ráster base (abajo) → formas en su orden z → efectos de capa**. Pintar con pincel siempre afecta al ráster base, que queda debajo de las formas de esa misma capa. Para pintar encima de una forma, el usuario usa una capa superior (la UI lo indica con un aviso discreto la primera vez).
3. Las imágenes de un documento **pueden tener tamaños distintos** (útil para juegos de iconos 16/32/48). En la vista de animación, las imágenes de tamaño distinto se centran en el lienzo de la imagen más grande.
4. "Light blow" se interpreta como **resplandor (glow)** exterior/interior, más un efecto de **iluminación direccional**.
5. Tamaño máximo de imagen: **2048×2048 px** (recomendado hasta 1024×1024). Ver `03-render-pipeline.md`.

## Fuera de alcance (v1)

- Edición de fotografías / pinceles de textura realistas.
- Capas de texto con fuentes TrueType (se contempla "texto pixel" con fuentes bitmap en una fase futura).
- Animación por interpolación (tweening) de formas — futura.
- Colaboración en tiempo real.
- macOS (la arquitectura no lo impide, pero no es objetivo de pruebas ni de empaquetado).
- Uso de iconos, logos o recursos de Adobe: la UI se **inspira** en Illustrator pero debe ser original.
