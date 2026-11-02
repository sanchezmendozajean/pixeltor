# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Cada fase del roadmap (`specs/30-roadmap.md`) cierra con una entrada.

## [0.8.0] — F7 · Pulido y distribución

### Añadido

- **Atajos de teclado personalizables** (Ayuda › Atajos de teclado…): lista del registro de acciones con búsqueda, grabación del atajo, aviso de conflicto con reasignación, quitar y restablecer (por acción o todos). Se guardan en los ajustes y alimentan menús, tooltips y la paleta de comandos.
- **Buscatrazos** (Objeto › Buscatrazos): unir, restar la forma frontal, intersecar y excluir, en un solo paso deshacible. Usa `polygon-clipping` (MIT) para resolver bordes coincidentes y huecos; las curvas pasan a segmentos rectos, como en el resto de operaciones de trazados. El resultado conserva la apariencia de la forma frontal (la de atrás en «restar»).
- **Grupos de capas** (Capa › Agrupar capa, `Ctrl+Alt+Mayús+G`): la capa de grupo compone a sus miembros en un búfer propio y les aplica su opacidad, modo de fusión y visibilidad; plegar y desplegar en el panel Capas, arrastrar una capa dentro o fuera del grupo, mover o eliminar el grupo con sus miembros y desagrupar. Un solo nivel de anidamiento; se guarda en el `.pixeltor` y se sanea al abrir.
- **Máscara de recorte** (`Ctrl+Alt+G`): una capa sólo se ve donde su base (la de debajo, en la misma pila) tiene alfa; la base y sus recortes comparten opacidad y modo. Los búferes temporales de la composición se reutilizan.
- **Escala de la interfaz** (Ver › Escala de la interfaz: 90, 100, 110, 125 y 150 %): zoom de la ventana, independiente del zoom del lienzo; se guarda en los ajustes. El tema **Gris medio** ya estaba disponible desde F0.
- **La disposición de visores se guarda en el documento** (`viewers` en el `.pixeltor`, también en el autoguardado): árbol de divisiones, visor activo y, por visor, imagen fijada, cuadrícula, trazados, papel cebolla, mosaico y sincronización (no el zoom ni el desplazamiento). Se valida al abrir: árboles no válidos, repetidos o de más de 4 visores se descartan.
- **Revisión de accesibilidad** con axe-core en e2e (shell, visores divididos, paneles y diálogos de color y de atajos): cero infracciones críticas o graves. Correcciones: controles de color (sombreado/brillo y tono) con valores ARIA y teclado (flechas, Mayús = paso grande); listbox de imágenes con hijos válidos; lista de capas sin roles interactivos anidados (la capa activa usa `aria-current`); nombres accesibles que contienen el texto visible; encabezado principal y región de la barra de control. Alcance de SVG retirado de las specs (importar y exportar): el producto trabaja con mapas de bits.
- **Mediciones de rendimiento en la app real** (`tests/e2e/perf.test.ts`, Electron en Windows): trazo de pincel en 1000×1000 con 20 capas y con 4 visores abiertos, ambos a 60 fps sostenidos (p95 ≈ 17 ms, máx ≈ 17 ms); desenfoque gaussiano de una forma de ~800×800 añadido y calculado en worker en ≈ 0,8 s contando la interfaz y el arranque del worker. Los límites del test son holgados; la cifra está en el informe. Limitación: Playwright emite los movimientos del ratón a la cadencia del fotograma, así que no estresa más allá de ese ritmo; no se mide en Linux ni en equipos de gama baja.
- **Desenfoque más barato con contenido pequeño**: el desenfoque calcula sólo la zona que el contenido puede alcanzar (caja del alfa + radio) en vez de toda la región pedida; resultado idéntico (los golden tests no cambian). Forma de 100×100 en 1000×1000: 81 → 7 ms; 300×300: 99 → 30 ms; 800×800: ≈ 185 ms en Node.
- **Caché de composición por capas**: mientras se edita la capa activa, la composición de las capas que quedan debajo se reutiliza (parte del mismo búfer que tendría la composición completa, así que el resultado es idéntico byte a byte; hay pruebas que lo comparan tras pintar, deshacer, reordenar, cambiar propiedades y añadir efectos, y una que demuestra que la caché se usa). Se invalida con un evento nuevo `layerIds` (capas tocadas, que emiten los trazos y la edición viva de efectos); cualquier otro cambio o deshacer la descarta. No se usa con grupos, máscaras de recorte ni efectos en las capas de debajo. Con 20 capas de 700×700 con contenido, recomponer la capa 16 pasa de 601 ms a 155 ms (Node). En la app, el scrubbing del desenfoque en 1000×1000 con 20 capas baja de ≈ 0,59 s a ≈ 0,41 s por resultado; sigue sin llegar a 150 ms (el desenfoque de una forma de 800×800 son ≈ 185 ms y el resto es el viaje al worker y la subida a la GPU). Pendiente: vista previa a media resolución mientras se arrastra el control.
- **La caché de composición también cubre** el arrastre de formas (mover, escalar, rotar, radio de esquina) y de anclas y segmentos: avisan de qué capa tocan, y guías y selección de formas no invalidan nada.
- **Presión de tableta** en pincel y borrador (casilla «Presión» en la barra de control, activada por defecto): con un lápiz de tableta el tamaño sigue la presión (1 px hasta el tamaño elegido) y se interpola a lo largo de cada segmento; con ratón no cambia nada y el lápiz (1 px pixel-perfect) la ignora. La lógica está en el core (`Stroke.move(x, y, presión)`) con pruebas; el e2e usa eventos de puntero `pen` sintéticos, así que no está probado con una tableta física. Sin curva de presión configurable ni inclinación.
- **Espacios de trabajo** (selector en la barra de título): Esenciales, Animación, Vectores y Mínimo integrados, y los del usuario (Nuevo… con el estado actual, Guardar cambios, Renombrar, Eliminar, Restablecer). Un espacio guarda qué paneles se ven (Ventana › Paneles), el panel Imágenes (oculto, plegado o desplegado), la disposición de visores por defecto y las columnas de la barra de herramientas; el último usado se recuerda al abrir y los documentos sin disposición propia arrancan con la del espacio. Validado al leer los ajustes (hasta 20, nombres de 40 caracteres, no pisan a los integrados). Los objetos reactivos no pasan por IPC: se copian a JSON al guardar. No guarda _dónde_ está cada panel (el dock es fijo) ni sus alturas.
- Indicadores de relleno y contorno idénticos a los de Victoria, y texto de los paneles 1 px menor.
- electron-builder: objetivos **portable** y **deb** además de NSIS y AppImage. NSIS y portable se generan y el ejecutable arranca en Windows; deb y AppImage sin verificar.

### Correcciones tras la revisión de código

- Capas: una capa nueva sobre un miembro de un grupo entra en el grupo (antes partía su bloque y el grupo perdía miembros al reabrir); no se duplica un grupo; la copia de una base queda tras sus capas recortadas; soltar un grupo en su sitio no crea un paso de historial.
- Ajustes: las escrituras de `settings.json` se encadenan (dos cambios seguidos compartían el `.tmp` y el segundo renombrado podía fallar).
- Visores: cerrar uno desde su cabecera o arrastrando el separador refleja los ajustes del nuevo visor activo en menús y botones.
- Caché de composición: no se usa si hay efectos en las capas de debajo (reconstruirla en cada trazo calculaba los efectos de toda la imagen); el grupo de búferes temporales se libera al cambiar de tamaño de imagen.
- Interfaz: el texto del control de color pasa por i18n y los ayudantes de teclado se comparten; el trazo «ninguno» del selector usa el token `--danger`; el diálogo de espacios de trabajo retira su escuchador de teclado.

### Anclas en el centro de los píxeles

- Las anclas de los trazados se colocan siempre en el centro de un píxel y no entre dos: al arrastrarlas (también con teclado), al añadir un ancla sobre un segmento y al añadir puntos medios; sus tiradores las acompañan sin cambiar de longitud. La pluma ya creaba las anclas en centros. Un ancla arrastrada que estaba en una esquina (p. ej. una forma convertida en trazado) salta medio píxel al primer movimiento.
- Objeto › **Centrar anclas en los píxeles** lleva todas las anclas de las formas seleccionadas a su centro (convierte las paramétricas en trazados; un paso deshacible); arregla formas antiguas. No se centran solas al convertir un rectángulo, porque eso cambiaría lo que se rasteriza.
- **Caja de selección** (herramienta V): el marco y sus 8 tiradores pasan por el centro de los píxeles del borde de la forma, no por la arista entre dos píxeles. Al escalar, el tirador queda sobre el píxel del cursor (la arista de la caja se lleva a ese píxel); el marco y los tiradores se dibujan alineados a píxeles de pantalla.
- El contorno azul de rectángulos y elipses seleccionados o bajo el cursor se dibuja por el centro de los píxeles de su borde (0,5 px hacia dentro), de modo que pasa por los tiradores de la caja y no por la arista entre píxeles. Sólo cambia el dibujo del contorno de selección, no la forma ni lo que se pinta.
- **Trazados centrados**: un trazado con todas las anclas en centros de píxel pinta también los píxeles cuyo centro cae justo sobre su contorno (borde incluido en los cuatro lados), de modo que el contorno y el dibujo coinciden y la caja de selección cubre exactamente los píxeles pintados. Los trazados con anclas en otras posiciones (p. ej. polígonos convertidos) siguen con la regla de siempre. Convertir un rectángulo o una elipse en trazado los encoge medio píxel para que sus anclas caigan en los centros: el relleno del rectángulo es idéntico (hay pruebas) y el de esquinas redondeadas y elipses es aproximado; el contorno de 1 px de un rectángulo, que antes caía una fila/columna fuera del relleno, queda sobre su borde. Los trazados de pluma, cuyas anclas ya estaban en centros, ganan el píxel del borde derecho/inferior. Polígonos y estrellas se convierten sin tocar su geometría. Al escalar con la caja, un trazado centrado conserva las anclas en centros de píxel (antes quedaban entre píxeles y el trazado volvía a descuadrarse medio píxel de su dibujo).
- El tirador que redondea las esquinas de un rectángulo es libre (no se ajusta a los píxeles): parte a ~20 px de pantalla de la esquina con radio 0 —o a media distancia del radio máximo en formas pequeñas— y llega al borde del arco con el radio máximo (la mitad del lado menor), de modo que nunca se sale de la forma y se mueve de forma continua con el radio. El radio ya no se redondea a píxeles enteros. Todo el recorrido del tirador curva la esquina: el radio mínimo que cambia lo pintado (≈1,75 px, por debajo el píxel de la esquina no cambia) coincide con el punto de partida del tirador, así que no hay una zona muerta.
- Añadir un ancla con la pluma sobre una forma (p. ej. un rectángulo redondeado) lleva al centro de su píxel todas las anclas del trazado, no sólo la nueva. El cursor de la pluma se ha girado 90° en sentido horario (la punta queda arriba a la izquierda).
- Los **tiradores de las anclas** (puntos de control de las curvas) también caen siempre en el centro de un píxel: al arrastrarlos, al sacarlos de un ancla (Convertir ancla / Alt) y al convertir o centrar formas con curvas; el tirador opuesto de un ancla suave se recoloca en un centro. Los tiradores creados con la pluma ya lo estaban.
- Indicador de relleno/contorno: desaparecen las líneas grises «fantasma» en los bordes verticales del anillo del contorno (el recorte con clip-path se suavizaba entre píxeles); el anillo se dibuja ahora con sombras ajustadas a píxeles y el recorte sólo sirve para recibir los clics.
- El contorno de selección de un rectángulo con las esquinas redondeadas ya no muestra picos hacia fuera en las esquinas cuando el radio es pequeño (se dibuja la forma encogida medio píxel en lugar de desplazar su polígono).
- Arreglo menor: la etiqueta de zoom de la cabecera del visor no se actualizaba tras encajar la imagen.

### No incluido en esta versión (decisión de alcance)

- Rotación de vista (choca con el render pixel-perfect), estilos gráficos, capas enlazadas y WebP animado (opcional en la spec).
- Importar y exportar SVG: retirado del alcance, el producto trabaja con mapas de bits.
- Asociación de archivos, firma de código y auto-actualización (opcionales).
- Verificación en Linux (AppImage y deb) sin hacer.
- Rendimiento: el scrubbing del desenfoque de una forma muy grande en 20 capas sigue en ≈ 0,4 s (objetivo < 150 ms); falta la vista previa a media resolución.

## [0.7.0] — F6 · Visores divididos

### Añadido

- **Varios visores por documento** (hasta 4): `Ctrl+Alt+V` divide en vertical y `Ctrl+Alt+H` en horizontal el visor activo (árbol binario de divisiones; el visor nuevo hereda zoom y ajustes). Separadores de 4 px arrastrables, **doble clic** los iguala y arrastrar uno hasta el borde cierra el visor de ese lado. Cerrar con ✕ en la cabecera o con `Ctrl+Alt+W`. La lógica del árbol (dividir, quitar, presets, igualar) es pura y está en `core/viewers` con pruebas.
- **Presets** en Ventana › Disposición de visores: un visor, 2 verticales, 2 horizontales, 1 grande + 2 pequeños y 2×2 (conservan los visores existentes).
- **Edición completa en cualquier visor**: cada visor tiene su propio `Viewport`, controlador de herramientas, overlay, reglas y cursor; un trazo, una forma o una edición de anclas hecha en uno se ve al instante en todos. El último visor pulsado es el activo (borde de acento); Navegador, zoom del menú y atajos actúan sobre él.
- **Cabecera por visor**: imagen (sigue la activa o **fijada** a una concreta; editar en un visor fijado activa esa imagen), zoom con presets y «Encajar», cuadrícula de píxeles, trazados, papel cebolla, **modo mosaico** (repite la imagen en X, en Y o en ambos y se puede editar en cualquier copia), reproducir sólo en ese visor y menú ⋯ (dividir, **sincronizar** zoom y posición entre visores).
- Una composición propia por visor sólo cuando enseña una imagen distinta de la activa (fijada o en reproducción); el visor normal sigue compartiendo la composición con actualización por regiones.

### Pendiente (pasa a fases siguientes)

- Guardar la disposición en el documento y en el workspace; cabecera fija/al pasar el cursor (preferencia); elegir con qué visor sincronizar (ahora comparten todos los marcados).
- Modo mosaico: el trazo que cruza el borde de la imagen salta de lado; el overlay (selección, anclas) sólo se dibuja sobre la copia central.
- Un canvas WebGL por visor (en vez de un único canvas con _scissor_); sin medir el rendimiento con 4 visores a la vez ni verificado en Linux.

## [0.6.0] — F5 · Varias imágenes y animación

### Añadido

- **Varias imágenes por documento**: nueva imagen (copia de la actual con ids nuevos, `Ctrl+Alt+N`, o vacía con las mismas capas), duplicar, eliminar (siempre queda una), reordenar arrastrando o invertir, renombrar, **duración en ms** (10–60 000) y **excluir de la animación**; todo es deshacible y rehacible. Al cambiar de imagen (`,` / `.`) se activa la capa del mismo nombre.
- **Panel Imágenes**: tira con miniaturas reales, selección múltiple (`Mayús`/`Ctrl`), número, duración editable al desplegarlo, total de la animación y menú contextual (nueva, duplicar, eliminar, duración, invertir, excluir). La barra de estado muestra la imagen activa.

- **Reproducción** (`Ctrl+Enter`) en el visor: bucle, ping-pong y una vez, velocidad 0,25×–2×, reloj con `performance.now()`, FPS efectivos, empieza por la imagen activa y no la cambia; las imágenes de distinto tamaño se centran en el mayor. La lógica de tiempos es una función pura del core (`frameAt`, con pruebas).
- **Papel cebolla** (`O`): hasta 5 imágenes anteriores (rojas) y 5 siguientes (azules), opacidad decreciente por distancia y tinte opcional; sólo se ve en el visor, nunca se exporta.

- **Exportar como…** (`Ctrl+Alt+S`): PNG, **secuencia de PNG** (`nombre_01.png`…), **hoja de sprites + JSON** (horizontal, vertical o rejilla con relleno; metadatos con frame, duración y sourceSize), **GIF animado**, **APNG** e **ICO** (entradas PNG de hasta 256 px), con escala entera por vecino más cercano y alcance imagen actual / las de la animación / todas. Codificadores propios en el core, sin dependencias: el GIF usa paleta global cuantizada por corte mediano (≤ 255 colores + transparente) y se prueba con un decodificador independiente; las imágenes de distinto tamaño se centran. «Exportar de nuevo» repite la última configuración y ruta.

- **Importar**: **GIF animado** (Archivo › Abrir: una imagen por fotograma con su duración, paletas locales, entrelazado y disposición de fotogramas), **secuencia de PNG** (varios archivos en orden alfabético natural) e **hoja de sprites** (diálogo con tamaño de celda, margen, espaciado, orden y omitir celdas vacías). Decodificador GIF y troceado en el core con pruebas de ida y vuelta contra el codificador.

### Pendiente (pasa a fases siguientes)

- Panel Vista previa independiente; reproducir sólo la selección; modo rejilla del panel; papel cebolla con imágenes de distinto tamaño centradas.
- Importar: arrastrar y soltar archivos y detección automática de la rejilla de una hoja.
- Exportar: recorte al contenido, fondo de color, varios tamaños a la vez, plantilla de nombre, PNG indexado y empaquetado/extrusión de la hoja.

## [0.5.0] — F4 · Efectos no destructivos

### Añadido

- **Motor de efectos** (`src/core/effects`): registro con esquema de parámetros (rangos y valores por defecto), radio de influencia, cadena de aplicación que solo calcula lo necesario por etapa y sección **Salida** (umbral/tramado del alfa y ajuste a paleta). Efectos en **formas y capas** que se componen en vivo sin tocar el ráster base (prueba de invariante) y regiones sucias ampliadas por el radio de influencia (prueba: componer por cuadrantes = componer todo).
- **23 efectos**: sombra paralela, interior y larga; resplandor exterior e interior; iluminación direccional y bisel (sombreado automático por mapa de alturas, con escalones); contorno de píxel (4/8 conexiones, exterior/interior); desenfoque gaussiano, de caja y de movimiento; onda, ondulación, torsión, desplazamiento (con envoltura) y mosaico; tono/saturación/luminosidad, brillo/contraste, mapa de degradado, reemplazar colores, posterizar, invertir y superposición de color.
- **Pool de workers** (hasta 4, `hardwareConcurrency − 1`) para los efectos del visor: lo que el cálculo puede leer viaja al worker, solo se procesa la petición más reciente de cada capa/forma y, mientras llega el resultado, se muestra el último válido (sin parpadeo) con «Calculando efectos…» en la barra de estado. Las áreas pequeñas (pinceladas) se calculan en línea. Exportar y estampar siguen siendo síncronos y deterministas. Corrige que la salida «ajustar a paleta» no recibía las paletas del documento.
- **Aplicar efecto**: el botón de estampar de cada efecto aplica a la capa los efectos hasta ése (inclusive) y deja activos los siguientes; en una forma la estampa con sus efectos. El render no cambia (prueba).
- **Presets de efectos** (guardar la pila actual con un nombre y aplicarla como un solo paso) e indicador **fx** en las filas de capas y formas.
- **Rasterizar efectos de capa** (`Ctrl+Alt+E`): estampa las formas, aplica los efectos de la capa y los vacía sin cambiar el render. Estampar una forma conserva sus efectos.
- **Golden por efecto** (huella FNV de cada efecto sobre una imagen fija) y benchmark a 1000×1000: desenfoque gaussiano ≈ 146 ms, sombra ≈ 115 ms, contorno ≈ 145 ms (Node, una sola hebra).
- **Menú Efecto** por categorías (también en la paleta de comandos) y **panel Efectos** con parámetros en línea, activar/desactivar, reordenar, duplicar, eliminar y Salida; los deslizadores se ven en vivo y registran un solo paso al soltar.

- **Interfaz**: barra de herramientas en **una o dos columnas** (se guarda en los ajustes y se recuerda); en el widget de relleno/contorno el elemento seleccionado queda **encima** (clic = elegir, doble clic = abrir el selector); **selector de color** modal con cuadrado S/B, barra de tono, modos RGB · HSB · HSL con deslizadores de color real, hexadecimal, «Solo colores web» y recuadros Web/Real, con Aceptar y Cancelar; al arrastrar una capa la línea indicadora va **debajo** de la fila destino cuando la capa baja (y al arrastrar formas se resalta la capa completa).

- **Edición de anclas como en Illustrator**: con la **Pluma**, clic sobre un segmento de un trazado seleccionado añade un ancla y clic sobre un ancla la elimina (`Alt` la convierte entre esquina y suave); con la **Selección directa**, `Alt`+clic convierte, un **marco** en vacío selecciona anclas (`Mayús` suma), `Supr` elimina las anclas seleccionadas de una vez y las flechas las mueven. La barra de control muestra _Anclas en esquina_, _Anclas suaves_, _Eliminar anclas_ y _Añadir puntos de ancla_ (también en Objeto y en `Ctrl+K`).

- **Menú contextual de las pestañas** (clic derecho): Cerrar, Cerrar otros y Cerrar todo; los documentos con cambios piden confirmación uno a uno y cancelar detiene el resto. Esc o clic fuera lo cierra.

- **Anclas más cerca de Illustrator**: barra de control con iconos (_Convertir:_ esquina / suave, _Anclas:_ añadir puntos / eliminar, deshabilitados sin anclas seleccionadas); **cursores propios** (pluma, pluma +/−/convertir según lo que hay bajo el puntero, flecha hueca de selección directa y con marca sobre ancla o tirador) que cambian al pulsar Ctrl/Alt sin mover el ratón; **Ctrl** con la pluma y sus compañeras = selección directa temporal; **Alt**+arrastrar un tirador lo mueve sin arrastrar al opuesto, y **Alt**/Convertir ancla + arrastrar sobre un ancla **saca los tiradores** (un clic alterna esquina/suave).

- **Cortar, unir, curvar y continuar** (anclas): _Cortar en las anclas_ (tijeras; el trazado cerrado queda abierto y cada corte da una pieza como forma independiente), _Unir anclas_ (`Ctrl+Shift+J`: dos extremos de trazados abiertos, de la misma o de distintas formas; si coinciden se fusionan, si no se unen con un segmento recto, y los dos extremos de un mismo trazado lo cierran); **arrastrar un segmento** con la Selección directa lo curva moviendo los tiradores de ambos lados; la **Pluma continúa** un trazado abierto al hacer clic en uno de sus extremos.

### Pendiente (pasa a fases siguientes)

- Cachés de efectos por versión del modelo (hoy se firma por contenido de los píxeles que se leen); composición completa de imágenes grandes en worker; indicador fx en el panel Apariencia; efectos por atributo (relleno/contorno); editor en popover con Aceptar/Cancelar (hoy los cambios son en vivo y deshacibles); resplandor con caída suave/escalonada por origen centro.

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
- **Paletas y muestras globales**: la paleta vive en el documento (se guarda en el `.pixeltor`; PICO-8 por defecto) y es deshacible. Panel Muestras: añadir (sin duplicar), quitar (clic derecho), reordenar arrastrando, ordenar por tono o luz, **extraer colores de la imagen**, **rampas** entre relleno y contorno con giro de tono (_hue shifting_), biblioteca de la app (PICO-8, Game Boy, Sweetie 16, Endesga 32) e **importar/exportar `.gpl`, `.pal`, `.hex` y `.png`**. **Muestras globales**: enlazar un relleno o contorno sólido a una muestra y, al editarla, se recolorean todas las formas enlazadas de todas las imágenes en un solo paso de historial (deshacible).
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
