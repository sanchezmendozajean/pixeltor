# 05 · Formas y edición vectorial

## Visualización de formas en el lienzo

Una forma **siempre** se ve como su resultado pixelado. Su trazado vectorial (línea fina de 1 px de pantalla, con antialiasing) aparece:

| Estado | Qué se muestra |
|---|---|
| Normal | Nada (solo píxeles) |
| **Hover** (cursor encima, herramienta V/A/P) | Trazado en el color de la capa, 1 px |
| **Seleccionada** (V) | Trazado + anclas sin rellenar + caja delimitadora con 8 tiradores + punto central |
| **Selección directa** (A) | Trazado + anclas (rellenas = seleccionadas, huecas = no) + tiradores de las anclas seleccionadas y adyacentes |
| **Dibujándose** | Trazado + vista previa pixelada en vivo |

- El color de los trazados es el **color de la capa** (azul, rojo, verde, magenta, cian, naranja… asignado en rotación al crear la capa; editable).
- `Ctrl+H` oculta todos los overlays para juzgar solo los píxeles.
- Opción en Preferencias: "Mostrar contorno de píxeles de la forma seleccionada" (una silueta de los píxeles que ocupa).

## Creación

- **Rectángulo** (`M`): arrastrar. Clic sin arrastrar abre diálogo de ancho/alto. Esquinas redondeadas con los **widgets de radio** (círculos internos arrastrables, como Illustrator) o desde el panel Propiedades (cada esquina independiente con candado de enlace).
- **Elipse** (`L`), **Polígono**, **Estrella**: igual; polígono/estrella cambian número de lados/puntas con flechas ↑/↓ durante el arrastre.
- **Línea** (`\`): arrastrar; `Shift` limita a 0°/45°/90° y también a **ángulos de pixel art** (1:1, 1:2, 2:1, 1:3, 3:1) cuando la opción "Ángulos de pixel art" está activa.
- **Pluma** (`P`): clic = ancla de esquina; clic+arrastre = ancla suave con tiradores simétricos; `Alt` durante el arrastre rompe la simetría; clic en la primera ancla cierra; `Enter`/`Esc` termina un trazado abierto; clic sobre un segmento añade ancla, sobre un ancla la elimina (comportamiento automático de Illustrator, desactivable).
- **Lápiz vectorial**: trazo libre simplificado (Ramer–Douglas–Peucker + ajuste de Bézier, fidelidad configurable).

Las nuevas formas toman la **apariencia actual** (relleno/contorno de la barra de herramientas). La opción "Nuevas formas tienen apariencia básica" lo replica de Illustrator.

## Edición

### Herramienta Selección (V)
- Clic selecciona, `Shift+clic` añade/quita, arrastre en vacío = selección por marco (toca la forma).
- Arrastrar mueve; `Alt+arrastrar` duplica; `Shift` limita a ejes.
- Tiradores de la caja: escalar (`Shift` proporcional, `Alt` desde el centro); cerca de una esquina por fuera: **rotar** (`Shift` = pasos de 15°; con "Ángulos de pixel art" activo, también 90° exactos).
- Doble clic en un grupo = **modo aislamiento** (como Illustrator): el resto se atenúa; `Esc` sale.
- Las transformaciones se guardan en `transform`; las formas paramétricas mantienen sus parámetros (un rectángulo rotado sigue siendo rectángulo).

### Herramienta Selección directa (A)
- Seleccionar anclas por clic o marco; mover anclas y tiradores; `Shift` limita.
- Convertir ancla (`Shift+C`): clic = esquina, arrastrar = suave.
- **Widgets en vivo**: radios de esquina por ancla en trazados (redondear vértices) [F3].
- Barra de control en modo A: convertir esquina/suave, cortar trazado en ancla, unir dos anclas finales (`Ctrl+J` con dos extremos seleccionados), alinear anclas.
- Editar un ancla de una forma paramétrica la convierte a trazado (con aviso en la barra de estado, deshacible).

### Teclado
- Flechas mueven 1 px (o la cantidad de "Incremento de teclado" en Preferencias); `Shift` ×10.
- `Supr` elimina formas o anclas seleccionadas.

## Ajuste (snapping) y guías inteligentes

Ajustar a (cada uno conmutable en menú **Ver › Ajustar a** y en la barra de estado):
- **Rejilla de píxeles** (entero o medio píxel; ver `snapToPixel`).
- **Anclas y puntos centrales** de otras formas.
- **Trazados** (punto más cercano sobre segmentos).
- **Guías** y **rejilla de tiles**.
- **Bordes y centro del lienzo**.

**Guías inteligentes** (`Ctrl+U`): líneas magenta temporales con etiquetas ("ancla", "trazado", "centro", "intersección", ángulos 0/45/90) y **medidas** de distancia/tamaño iguales (como Illustrator). Radio de enganche: 4 px de pantalla.

## Alineación y distribución (panel Alinear)

- Alinear: izquierda, centro H, derecha, arriba, centro V, abajo.
- Distribuir objetos (por bordes o centros) y **distribuir espaciado** con un valor en px.
- Alinear a: **selección**, **objeto clave** (clic en un objeto ya seleccionado lo marca con borde grueso, como Illustrator), **lienzo**.
- Funciona con formas (V) y con anclas (A).
- La alineación usa los **límites de píxeles visibles** (opción por defecto) o los límites geométricos (opción "Usar límites geométricos").

## Panel Apariencia

Réplica conceptual del panel Apariencia de Illustrator:

```
▾ Rectángulo 3
   Contorno   ■ 2 px  Exterior          👁
   Contorno   ▤ 1 px  Centro  (degradado) 👁
   Relleno    ▤ Degradado lineal · tramado Bayer 4  👁
   Opacidad   100 %
   fx Sombra paralela                    👁
   fx Resplandor exterior                👁
 [+Contorno] [+Relleno] [fx] [⊘ borrar] [⧉ duplicar] [🗑]
```

- Cada fila se puede **reordenar arrastrando** (cambia `appearance.stack`), ocultar, duplicar, eliminar.
- Clic en el muestrario de color de una fila abre el selector de color / muestras / degradado en línea.
- Clic en el nombre de un efecto abre su editor (ver `06-efectos.md`).
- Con varias formas seleccionadas con apariencias distintas, muestra "Apariencia mixta" y permite reemplazar la apariencia de todas.
- **Estilos gráficos** [F7]: guardar una apariencia+efectos como estilo reutilizable en el documento.

## Operaciones de objeto (menú Objeto)

| Comando | Fase |
|---|---|
| Agrupar / Desagrupar | F2 |
| Organizar (traer/enviar) | F2 |
| Mover a capa… / Mover a capa superior/inferior | F2 |
| Convertir en trazado (formas paramétricas) | F2 |
| Contorno de trazo (convierte el contorno en forma rellena) | F3 |
| Desplazamiento de trazado (offset path) | F3 |
| Simplificar trazado | F3 |
| **Buscatrazos**: Unir, Restar frente, Intersectar, Excluir, Dividir | F7 |
| Trazado compuesto: Crear / Liberar | F3 |
| Reflejar, Rotar 90°, Transformar numéricamente | F2 |
| **Estampar** (`Ctrl+E`) | F2 |
| Vectorizar píxeles (selección de píxeles → trazados) | futuro |
