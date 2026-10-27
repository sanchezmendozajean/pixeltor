# design/ — salida de Claude Design

Referencia visual obligatoria para Pixeltor (ver `CLAUDE.md` y `specs/design/`). Contiene las 15 pantallas de `specs/design/23-pantallas.md`.

| Ruta | Qué es | Cómo usarlo |
|---|---|---|
| `tokens.css` | Variables CSS de los temas oscuro (por defecto), gris y claro, más espaciado, tipografía, radios y movimiento | Copiar a `src/renderer/styles/tokens.css`. El tema se elige con `<html data-theme="oscuro\|gris\|claro">` |
| `components.css` | Estilos de componentes y del shell de la ventana, con sus estados (`.pt-*` + modificadores `is-*`) | Base de los `<style>` de los componentes Vue; requiere `tokens.css` |
| `notas-de-diseno.md` | Decisiones, ajustes de tokens y desviaciones respecto a las specs | Leer antes de implementar la UI |
| `icons/herramientas-20/` | Iconos de herramientas, 20 px, trazo 1,5 | SVG con `currentColor` |
| `icons/paneles-16/`, `icons/interfaz-16/` | Iconos de paneles y de la interfaz, 16 px, trazo 1,25 | SVG con `currentColor` |
| `icons/icons.json` | Los mismos iconos como datos (`name`, `size`, `group`, `d` = trazo, `f` = relleno) | Para generar un componente `<PtIcon name="…">` |
| `pantallas/NN-*.dc.html` | Código fuente de cada pantalla (01–15) | Estructura, jerarquía, clases y textos. Ver la nota de formato |
| `pantallas/compartido/pt.css` | Tokens + componentes + shell usados por las pantallas 01, 02 y 04–15 | Igual que `tokens.css` + `components.css`, con los temas como clases (`.pt-oscuro`, `.pt-gris`, `.pt-claro`) |
| `pantallas/compartido/pt-data.js` | Iconos, contenido de ejemplo (caballero, tile de hierba, icono de app, cofre) y ayudantes | Fuente de los datos de ejemplo; útil como fixture de pruebas |

## Pantallas

| # | Archivo | Contenido |
|---|---|---|
| 01 | `01-inicio.dc.html` | Pantalla de inicio sin documentos |
| 02 | `02-nuevo-documento.dc.html` | Diálogo Nuevo documento |
| 03 | `03-ventana-principal.dc.html` | Ventana principal, workspace Esenciales, «Escudo» seleccionado con V |
| 04 | `04-seleccion-directa.dc.html` | Selección directa: anclas, tiradores y guía inteligente sobre «Espada» |
| 05 | `05-apariencia.dc.html` | Panel Apariencia (2 contornos, relleno con tramado Bayer, 2 efectos) y popover de degradado |
| 06 | `06-editor-efecto.dc.html` | Editor de efecto «Sombra paralela — Capa Cuerpo» con vista previa en vivo |
| 07 | `07-menu-efecto.dc.html` | Menú Efecto con el submenú «Sombras e iluminación» |
| 08 | `08-visores.dc.html` | Dos visores verticales; el derecho en modo mosaico 3×3 (`hierba.pixeltor`) |
| 09 | `09-animacion.dc.html` | Workspace Animación: panel expandido, papel cebolla y Vista previa |
| 10 | `10-exportar.dc.html` | Diálogo Exportar: hoja de sprites 8×1, escalas ×1 y ×4, JSON |
| 11 | `11-estampar.dc.html` | Diálogo de orden al estampar (regla de `specs/07`) |
| 12 | `12-preferencias.dc.html` | Preferencias › Interfaz |
| 13 | `13-componentes.dc.html` | Hoja de componentes en tema oscuro y claro, más el set de iconos |
| 14 | `14-tema-claro.dc.html` | Pantalla 03 importada con `tema="claro"` |
| 15 | `15-flyouts.dc.html` | Flyout de formas y menú contextual de una forma |

## Nota de formato de los `.dc.html`

Son archivos de Claude Design, no Vue:

- `{{ruta}}` es un hueco de datos.
- `<sc-for>` equivale a `v-for` y `<sc-if>` a `v-if`.
- `<dc-import name="…">` monta otra pantalla como componente hijo.
- La clase `Component` del final calcula los datos de ejemplo con `window.PT` (definido en `compartido/pt-data.js`).

Úsalos como referencia de estructura y estilo; no los copies tal cual. Las pantallas 03 y 13 llevan su propia copia de los estilos y de los datos dentro del archivo.

`pantallas/Pixeltor — Interfaz.html` es la exportación del lienzo de diseño de la ronda 1 (solo pantallas 03 y 13). Para tener las 15 en un solo HTML hay que volver a exportar el lienzo.
