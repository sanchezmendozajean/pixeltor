# 10 · Formato de archivo `.pixeltor`

## Contenedor

Archivo **ZIP** (deflate) con extensión `.pixeltor` y tipo MIME `application/x-pixeltor`.

```
mi-sprite.pixeltor
├─ mimetype                    ← "application/x-pixeltor" (primer archivo, sin comprimir)
├─ manifest.json               ← versión de formato, app, lista de recursos, checksums
├─ document.json               ← modelo completo (sin buffers de píxeles)
├─ rasters/
│  ├─ <rasterId>.png           ← ráster base de cada capa (PNG RGBA, sin pérdidas)
│  └─ ...
├─ thumbnails/
│  ├─ document.png             ← 256×256 máx, para el explorador/inicio
│  └─ <imageId>.png            ← miniaturas por imagen (caché, regenerables)
└─ ui.json                     ← opcional: disposición de visores, zoom, imagen activa
```

## Reglas

- `document.json` sigue los tipos de `02-modelo-de-documento.md`; los `RasterRef.id` apuntan a `rasters/<id>.png`.
- Rásters completamente transparentes **no** se guardan (se omite el PNG y se marca `empty: true`).
- `manifest.json`:
  ```json
  {
    "formatVersion": "1.0.0",
    "app": "Pixeltor 0.1.0",
    "createdAt": "2026-10-27T15:00:00Z",
    "files": { "document.json": { "sha256": "..." }, "rasters/abc.png": { "sha256": "..." } }
  }
  ```
- **Versionado** semver: el cambio de *minor* añade campos opcionales; *major* requiere migración. `src/core/io/migrations/` contiene funciones `migrate_1_to_2(doc)` encadenables. Abrir un archivo de versión mayor a la soportada muestra un error claro sin corromper nada.
- **Guardado atómico**: escribir en `archivo.pixeltor.tmp` y renombrar; conservar `archivo.pixeltor.bak` del guardado anterior (preferencia, activado por defecto).
- **Tolerancia**: si un ráster falta o falla su checksum, se carga vacío y se informa al usuario con la lista de capas afectadas.
- Los efectos o tipos de forma desconocidos (archivo de una versión futura minor) se conservan como datos opacos y se muestran como "Efecto no compatible" (desactivado), sin perderse al guardar.

## Asociación de archivos

- Windows: registro de la extensión `.pixeltor` con icono propio en el instalador NSIS; doble clic abre el documento (instancia única: si la app está abierta, abre una pestaña nueva).
- Linux: archivo `.desktop` + tipo MIME (`shared-mime-info`) en el `.deb`; AppImage con integración opcional.
- Miniaturas en el explorador: futuro (requiere thumbnailer nativo).
