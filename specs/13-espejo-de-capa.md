# 13 · Espejo de capa

Modificador de capa que **refleja los píxeles** que se dibujan respecto a uno o dos ejes de referencia. No duplica formas: el vector se queda de un lado con sus píxeles y del otro lado sólo se ven píxeles.

## Modelo

```ts
type MirrorType = 'v' | 'h' | 'vh' | 'd45' | 'd135' | 'd45-135'

interface LayerMirror {
  type: MirrorType
  enabled: boolean   // se conserva la configuración aunque esté desactivado
  x: number          // eje vertical: borde entre los píxeles x-1 y x; diagonales: píxel pivote
  y: number          // eje horizontal: borde entre los píxeles y-1 e y; diagonales: píxel pivote
}

interface Layer { /* … */ mirror?: LayerMirror }   // opcional; las capas de grupo no lo usan
```

| Tipo | Ejes |
|---|---|
| `v` | un eje vertical |
| `h` | un eje horizontal |
| `vh` | vertical + horizontal (tres reflejos) |
| `d45` | diagonal ascendente («/») por el centro del píxel `(x, y)` |
| `d135` | diagonal descendente («\») por el centro del píxel `(x, y)` |
| `d45-135` | las dos diagonales (tres reflejos) |

Por defecto los ejes quedan en el centro de la imagen (`floor(ancho/2)`, `floor(alto/2)`). Los ejes vertical/horizontal están **siempre entre dos píxeles**; las diagonales atraviesan los píxeles. Todas las reflexiones son exactas (aritmética entera, sin remuestreo).

## Render

El espejo es un paso del render de la capa: `ráster + formas` → **espejo** → efectos de capa → opacidad/modo. Donde el original y un reflejo coinciden, el original queda por encima. Los píxeles reflejados que caen fuera del lienzo se descartan.

- No modifica el ráster ni las formas (regla 5 de CLAUDE.md). Estampar/rasterizar formas no cambia el render.
- «Rasterizar efectos de capa» con el espejo activo estampa también el espejo y lo retira (ya está en el ráster), para que el render no cambie. Combinar capas también lo retira.
- Para recomponer una región se amplía con la de sus reflejos (`mirrorClosure`), tanto en el visor como en `composeImage`.

## Interfaz

- Panel Capas: botón **Espejo** (donde estaba Duplicar capa; Duplicar pasó al pie, junto a Nueva y Eliminar) con un menú de los 6 tipos y «Sin espejo». También en Capa › Espejo.
- Con espejo configurado, la fila de la capa muestra un icono (antes del candado) que lo activa/desactiva.
- Ver › **Ver líneas espejo**: ejes de la capa activa en naranja (`--mirror-line`), punteados con zoom ≥ 4; con menos zoom, una marca corta fuera del lienzo. Se ocultan en el modo vista previa.
- Con la herramienta Selección (V) los ejes se arrastran (un solo paso de historial). Vertical/horizontal se mueven por bordes de píxel; las diagonales mueven su pivote.
