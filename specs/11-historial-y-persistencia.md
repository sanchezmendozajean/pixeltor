# 11 · Historial, autoguardado y preferencias

## Deshacer / rehacer

- Patrón **Command**: cada comando implementa `do()`, `undo()`, `label` (texto i18n para el panel Historial), `mergeWith?(next)` (fusionar comandos consecutivos, p. ej. cambios de un mismo parámetro en < 1 s) y `memorySize`.
- Cambios de modelo (no píxeles): se guardan como **parches** (antes/después) del sub-árbol afectado (p. ej. con `immer` patches o diff propio).
- Cambios de píxeles: se guardan como **teselas** (tiles de 64×64) del rectángulo sucio, antes y después, comprimidas en memoria (RLE simple o `fflate`).
- La selección (formas, anclas, píxeles) y la imagen/capa activa se guardan con cada entrada y se restauran al deshacer.
- Límite: 200 pasos o 512 MB (lo que llegue antes; configurable). Al superarlo se descartan los más antiguos.
- **Panel Historial**: lista de pasos con icono y nombre ("Trazo de lápiz", "Mover 3 anclas", "Sombra paralela: desenfoque 2 → 3", "Estampar Rectángulo 3"); clic vuelve a ese estado; los pasos posteriores se ven atenuados hasta que se haga otra acción.
- Historial **por documento**, no global.

## Autoguardado y recuperación

- Cada 2 minutos (configurable; 0 = desactivado) y solo si hay cambios, el documento se guarda en `userData/recovery/<docId>.pixeltor` (en el proceso principal, sin bloquear la UI; los buffers se envían transferidos).
- Al iniciar tras un cierre inesperado: diálogo "Recuperar documentos" con miniatura, nombre, fecha y botones Recuperar / Descartar.
- Al cerrar con cambios sin guardar: diálogo Guardar / No guardar / Cancelar (Windows y Linux con orden de botones adecuado a cada plataforma).

## Preferencias (`userData/settings.json`)

| Sección | Opciones |
|---|---|
| General | Idioma (es/en), pantalla de inicio sí/no, documentos recientes (nº), instancia única |
| Interfaz | Tema (Oscuro, Gris medio, Claro), escala de UI (90–150 %), cabecera de visor fija/auto, marco de ventana nativo (Linux), animaciones de UI |
| Lienzo | Color del área de trabajo, tamaño y colores del tablero de transparencia, zoom mínimo para cuadrícula de píxeles, color de cuadrícula, color de guías, color de guías inteligentes |
| Herramientas | Incremento de teclado (px), pluma con añadir/eliminar automático, nuevas formas con apariencia básica, ángulos de pixel art |
| Rendimiento | Memoria de caché, memoria de historial, nº de workers, tamaño máximo experimental 4096 |
| Archivos | Autoguardado (min), crear .bak, carpeta de exportación por defecto |
| Atajos [F7] | Editor de atajos con búsqueda, conflictos y restaurar por defecto; exportar/importar JSON |

## Workspaces

- Un **workspace** guarda la disposición de paneles (qué paneles, dónde, tamaños, colapsados) y la disposición de visores por defecto.
- Incluidos: **Esenciales**, **Animación**, **Vectores**, **Mínimo**. El usuario puede crear, renombrar y restablecer.
- Selector de workspace en la parte derecha de la barra de título (como Illustrator).
