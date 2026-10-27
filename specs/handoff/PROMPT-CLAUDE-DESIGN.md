# Traspaso a Claude Design

## Archivos a adjuntar

Adjunta estos archivos de `specs/` en la conversación de Claude Design:

1. `design/20-entorno-visual.md`  ← el más importante
2. `design/21-design-tokens.md`
3. `design/22-componentes-ui.md`
4. `design/23-pantallas.md`
5. `00-vision.md` (contexto del producto)
6. `05-formas-y-vectores.md` (panel Apariencia y overlays vectoriales)
7. `08-animacion.md` y `09-visores.md` (paneles de animación y visores)

## Prompt (copiar y pegar)

```
Quiero que diseñes la interfaz de Pixeltor, una aplicación de escritorio (Electron, Windows y Linux)
para editar pixel art — iconos, sprites, tiles y animaciones cortas — cuyas capas son "inteligentes":
además de píxeles pintados, contienen formas vectoriales que siempre se ven pixeladas y efectos no
destructivos (sombras, resplandor, desenfoque, distorsión).

Te adjunto las especificaciones. Léelas completas antes de empezar; los archivos de design/ mandan
sobre el aspecto visual, y 00-vision, 05, 08 y 09 explican qué hace cada panel.

Dirección visual: profesional, pulida y elegante, muy cercana a la ergonomía de Adobe Illustrator
(tema oscuro neutro, UI densa, barra de control contextual, flyouts de herramientas, panel Apariencia,
dock de paneles colapsable a iconos). Debe ser ORIGINAL: no uses iconos, logos ni marcas de Adobe.

Entregables:
1. Las 15 pantallas de 23-pantallas.md como prototipo HTML/CSS a 1440×900, en español, usando el
   contenido de ejemplo indicado (el caballero 32×32 original, 8 imágenes de animación).
   Empieza por la pantalla 3 (ventana principal) y la 13 (hoja de componentes); cuando las apruebe,
   continúa con el resto.
2. tokens.css con las variables de 21-design-tokens.md para los temas oscuro, gris medio y claro.
   Si ajustas valores, documenta por qué.
3. Set de iconos SVG propios (herramientas a 20 px, paneles a 16 px), trazo lineal.
4. Un documento breve de notas de diseño con decisiones y desviaciones.

Cuida especialmente: el lienzo con pixel art nítido (sin suavizado), los overlays vectoriales
(anclas, tiradores, caja de selección en el color de la capa, guías inteligentes magenta),
el panel Capas con formas anidadas dentro de cada capa, el panel Apariencia con varios contornos
y un degradado con tramado, y la barra de estado.

El resultado lo usará Claude Code para construir la app con Vue 3, así que prefiere estructuras
de componentes claras y CSS basado en variables.
```

## Después

Exporta lo que produzca Claude Design a `C:\Coding\pixeltor\design\`:

```
design/
├─ screens/        ← HTML o PNG de cada pantalla (01-inicio, 03-principal, …)
├─ tokens.css
├─ icons/          ← SVG
└─ NOTAS.md        ← decisiones y desviaciones
```
