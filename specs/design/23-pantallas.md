# 23 · Pantallas a diseñar

Resolución de referencia: **1440×900** (también comprobar 1920×1080 y 1280×720). Tema oscuro salvo indicación. Idioma de la UI: español.

**Contenido de ejemplo coherente para todas las pantallas** (usar siempre el mismo para que el conjunto se vea como un producto real):
- Documento `caballero.pixeltor`: sprite de un pequeño caballero de 32×32 px, 8 imágenes (animación de caminar), capas: *Luz* (con efecto Iluminación direccional), *Contorno* (efecto Contorno de píxel), *Cuerpo* (ráster + 2 formas: "Escudo" elipse, "Espada" trazado), *Sombra* (forma elipse con desenfoque 1 px y umbral), *Fondo* (oculta).
- Paleta del documento: Endesga 32 o una de 16 colores propia.
- Segundo documento en pestaña: `icono-app.pixeltor` (iconos 16/32/48).

> El pixel art de ejemplo debe ser **original** (un caballero genérico creado para la maqueta), no un personaje conocido.

## Lista

| # | Pantalla | Qué debe mostrar |
|---|---|---|
| 1 | **Inicio** | Sin documentos abiertos: logo, botones "Nuevo" y "Abrir", plantillas (Icono 16/32/48/256, Sprite 32×32, Tile 16×16, Personaje 64×64, Personalizado), lista de recientes con miniaturas pixeladas, enlace a novedades. |
| 2 | **Diálogo Nuevo documento** | Presets a la izquierda (categorías: Iconos, Sprites, Tiles, Personalizado), ancho/alto con candado, nº de imágenes inicial, duración por defecto (ms), fondo (transparente/color), paleta inicial, vista previa del tamaño a escala. |
| 3 | **Ventana principal — Esenciales** | El caballero al 1200 % con la forma "Escudo" **seleccionada** con V (caja delimitadora, anclas, trazado en color de capa), panel Propiedades mostrando la forma, panel Capas con *Cuerpo* expandido mostrando sus formas, tira de imágenes colapsada, barra de estado con coordenadas y color bajo el cursor. |
| 4 | **Selección directa y pluma** | Detalle del trazado "Espada" con anclas seleccionadas, tiradores visibles, guía inteligente magenta con etiqueta "ancla" y medida, barra de control en modo ancla. |
| 5 | **Panel Apariencia en detalle** | Forma con **2 contornos** (exterior 1 px oscuro + centro 1 px degradado) y **relleno degradado lineal con tramado Bayer 4×4**, más 2 efectos (Sombra paralela, Resplandor exterior); popover del degradado abierto con la GradientBar y la vista previa del modo de píxel. |
| 6 | **Editor de efecto** | Popover "Sombra paralela — Capa Cuerpo" con dx/dy, color, opacidad, desenfoque, spread y sección Salida (alfa: umbral 128); el lienzo muestra la sombra en vivo. |
| 7 | **Menú Efecto abierto** | Menú desplegado con categorías (Sombras e iluminación, Contornos, Desenfoque, Distorsión, Color) y submenú abierto. |
| 8 | **Visores divididos** | Dos visores verticales: izquierdo al 1200 % con trazados y cuadrícula de píxeles; derecho al 300 % en **modo mosaico** 3×3 con un tile de hierba 16×16 (segundo ejemplo), cabeceras de visor visibles, visor activo con borde de acento. |
| 9 | **Workspace Animación** | Panel Animación expandido con las 8 imágenes del caballero, duraciones (100, 100, 150, 100…), controles de transporte, papel cebolla activo en el visor (imagen anterior en rojo, siguiente en azul), panel Vista previa reproduciendo a 4×. |
| 10 | **Diálogo Exportar** | Vista previa grande a la izquierda (hoja de sprites 8×1 con padding), a la derecha: formato (PNG, Secuencia, Hoja de sprites, GIF, APNG, ICO), escalas ×1 y ×4 marcadas, plantilla de nombre, opciones del JSON de metadatos, botón Exportar. |
| 11 | **Diálogo "Estampar"** | Aviso de orden de formas con las 3 opciones (ver `07`). |
| 12 | **Preferencias** | Navegación lateral por secciones, sección Interfaz visible (tema, escala, cabecera de visor). |
| 13 | **Hoja de componentes** | Todos los componentes de `22-componentes-ui.md` con sus estados, en tema oscuro y claro. |
| 14 | **Ventana principal — Tema claro** | La pantalla 3 en tema Claro. |
| 15 | **Flyouts y menús contextuales** | Flyout de herramientas de forma (Rectángulo, Elipse, Polígono, Estrella, Línea) y menú contextual de una forma (Estampar, Convertir en trazado, Organizar, Agrupar, Mover a capa…). |

## Entregables esperados de Claude Design

1. Las pantallas anteriores como **prototipo HTML/CSS** navegable (o imágenes), exportables.
2. Archivo de **tokens** (CSS variables) coherente con `21-design-tokens.md`, con cualquier ajuste documentado.
3. **Set de iconos** de herramientas y paneles en SVG (16 y 20 px).
4. Notas de diseño: decisiones tomadas y desviaciones respecto a estas specs.

Todo se guardará en `C:\Coding\pixeltor\design\` para que Claude Code lo use como referencia visual.
