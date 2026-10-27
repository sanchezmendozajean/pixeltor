# 30 · Roadmap y criterios de aceptación

Cada fase termina con: pruebas unitarias en verde, app ejecutable en Windows y Linux, y una nota en `CHANGELOG.md`. Una fase no empieza sin cerrar la anterior salvo indicación.

## F0 · Esqueleto
- Proyecto electron-vite + Vue 3 + TS + Pinia + Vitest + ESLint/Prettier.
- Ventana con barra de título personalizada, menú (vacío funcional), barra de control, barra de herramientas, dock derecho con paneles vacíos, barra de estado — **maquetados con los tokens y el diseño de `design/`**.
- Temas oscuro/claro conmutables.
- Registro de comandos y atajos (una sola fuente para menús, tooltips y atajos).
- electron-builder generando instalador NSIS y AppImage.

**Aceptación**: la app abre en ambas plataformas, se ve como el diseño de la pantalla 3 (sin lienzo funcional), los menús muestran atajos.

## F1 · Núcleo ráster
- Modelo de documento (`src/core/model`), sesión, CommandBus, Historial con teselas.
- Una imagen, capas (crear, eliminar, duplicar, reordenar, visibilidad, bloqueo, opacidad, modo de fusión, bloquear transparencia).
- Visor WebGL2 con zoom/pan, tablero, cuadrícula de píxeles; **abstracción `Viewport` lista para varios visores**.
- Herramientas: Lápiz (pixel-perfect), Pincel, Borrador, Bote, Cuentagotas, Mano, Zoom, Marco rectangular, Varita, mover selección/píxeles flotantes.
- Panel Color (selector), panel Muestras básico, panel Capas, panel Historial, Navegador.
- Abrir/guardar `.pixeltor` (v1.0.0), importar PNG, exportar PNG (con escala), autoguardado y recuperación.

**Aceptación**: dibujar un sprite 32×32 con 3 capas, guardar, cerrar, reabrir idéntico; exportar ×4 pixel-perfect; deshacer 100 pasos; pintar fluido en 1000×1000.

## F2 · Formas vectoriales
- Rasterizador pixel-perfect (relleno por centro de píxel, contornos 1 px pixel-perfect, offset de contornos, elipse por punto medio).
- Rectángulo (radios), Elipse, Línea, Polígono, Estrella, Pluma, Añadir/Eliminar/Convertir ancla.
- Selección (V) con caja de transformación, Selección directa (A), modo aislamiento de grupos.
- Overlays: hover, selección, anclas, tiradores, color de capa.
- Apariencia simple (un relleno sólido + un contorno sólido), panel Propiedades contextual.
- Formas listadas en el panel Capas; mover formas entre capas; organizar.
- **Estampar** (forma, todas, regla de orden).

**Aceptación**: golden tests del rasterizador (círculos 3..64 px idénticos a referencias), estampar no cambia el render (prueba de invariante), editar anclas a 30 fps en 1000×1000.

## F3 · Apariencia avanzada y precisión
- Panel Apariencia completo: múltiples rellenos y contornos, orden, opacidad y modo por atributo.
- Degradados lineal/radial/angular con modos de píxel (bandas, tramado Bayer, paleta); herramienta Degradado en el lienzo.
- Alinear y distribuir (objeto clave), snapping (píxel, anclas, trazados, guías, lienzo), guías inteligentes, reglas y guías.
- Contorno de trazo, desplazamiento de trazado, simplificar, trazados compuestos.
- Muestras globales, importación/exportación de paletas, rampas.
- Simetría en pincel/lápiz. Paleta de comandos.

## F4 · Efectos no destructivos
- Registro de efectos, pool de workers, cachés por versión, regiones sucias expandidas por radio de influencia.
- Efectos: Sombra paralela, Sombra interior, Sombra larga, Resplandor exterior/interior, Iluminación direccional, Bisel, Contorno de píxel, Desenfoque gaussiano/caja/movimiento, Onda, Ondulación, Torsión, Desplazamiento, Mosaico, HSL, Brillo/Contraste, Mapa de degradado, Reemplazar colores, Posterizar, Invertir, Superposición de color.
- Sección Salida (umbral/tramado/paleta).
- Efectos en forma y en capa; menú Efecto; editor en popover con vista previa en vivo; presets.
- Aplicar efecto / Rasterizar efectos de capa.

**Aceptación**: golden tests por efecto; scrubbing de desenfoque en 1000×1000 con primer resultado < 150 ms; ningún efecto altera el ráster base (prueba).

## F5 · Varias imágenes y animación
- Panel Imágenes/Animación (tira y rejilla), duraciones en ms, reordenar, duplicar, excluir.
- Reproducción (bucle, ping-pong, una vez, velocidad), panel Vista previa, papel cebolla.
- Imágenes de distinto tamaño.
- Importar GIF, secuencia PNG, hoja de sprites. Exportar secuencia PNG, hoja de sprites + JSON, GIF, APNG, ICO.

## F6 · Visores divididos
- División vertical/horizontal hasta 4, presets, cabecera de visor, imagen fijada por visor, overlays por visor, modo mosaico, sincronización.

## F7 · Pulido y distribución
- Buscatrazos, estilos gráficos, grupos de capas, máscara de recorte, capas enlazadas (si cabe).
- Atajos personalizables, workspaces personalizados, tema Gris medio, escala de UI.
- Presión de tableta, rotación de vista, importación SVG, WebP animado.
- Asociación de archivos, .deb, firma de código (si aplica), auto-actualización (opcional).
- Revisión de accesibilidad y rendimiento.
