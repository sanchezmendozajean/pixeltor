# 04 · Herramientas

Las herramientas se muestran en la **Barra de herramientas** (izquierda) agrupadas en **flyouts** (botón con triángulo pequeño en la esquina; mantener pulsado o clic derecho despliega las variantes, como Illustrator). Cada herramienta tiene opciones en la **Barra de control** superior.

## Tabla de herramientas

| Grupo | Herramienta | Atajo | Actúa sobre |
|---|---|---|---|
| Selección | **Selección** (mover/escalar/rotar formas y capas) | `V` | formas |
| | **Selección directa** (anclas y tiradores) | `A` | anclas |
| | Selección de grupo | — | formas en grupos |
| Selección de píxeles | **Marco rectangular** | `S` | ráster |
| | Marco elíptico | `Shift+S` (ciclo) | ráster |
| | **Lazo** / Lazo poligonal | `Q` | ráster |
| | **Varita mágica** (tolerancia, contigua, muestrear todas las capas) | `W` | ráster |
| Pintura | **Lápiz** (1 px duro, pixel-perfect) | `N` | ráster |
| | **Pincel** (tamaño, forma cuadrada/redonda, opacidad, tramado) | `B` | ráster |
| | **Borrador** | `E` | ráster |
| | **Bote de pintura** (tolerancia, contiguo, muestrear todas) | `K` | ráster |
| | Reemplazar color (cambia todos los píxeles de un color) | `Shift+K` | ráster |
| | Sombreado (aclara/oscurece desplazándose en la rampa de la paleta) | `Shift+B` | ráster |
| Vectores | **Pluma** | `P` | trazados |
| | Añadir ancla | `+` | trazados |
| | Eliminar ancla | `-` | trazados |
| | Convertir ancla | `Shift+C` | trazados |
| | **Línea** | `\` | formas |
| | **Rectángulo** (y redondeado) | `M` | formas |
| | **Elipse** | `L` | formas |
| | Polígono | — (flyout) | formas |
| | Estrella | — (flyout) | formas |
| | Lápiz vectorial (trazo a mano alzada simplificado) | `Shift+N` | formas |
| Color | **Cuentagotas** (muestra capa actual o composición) | `I` | color |
| | **Degradado** (editar degradado en el lienzo) | `G` | relleno/contorno |
| Navegación | **Mano** | `H` (o `Espacio` mantenido) | visor |
| | **Zoom** | `Z` (Ctrl+Espacio / Alt para alejar) | visor |
| | Rotar vista [F7] | `R` | visor |

Controles fijos en la parte inferior de la barra: **color de relleno / color de contorno** (cuadros superpuestos como en Illustrator; `X` intercambia el activo, `Shift+X` intercambia colores, `D` por defecto), botones *Ninguno*, *Color*, *Degradado*. En herramientas de pintura, el relleno actúa como **color primario** y el contorno como **secundario** (clic derecho pinta con secundario).

## Comportamiento general

- **Capa activa**: las herramientas de pintura actúan sobre su ráster base; las de forma crean la forma en la capa activa (arriba de las demás formas). Si la capa está bloqueada u oculta, el cursor muestra "prohibido" y la barra de estado explica el motivo.
- **Bloquear transparencia** de capa: pincel/lápiz/bote solo modifican píxeles con alfa > 0.
- **Simetría** [F3]: botones en la barra de control del pincel/lápiz: espejo horizontal, vertical o ambos, con eje ajustable arrastrando una guía.
- **Modificadores al dibujar formas**: `Shift` = proporcional (cuadrado, círculo, ángulos de 15° para líneas); `Alt` = desde el centro; `Espacio` durante el arrastre = mover la forma en construcción.
- **Línea recta con lápiz/pincel**: clic, luego `Shift+clic` traza una línea pixel-perfect desde el último punto.
- **Cuentagotas temporal**: `Alt` mantenido con lápiz/pincel/bote.
- **Tamaño de pincel**: `[` y `]`.
- **Cursores**: en zoom alto, el cursor de pincel muestra el contorno exacto en píxeles de la punta.

## Selección de píxeles

- Modos: nueva, añadir (`Shift`), restar (`Alt`), intersección (`Shift+Alt`).
- Hormigas en marcha (marching ants) alineadas a la rejilla de píxeles.
- Mover la selección con la herramienta Selección (`V`) o con `Ctrl` mantenido crea **píxeles flotantes**; se fijan al hacer clic fuera, pulsar `Enter` o cambiar de herramienta. `Esc` cancela.
- Operaciones: Copiar, Cortar, Pegar (como píxeles flotantes en la capa activa), Pegar en nueva capa, Rellenar con color (`Alt+Supr`), Borrar (`Supr`), Voltear H/V, Rotar 90°/180°, Escalar con vecino más cercano (`Ctrl+T`), Recortar imagen a la selección.
- `Ctrl+A` seleccionar todo, `Ctrl+D` deseleccionar, `Ctrl+Shift+I` invertir.
- `Ctrl+clic` en la miniatura de una capa: selección a partir de su alfa (incluye formas y efectos renderizados).

## Comandos y atajos generales

| Comando | Atajo |
|---|---|
| Nuevo / Abrir / Guardar / Guardar como | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| Exportar como… / Exportar de nuevo | `Ctrl+Alt+S` / `Ctrl+Alt+Shift+S` |
| Deshacer / Rehacer | `Ctrl+Z` / `Ctrl+Shift+Z` (y `Ctrl+Y` en Windows) |
| Duplicar | `Ctrl+J` (capa) · `Alt+arrastrar` (forma) |
| Agrupar / Desagrupar formas | `Ctrl+G` / `Ctrl+Shift+G` |
| Traer adelante / al frente | `Ctrl+]` / `Ctrl+Shift+]` |
| Enviar atrás / al fondo | `Ctrl+[` / `Ctrl+Shift+[` |
| **Estampar formas seleccionadas** | `Ctrl+E` |
| Estampar todas las formas de la capa | `Ctrl+Shift+E` |
| Rasterizar efectos de capa | `Ctrl+Alt+E` |
| Nueva capa | `Ctrl+Shift+N` |
| Nueva imagen (frame) | `Ctrl+Alt+N` |
| Imagen anterior / siguiente | `,` / `.` |
| Reproducir/pausar animación | `Enter` en panel Animación · `Ctrl+Enter` global |
| Papel cebolla | `O` (alternar) |
| Mostrar/ocultar cuadrícula de píxeles | `Ctrl+'` |
| Mostrar/ocultar guías | `Ctrl+;` |
| Guías inteligentes | `Ctrl+U` |
| Ajustar a píxel | `Ctrl+Alt+'` |
| Ocultar trazados (ver solo píxeles) | `Ctrl+H` |
| Modo vista previa (sin overlays) | `Ctrl+Shift+Y` |
| Zoom 100 % / Encajar / Acercar / Alejar | `Ctrl+1` / `Ctrl+0` / `Ctrl++` / `Ctrl+-` |
| Dividir visor vertical / horizontal | `Ctrl+Alt+V` / `Ctrl+Alt+H` |
| Ocultar paneles | `Tab` (todos) / `Shift+Tab` (menos herramientas) |
| Desplazar selección 1 px / 10 px | flechas / `Shift+flechas` |

**Nota**: Exportar usa `Ctrl+Alt+S` para no chocar con Estampar (`Ctrl+E`). Todos los atajos DEBEN poder personalizarse en Preferencias › Atajos [F7] y DEBEN definirse en un único registro (`commands registry`) usado por menús, tooltips y paleta de comandos.

## Paleta de comandos

`Ctrl+K` abre una paleta de búsqueda de comandos (con atajo visible) [F3].
