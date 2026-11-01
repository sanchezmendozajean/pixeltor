# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Cada fase del roadmap (`specs/30-roadmap.md`) cierra con una entrada.

## [Sin publicar] — F4 · Efectos no destructivos (en curso)

### Añadido

- **Motor de efectos** (`src/core/effects`): registro con esquema de parámetros (rangos y valores por defecto), radio de influencia, cadena de aplicación que solo calcula lo necesario por etapa y sección **Salida** (umbral/tramado del alfa y ajuste a paleta). Efectos en **formas y capas** que se componen en vivo sin tocar el ráster base (prueba de invariante) y regiones sucias ampliadas por el radio de influencia (prueba: componer por cuadrantes = componer todo).
- **23 efectos**: sombra paralela, interior y larga; resplandor exterior e interior; iluminación direccional y bisel (sombreado automático por mapa de alturas, con escalones); contorno de píxel (4/8 conexiones, exterior/interior); desenfoque gaussiano, de caja y de movimiento; onda, ondulación, torsión, desplazamiento (con envoltura) y mosaico; tono/saturación/luminosidad, brillo/contraste, mapa de degradado, reemplazar colores, posterizar, invertir y superposición de color.
- **Pool de workers** (hasta 4, `hardwareConcurrency − 1`) para los efectos del visor: lo que el cálculo puede leer viaja al worker, solo se procesa la petición más reciente de cada capa/forma y, mientras llega el resultado, se muestra el último válido (sin parpadeo) con «Calculando efectos…» en la barra de estado. Las áreas pequeñas (pinceladas) se calculan en línea. Exportar y estampar siguen siendo síncronos y deterministas. Corrige que la salida «ajustar a paleta» no recibía las paletas del documento.
- **Presets de efectos** (guardar la pila actual con un nombre y aplicarla como un solo paso) e indicador **fx** en las filas de capas y formas.
- **Rasterizar efectos de capa** (`Ctrl+Alt+E`): estampa las formas, aplica los efectos de la capa y los vacía sin cambiar el render. Estampar una forma conserva sus efectos.
- **Golden por efecto** (huella FNV de cada efecto sobre una imagen fija) y benchmark a 1000×1000: desenfoque gaussiano ≈ 146 ms, sombra ≈ 115 ms, contorno ≈ 145 ms (Node, una sola hebra).
- **Menú Efecto** por categorías (también en la paleta de comandos) y **panel Efectos** con parámetros en línea, activar/desactivar, reordenar, duplicar, eliminar y Salida; los deslizadores se ven en vivo y registran un solo paso al soltar.

- **Interfaz**: barra de herramientas en **una o dos columnas** (se guarda en los ajustes y se recuerda); en el widget de relleno/contorno el elemento seleccionado queda **encima** (clic = elegir, doble clic = abrir el selector); **selector de color** modal con cuadrado S/B, barra de tono, modos RGB · HSB · HSL con deslizadores de color real, hexadecimal, «Solo colores web» y recuadros Web/Real, con Aceptar y Cancelar; al arrastrar una capa la línea indicadora va **debajo** de la fila destino cuando la capa baja (y al arrastrar formas se resalta la capa completa).

- **Edición de anclas como en Illustrator**: con la **Pluma**, clic sobre un segmento de un trazado seleccionado añade un ancla y clic sobre un ancla la elimina (`Alt` la convierte entre esquina y suave); con la **Selección directa**, `Alt`+clic convierte, un **marco** en vacío selecciona anclas (`Mayús` suma), `Supr` elimina las anclas seleccionadas de una vez y las flechas las mueven. La barra de control muestra *Anclas en esquina*, *Anclas suaves*, *Eliminar anclas* y *Añadir puntos de ancla* (también en Objeto y en `Ctrl+K`).

- **Menú contextual de las pestañas** (clic derecho): Cerrar, Cerrar otros y Cerrar todo; los documentos con cambios piden confirmación uno a uno y cancelar detiene el resto. Esc o clic fuera lo cierra.

- **Anclas más cerca de Illustrator**: barra de control con iconos (*Convertir:* esquina / suave, *Anclas:* añadir puntos / eliminar, deshabilitados sin anclas seleccionadas); **cursores propios** (pluma, pluma +/−/convertir según lo que hay bajo el puntero, flecha hueca de selección directa y con marca sobre ancla o tirador) que cambian al pulsar Ctrl/Alt sin mover el ratón; **Ctrl** con la pluma y sus compañeras = selección directa temporal; **Alt**+arrastrar un tirador lo mueve sin arrastrar al opuesto, y **Alt**/Convertir ancla + arrastrar sobre un ancla **saca los tiradores** (un clic alterna esquina/suave).

- **Cortar, unir, curvar y continuar** (anclas): *Cortar en las anclas* (tijeras; el trazado cerrado queda abierto y cada corte da una pieza como forma independiente), *Unir anclas* (`Ctrl+Shift+J`: dos extremos de trazados abiertos, de la misma o de distintas formas; si coinciden se fusionan, si no se unen con un segmento recto, y los dos extremos de un mismo trazado lo cierran); **arrastrar un segmento** con la Selección directa lo curva moviendo los tiradores de ambos lados; la **Pluma continúa** un trazado abierto al hacer clic en uno de sus extremos.

### Pendiente de F4

- Cachés de efectos por versión del modelo (hoy se firma por contenido de los píxeles que se leen); composición completa de imágenes grandes en worker; «Aplicar efecto» hasta uno concreto; indicador fx en el panel Apariencia; efectos por atributo (relleno/contorno); editor en popover con Aceptar/Cancelar (hoy los cambios son en vivo y deshacibles); resplandor con caída suave/escalonada por origen centro.

## [0.4.0] — F3 · Apariencia avanzada y precisión

### Añadido

- **Degradados** lineal, radial y angular con paradas de color y alfa. **Modos de píxel**: suave, bandas (2–32 escalones), tramado (Bayer 2×2, 4×4, 8×8 y ajedrez) y cuantizado a paleta (en el modelo; sin editor aún). El tramado se ancla a coordenadas de imagen, así que dos formas contiguas casan con una sola (probado). Golden test con la huella de las 12 combinaciones matriz × tipo.
- **Panel Apariencia**: pila de rellenos y contornos por forma, con orden (subir/bajar), visibilidad, opacidad y modo de fusión por atributo, duplicar, eliminar y añadir; editor de pintura (sólido o degradado, paradas, invertir, modo de píxel), y de contorno (grosor, alineación, desplazamiento).
- **Panel Degradado** (como el de Illustrator): vista previa, tipo, ángulo, barra con el resultado pixelado real (bandas o tramado), paradas debajo (arrastrar, clic en el hueco para añadir), puntos medios (rombos) encima, color, opacidad y ubicación de la parada seleccionada, cuentagotas de pantalla y eliminar parada. Las paradas admiten punto medio en el modelo.
- **Barra de estado**: tamaño W × H en píxeles de la forma que se dibuja o está seleccionada.

- **Herramienta Degradado (`G`)**: anotador sobre el lienzo (línea inicio → fin, extremos y paradas arrastrables); arrastrar en el vacío define un degradado nuevo (convierte el relleno si era sólido). Un solo paso de historial al soltar.
- **Edición viva**: los arrastres de los paneles (paradas, puntos medios) y los selectores de color registran **un único paso al soltar**, no uno por movimiento.
- **Panel Alinear**: alinear (izquierda, centro, derecha, arriba, centro, abajo) y distribuir (bordes y centros, horizontal y vertical) respecto a la selección, a un **objeto clave** (clic en una forma ya seleccionada, trazo grueso) o al lienzo; **espaciado fijo** en píxeles. Usa los límites de píxeles visibles; todo movimiento es entero.
- **Reglas y guías**: reglas en píxeles de imagen; arrastrar desde una regla crea una guía, con `V` se mueve y devolverla a la regla la elimina (Ctrl+; las oculta). Las guías se guardan en el documento y son deshacibles.
- **Ajuste (snapping) al mover formas**: a bordes y centros de otras formas (guías inteligentes, líneas magenta), a los bordes y centro del lienzo y a las guías (cian), con los interruptores de la barra de estado y un radio de 4 px de pantalla.
- **Paletas y muestras globales**: la paleta vive en el documento (se guarda en el `.pixeltor`; PICO-8 por defecto) y es deshacible. Panel Muestras: añadir (sin duplicar), quitar (clic derecho), reordenar arrastrando, ordenar por tono o luz, **extraer colores de la imagen**, **rampas** entre relleno y contorno con giro de tono (*hue shifting*), biblioteca de la app (PICO-8, Game Boy, Sweetie 16, Endesga 32) e **importar/exportar `.gpl`, `.pal`, `.hex` y `.png`**. **Muestras globales**: enlazar un relleno o contorno sólido a una muestra y, al editarla, se recolorean todas las formas enlazadas de todas las imágenes en un solo paso de historial (deshacible).
- **Simetría** en lápiz, pincel y borrador: espejo horizontal y/o vertical y giro de 180° o 90° respecto al centro del lienzo (ejes magenta en el visor). Opera a nivel de píxel, así que el resultado es exacto también con puntas de tamaño par; un trazo = un paso de historial. Ejes personalizados, pendientes.
- **Degradados en modo paleta**: el modo de píxel «Paleta» copia los colores de la paleta del documento (con tramado opcional y botón para actualizarlos).
- **Paleta de comandos** (`Ctrl+K`): busca cualquier acción habilitada del registro (sin tildes, por prefijo, palabra o letras en orden), muestra su atajo, se navega con flechas y Enter, Esc cierra.
- **Operaciones de trazado** (menú Objeto y paleta de comandos): **trazado compuesto** (`Ctrl+8`, relleno par-impar con huecos) y liberarlo (`Ctrl+Alt+8`); **contorno de trazo** (convierte el contorno activo en una forma rellena con su pintura, respetando grosor y alineación; líneas abiertas con remates rectos); **expandir/contraer** el trazado 1 px (inglete con límite); **simplificar** anclas (Ramer–Douglas–Peucker, 1 px). Hornean la transformación y producen esquinas rectas; todo es deshacible y está cubierto por pruebas.
- **Ajuste ampliado**: además de mover, ahora ajustan a lienzo, guías y bordes/centros de objetos la esquina que se dibuja, los tiradores de escala y las anclas que se arrastran (líneas magenta/cian).
- Las pestañas del dock se acortan en vez de ensanchar la columna.

### Pendiente (pasa a fases siguientes)

- Guías inteligentes con medidas y ángulos; ajuste a los trazados y no solo a los límites de los objetos; modo medio píxel.
- Distancia de desplazamiento y tolerancia de simplificar configurables (hoy 1 px fijo); remates y uniones redondeados en el contorno de trazo; simplificar conservando curvas.
- Muestras globales también en las paradas de degradado (hoy solo en pinturas sólidas); varias paletas simultáneas en el panel (el modelo ya las admite).

## [0.3.0] — F2 · Formas vectoriales

### Añadido

- **Rasterizador pixel-perfect** (`src/core`): relleno por líneas de escaneo con muestreo en el centro del píxel (`nonzero` y `evenodd`), Bézier aplanada a 0,1 px, elipse por punto medio (círculos simétricos), contorno de 1 px por Bresenham con pixel-perfect (sin recortar esquinas marcadas), contornos de grosor > 1 centrados (uniones y remates) y anillos interior/exterior con desplazamiento.
- **Formas**: rectángulo (radios por esquina), elipse, línea, polígono, estrella y trazado con anclas Bézier. Apariencia simple (relleno y contorno sólidos con orden, opacidad y modo de fusión por atributo). Las formas se guardan en `document.json` y se componen en vivo sobre el ráster de su capa sin modificarlo.
- **Estampar** (`Ctrl+E`, `Ctrl+Shift+E`) con la regla de orden: si una forma tiene otras debajo que se solapan, se estampan también las inferiores. Prueba de invariante: el render antes y después es idéntico píxel a píxel.
- **Herramientas**: Rectángulo (`M`), Elipse (`L`), Línea, Polígono, Estrella y Pluma (clic = esquina, arrastrar = ancla suave, clic en la primera = cerrar, Intro/Esc), con vista previa pixelada en vivo y Mayús para proporcional o ángulos de 45°. Selección (`V`): clic, Mayús+clic, mover arrastrando o con flechas, Supr y organizar (`Ctrl+]` y compañía).
- **Interfaz**: overlay con trazado en el color de la capa, caja delimitadora, tiradores y anclas; formas listadas bajo su capa en el panel Capas; panel Propiedades contextual (relleno, contorno, grosor, alineación, radio, opacidad); opciones de formas en la barra de control.
- Golden test de círculos de 3 a 64 px (huella en `__snapshots__`) y e2e de crear, seleccionar, mover y estampar.

- **Selección directa** (`A`): seleccionar anclas (Mayús suma), arrastrar anclas y tiradores (los suaves mantienen la simetría); editar una forma paramétrica la convierte en trazado. Herramientas Añadir, Eliminar y Convertir ancla. Objeto › Convertir en trazado (rectángulo, polígono y estrella conservan los píxeles; la elipse y los radios se aproximan con Bézier).
- **Escalar con la caja** (`V`): ocho tiradores, Mayús proporcional y Alt desde el centro; rectángulos, elipses, líneas y trazados hornean la escala en sus parámetros.

- **Rotar con la caja** (`V`, cerca de una esquina por fuera; Mayús = pasos de 15°) alrededor del centro de la selección.
- **Mover formas a otra capa** arrastrando su fila del panel Capas sobre la capa destino.
- **Grupos**: Agrupar / Desagrupar (`Ctrl+G`, `Ctrl+Shift+G`), mostrados con sangría en el panel Capas. El grupo se compone aparte y después se aplica su opacidad, modo y transformación. **Modo aislamiento** con doble clic (`V`) y `Esc` para salir. Organizar, eliminar, duplicar y estampar funcionan con grupos anidados.
- **Widget de radio de esquina**: círculo interior del rectángulo seleccionado; arrastrar redondea las cuatro esquinas y Alt solo la superior izquierda.
- **Rendimiento**: las formas se rasterizan solo en su caja (más el margen de los contornos) y con caminos rápidos para rellenos opacos. Arrastrar un ancla de una elipse de 600×500 con dos contornos en 1000×1000 tarda ≈ 21 ms por fotograma (objetivo ≥ 30 fps), medido en una prueba con umbral en `tests/core/bench`.

### Pendiente o limitado

- En modo aislamiento, editar anclas de un hijo dentro de un grupo con rotación o escala puede desplazarse mal; conviene desagrupar antes. Mover y escalar sí componen bien con la transformación del grupo.
- Desagrupar reparte la opacidad del grupo entre los hijos, así que con hijos solapados el aspecto puede variar.
- `antialias` y trazos discontinuos no están implementados; el desplazamiento de contorno solo actúa con alineación interior/exterior.
- Convertir una elipse o un rectángulo redondeado en trazado aproxima el borde con Bézier y puede cambiar algún píxel.
- La medida de 30 fps es de CPU en Node, no del renderer completo en una máquina de referencia.
- Linux sigue sin verificar.

## [0.2.0] — F1 · Núcleo ráster

### Añadido

- **Núcleo (`src/core`, sin DOM)**: modelo de documento (imágenes, capas con visibilidad, bloqueo, bloqueo de transparencia, opacidad y 9 modos de fusión), bitmaps RGBA8 fuera de la reactividad, composición determinista con las fórmulas de W3C Compositing and Blending y máscaras de selección.
- **Sesión, historial y comandos**: toda edición pasa por una `Transaction` que genera un único comando deshacible. Los cambios de píxeles se guardan como teselas de 64×64 (antes/después, comprimidas con fflate); los de modelo, como instantáneas de capas y selección. Límite de 200 pasos o 512 MB, fusión de cambios seguidos de una misma propiedad y detección de cambios sin guardar.
- **Herramientas**: Lápiz (pixel-perfect, Mayús+clic para línea recta), Pincel (cuadrado o redondo, tamaño con `[` y `]`), Borrador, Bote (tolerancia, contiguo, todas las capas), Cuentagotas (Alt como temporal), Mano (Espacio o botón central), Zoom, Marco rectangular (nueva/añadir/restar/intersección con Mayús/Alt), Varita mágica y mover selección o píxeles flotantes (flechas, Intro, Esc).
- **Selección**: seleccionar todo, deseleccionar, invertir, copiar, cortar, pegar, borrar y rellenar, con hormigas en marcha alineadas a la rejilla.
- **Visor**: `Viewport` (zoom y desplazamiento, independiente del render, listo para varios visores), render WebGL2 con filtro NEAREST, tablero de transparencia y cuadrícula de píxeles a partir de 800 %, overlay Canvas2D, zoom con rueda centrado en el cursor y desplazamiento ajustado a píxeles enteros.
- **Paneles**: Capas (miniaturas, visibilidad, bloqueo, renombrar con doble clic, reordenar arrastrando, opacidad, fusión, bloquear transparencia), Historial (clic para volver a un paso), Color (HSV + hexadecimal), Muestras, Navegador. Barra de control con las opciones de cada herramienta.
- **Archivos**: formato `.pixeltor` 1.0.0 (ZIP con `mimetype` sin comprimir, `document.json`, rásters PNG con SHA-256, miniatura), guardado atómico con `.bak`, tolerancia a rásters dañados (se cargan vacíos con aviso) y rechazo claro de versiones mayores. Importar PNG (Archivo › Abrir), exportar PNG con escala entera ×1–×16 y «Exportar de nuevo».
- **Autoguardado y recuperación**: cada 2 minutos y solo con cambios, en `userData/recovery`; al arrancar tras un cierre inesperado se ofrece Recuperar o Descartar. Al cerrar con cambios sin guardar se pregunta Guardar / No guardar / Cancelar.
- Códec PNG y SHA-256 propios en el core (sin dependencias nuevas salvo `fflate`).
- Pruebas: 30+ unitarias del core (deshacer 100 pasos, round-trip de `.pixeltor`, exportación ×4 pixel-perfect…), prueba de rendimiento de pincel en 1000×1000 con 20 capas y e2e de dibujo, capas, IPC de archivos y autoguardado.

### Pendiente o limitado

- **Linux sin verificar** (como en F0).
- El pincel no tiene aún opacidad ni tramado, y el Marco elíptico, el Lazo y los demás elementos de selección de píxeles de `specs/04` quedan para fases posteriores (no están en el alcance de F1).
- El Navegador no refresca su rectángulo al desplazar el visor sin cambiar el zoom.
- No se ha medido el objetivo de 60 fps en una máquina de referencia; la prueba automática solo comprueba < 16 ms por segmento de pincel.
- Recuperación tras fallo y diálogos nativos de guardado/cierre no tienen e2e (los diálogos nativos no se pueden automatizar); el IPC subyacente sí.
- `vitest bench` ya no existe en Vitest 5: los benchmarks de `tests/core/bench` son pruebas con umbral.

## [0.1.0] — F0 · Esqueleto

### Añadido

- Proyecto electron-vite con TypeScript estricto, Vue 3 (`<script setup>`), Pinia, Vitest, ESLint y Prettier. Tres `tsconfig` (`core` sin DOM ni Node, `node`, `web`) y una regla de ESLint que impide importar Vue, Electron o el renderer desde `src/core`.
- Proceso principal seguro: `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta, navegación bloqueada e instancia única. API tipada en `window.pixeltor` (preload CommonJS) con contrato IPC en `src/shared`.
- Ajustes persistentes en `userData/settings.json` con guardado atómico (tema).
- Barra de título personalizada con `titleBarOverlay` (Windows y Linux) que se recolorea con el tema.
- Tokens y componentes de `design/` (`tokens.css`, `components.css`), temas **Oscuro**, **Gris medio** y **Claro** conmutables desde Ver › Tema, y fuentes Inter y JetBrains Mono empaquetadas (licencias OFL en `resources/licenses/`).
- 135 iconos propios del diseño mediante `<PtIcon name>`.
- **Registro único de acciones** (`src/renderer/actions/`): de él salen los menús, los tooltips (nombre + atajo, 500 ms) y el despachador de atajos. Atajos de `specs/04-herramientas.md`, con prueba de que no hay duplicados ni acciones sin etiqueta.
- Shell maquetado según la pantalla 03: barra de título con menú, barra de control, barra de herramientas con flyouts (pulsación larga o clic derecho) y widget relleno/contorno, pestañas de documento, visor con cabecera, tira de imágenes colapsada, columna de iconos con paneles flotantes, dock (Propiedades · Capas/Apariencia · Color/Muestras) y barra de estado.
- `Tab` y `Mayús+Tab` ocultan los paneles; los toggles de la barra de estado y de la cabecera del visor funcionan.
- Texto de UI en español vía `src/renderer/i18n/es.json`.
- Smoke e2e con Playwright (apertura, menú con atajos, atajos de herramienta, cambio de tema persistente, ocultar paneles).
- `electron-builder.yml` con instalador NSIS (Windows) y AppImage (Linux).

### Pendiente o limitado

- **Linux sin verificar**: el AppImage está configurado pero no se ha construido ni probado (el desarrollo de F0 fue en Windows).
- El lienzo es una maqueta (tablero y cuadrícula de píxeles sobre un documento 32×32 de ejemplo); el modelo, el visor WebGL2 y los comandos llegan en F1.
- Los menús son funcionales pero casi todos los elementos están deshabilitados hasta que existan sus comandos.
- Los selectores de espacio de trabajo y la paleta de comandos (F3) están maquetados sin función.
- Sin icono de aplicación propio: se usa el de Electron (F7).

### Notas de entorno

- Si la red intercepta TLS (certificado autofirmado en la cadena), `npm install` puede dejar sin descargar el binario de Electron. Se resuelve con `NODE_USE_SYSTEM_CA=1 node node_modules/electron/install.js`, que usa el almacén de certificados del sistema sin desactivar la verificación.
- VS Code define `ELECTRON_RUN_AS_NODE`; hay que quitarlo del entorno para lanzar Electron (el e2e ya lo hace).
