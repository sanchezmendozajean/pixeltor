# 09 · Visores divididos

## Concepto

Como en Blender, el área de trabajo de un documento puede dividirse en **varios visores**. Cada visor es una vista independiente del mismo documento con **todas las capacidades de edición**: se puede pintar, dibujar formas o editar anclas en cualquiera, y el resultado aparece en todos al instante.

Caso típico: un visor al 1200 % para editar píxeles y otro al 100 %/200 % para ver el resultado real.

## Disposición

- División **vertical** (`Ctrl+Alt+V`) u **horizontal** (`Ctrl+Alt+H`) del visor activo; divisiones anidadas (árbol binario), hasta **4 visores** por documento.
- Separadores arrastrables (4 px, con hover visible); doble clic en un separador iguala tamaños.
- Unir: botón ✕ en la cabecera del visor o arrastrar el separador hasta colapsar.
- Presets en **Ventana › Disposición de visores**: Único, 2 verticales, 2 horizontales, 1 grande + 2 pequeños, 2×2.
- La disposición se guarda en el documento (opcional) y en el workspace.

## Cabecera del visor

Barra fina (24 px) en la parte superior de cada visor, visible al pasar el cursor o fija (preferencia):

```
[Imagen: ▾ Sigue la activa | Caminar_03]  [zoom 800% ▾]  [⊞ píxeles] [▦ tiles] [◇ trazados] [◐ cebolla] [⧉ mosaico] [▶] [✕]
```

| Control | Función |
|---|---|
| **Imagen** | *Sigue la activa* (por defecto) o **fijar** a una imagen concreta (p. ej. ver la imagen 1 mientras se edita la 5). Editar en un visor fijado hace activa esa imagen. |
| **Zoom** | Independiente por visor. |
| **Cuadrícula de píxeles / tiles** | Independiente por visor. |
| **Trazados** | Mostrar u ocultar overlays vectoriales en este visor (p. ej. ocultos en el visor de vista previa). |
| **Papel cebolla** | Independiente por visor. |
| **Modo mosaico** (`tiled`) | Repite la imagen 3×3 (o solo H / solo V) para comprobar tiles continuos; se puede editar en cualquier copia. |
| **Reproducir** | Reproduce la animación solo en este visor. |
| **Sincronizar** (menú ⋯) | Sincronizar desplazamiento/zoom con otro visor (relativo). |

## Visor activo

- El visor bajo el cursor recibe la rueda y los atajos de navegación; el **último visor clicado** es el activo (borde de acento de 1 px).
- Navegador (panel) refleja el visor activo.
- Las herramientas y la selección son **globales al documento**: una selección hecha en un visor se ve en todos; un trazo de pincel iniciado en un visor se dibuja en vivo en todos.

## Implementación

- `Viewport` es una clase con su estado (`zoom`, `pan`, `imageBinding`, flags de overlays) y una referencia compartida a la textura de la imagen compuesta (una textura por imagen, compartida entre visores).
- Un único contexto WebGL2 por ventana con *scissor/viewport* por visor, o un canvas por visor compartiendo recursos mediante un contexto común — elegir la opción con menos copias; recomendado: **un canvas grande para todo el área de trabajo** con scissor por visor, y un canvas overlay 2D encima.
- La herramienta activa recibe eventos ya convertidos a **coordenadas de imagen** por el visor que los origina.
- Esta abstracción DEBE existir desde F1 (aunque la UI de división llegue en F6).
