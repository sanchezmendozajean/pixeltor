# 03 · Pipeline de render

## Objetivo

Lo que se ve en el lienzo = lo que se exporta, bit a bit. El render es **determinista**: misma entrada → mismos bytes en Windows y Linux. Por eso la rasterización y la composición se hacen en **CPU** con TypedArrays; WebGL2 solo muestra el resultado ampliado.

## Sistema de coordenadas

- El píxel `(x, y)` cubre el cuadrado `[x, x+1) × [y, y+1)`. Su centro es `(x+0.5, y+0.5)`.
- Una coordenada vectorial entera cae en la **esquina** entre píxeles; una coordenada `.5` cae en el **centro** de un píxel.
- `snapToPixel = 'integer'` (por defecto para rellenos) y `'half'` (por defecto para líneas de 1 px de ancho impar) se aplican al dibujar/editar formas.

## Rasterización de formas (sin suavizado)

1. **Aplanar** (flatten) curvas Bézier a polilíneas con tolerancia 0,1 px (subdivisión adaptativa).
2. **Relleno**: escaneo por líneas (scanline) con muestreo en el **centro del píxel**; un píxel se pinta si su centro está dentro según la regla `nonzero` o `evenodd`. Resultado: máscara de cobertura binaria (0/255).
3. **Contorno**:
   - Ancho 1 px + `align: center`: algoritmo tipo Bresenham sobre la polilínea, con **pixel-perfect** opcional (eliminar el píxel que forma una "L" en diagonales, como Aseprite).
   - Ancho > 1 o alineación inside/outside: generar el **polígono de contorno** (offset con uniones y remates) y rellenarlo con la misma regla de centro de píxel. `inside` = intersección con el relleno; `outside` = contorno menos relleno.
   - `offset` (contornos múltiples): el contorno n se genera sobre el trazado desplazado `offset` px, permitiendo apilar varios contornos concéntricos.
4. **Elipses paramétricas** sin rotación (o con rotación múltiplo de 90°) DEBEN usar el **algoritmo de punto medio** para obtener círculos de pixel art limpios y simétricos. Con rotación arbitraria, se usa el camino genérico.
5. **Rectángulos** alineados a ejes con coordenadas enteras se rellenan directamente (rápido).
6. **Pintura** (relleno/contorno): la máscara se combina con el `Paint`:
   - Sólido: color directo.
   - Degradado: se evalúa el degradado en el centro de cada píxel y se aplica el `pixelMode` (suave, bandas, tramado Bayer, cuantización a paleta). Ver `12-color-y-paletas.md`.
7. **Suavizado opcional** (`antialias: true`): cobertura por superposición 4×4 por píxel. Desactivado por defecto.

El resultado de una forma es un **ShapeBitmap**: RGBA recortado a su bounding box (+ margen requerido por efectos).

## Composición

```
para cada capa visible (de abajo arriba):
    capa_rgba = copia(ráster base)
    para cada forma visible (de abajo arriba):
        forma_rgba = render_apariencia(forma)          # rellenos/contornos según stack
        forma_rgba = aplicar_efectos(forma.efectos, forma_rgba)
        componer(capa_rgba, forma_rgba, forma.blend, forma.opacity)
    capa_rgba = aplicar_efectos(capa.efectos, capa_rgba)  # "estampado virtual" de formas
    componer(imagen_rgba, capa_rgba, capa.blend, capa.opacity)
```

- Aritmética de composición con **alfa premultiplicado** en `Float32` o en enteros de 16 bits; el almacenamiento es RGBA8 no premultiplicado.
- Los modos de fusión siguen las fórmulas de la especificación W3C *Compositing and Blending Level 1*.
- El área de dibujo de un efecto puede salirse del bounding box de la forma (sombras, resplandor) pero se **recorta al lienzo de la imagen**.

## Cachés e invalidación

| Caché | Clave | Se invalida cuando |
|---|---|---|
| `ShapeBitmap` (apariencia) | hash(geometría, transform, apariencia) | cambia la forma |
| `ShapeEffected` | hash(ShapeBitmap, efectos de la forma) | cambia la forma o sus efectos |
| `LayerComposite` | versión de ráster + versiones de formas + efectos de capa | cualquier hijo cambia |
| `ImageComposite` | versiones de capas visibles | cualquier capa cambia |
| `Thumbnail` | versión de ImageComposite | con retraso (debounce 300 ms) |

- Cada nodo lleva un contador `version` que se incrementa en cada cambio (más barato que hashear buffers).
- **Regiones sucias**: pintar con pincel invalida solo el rectángulo afectado; la recomposición de capa e imagen se hace solo en esa región **si la capa no tiene efectos de capa**. Si los tiene, se recalcula el efecto en la región expandida por su radio de influencia (blur radius, offset de sombra, etc.).
- Las cachés tienen límite de memoria (por defecto 512 MB) con desalojo LRU.

## Workers

- Pool de `navigator.hardwareConcurrency - 1` workers (mínimo 1, máximo 4).
- Se envían al worker: efectos costosos (desenfoques, distorsiones, iluminación) y composición completa de imágenes > 256×256.
- Transferencia con `ArrayBuffer` transferibles; nunca copiar buffers grandes por estructura.
- Mientras un efecto se recalcula, el visor muestra el último resultado válido (sin parpadeo) y un indicador sutil de "calculando" en la barra de estado.

## Visualización (WebGL2)

- La `ImageComposite` se sube como textura `RGBA8` con filtro `NEAREST`.
- Cada visor dibuja: fondo de trabajo → sombra del lienzo → tablero de ajedrez (transparencia, en píxeles de pantalla) → textura de imagen → papel cebolla (si aplica) → cuadrícula de píxeles (si zoom ≥ `pixelGridMinZoom`) → cuadrícula de tiles → guías → overlay vectorial.
- El **overlay vectorial** (trazados, anclas, tiradores, cajas de selección, guías inteligentes) se dibuja en espacio de pantalla con Canvas2D o WebGL, con antialiasing (es UI, no imagen).
- Zoom: niveles preferentes 100 %, 200 %, 300 %, 400 %, 600 %, 800 %, 1200 %, 1600 %, 2400 %, 3200 %, 4800 %, 6400 %; también 50 %, 25 % para imágenes grandes. Zoom con rueda centrado en el cursor. Con zoom ≥ 100 % el desplazamiento se ajusta a píxeles enteros de pantalla para evitar artefactos.

## Límites de tamaño y rendimiento

| Parámetro | Valor |
|---|---|
| Tamaño mínimo de imagen | 1×1 |
| Recomendado | hasta 1024×1024 |
| **Máximo** | **2048×2048** (16 MB por capa RGBA) |
| Máx. capas por imagen | 256 |
| Máx. formas por capa | 2 000 |
| Máx. imágenes por documento | 1 000 |

Opción avanzada en Preferencias para elevar el máximo a 4096×4096 (marcada como experimental).

Objetivos medidos en un equipo de referencia (CPU de 4 núcleos, 8 GB RAM, GPU integrada):

| Escenario | Objetivo |
|---|---|
| Trazo de pincel en 1000×1000, 20 capas sin efectos | 60 fps, latencia < 16 ms |
| Arrastrar un ancla de una forma con 2 contornos y degradado en 1000×1000 | ≥ 30 fps |
| Cambiar radio de desenfoque de capa 1000×1000 (scrubbing) | primer resultado < 150 ms |
| Recomposición completa 1000×1000, 20 capas, 5 efectos | < 300 ms (en worker) |
| Abrir documento de 50 imágenes 64×64 | < 1 s |
| Cualquier operación en 64×64 | < 8 ms |

Las pruebas de rendimiento DEBEN existir como benchmarks en `tests/core/bench` (Vitest bench).
