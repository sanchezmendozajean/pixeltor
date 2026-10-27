# Traspaso a Claude Code

## Requisitos previos

- `C:\Coding\pixeltor\specs\` (este directorio) y `C:\Coding\pixeltor\CLAUDE.md` presentes.
- Idealmente, `C:\Coding\pixeltor\design\` con la salida de Claude Design. Si aún no existe, Claude Code puede empezar F0 con los tokens de `specs/design/21-design-tokens.md` y ajustar después.
- Node.js LTS y Git instalados.

## Prompt inicial (copiar y pegar en Claude Code, dentro de `C:\Coding\pixeltor`)

```
Vamos a construir Pixeltor, un editor de pixel art con capas inteligentes (formas vectoriales que
se rasterizan pixel-perfect y efectos no destructivos), en Electron para Windows y Linux.

1. Lee CLAUDE.md y todo specs/ (empieza por specs/README.md). Si existe design/, úsalo como
   referencia visual obligatoria.
2. Antes de escribir código, dame un resumen corto de tu plan para F0 y F1 (specs/30-roadmap.md),
   las dependencias que vas a instalar y cualquier contradicción o duda que encuentres en las specs.
3. Cuando lo apruebe, inicializa el repositorio git e implementa F0. Haz commits pequeños y
   descriptivos. Al terminar F0, verifica los criterios de aceptación, actualiza CHANGELOG.md y
   detente para que revise.

No avances de fase sin mi confirmación.
```

## Prompts para fases siguientes

```
Implementa la fase F<n> de specs/30-roadmap.md. Relee los archivos de specs que la describen
(indícame cuáles) y el diseño correspondiente en design/. Empieza por el núcleo en src/core con
pruebas (golden tests cuando haya píxeles), luego la UI. Al final, verifica los criterios de
aceptación, ejecuta lint + tests + benchmarks relevantes y resume qué quedó pendiente.
```

## Si algo de las specs cambia

Edita el archivo de `specs/` correspondiente **antes** de pedir el cambio a Claude Code, y menciónalo: "actualicé specs/06-efectos.md: nuevo efecto X; impleméntalo".
