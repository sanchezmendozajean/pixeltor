// Núcleo de Pixeltor: TypeScript puro, sin DOM, Vue ni Electron.
// Corre en Node y en Workers.

export { FORMAT_VERSION } from './model/version'
export * from './model/types'
export * from './model/document'
export { newId } from './model/ids'
export { Bitmap, rgba, type Rect } from './raster/bitmap'
export { PixelMask, type MaskOp, type FloatingPixels } from './raster/mask'
export { compositeOver } from './raster/blend'
export { composeImage, effectsReach } from './render/compose'
export * from './effects/registry'
export * from './effects/types'
export * from './effects/region'
export { DocumentSession, Transaction, type ChangeEvent, type SelectionState } from './session'
export {
  Stroke,
  bucketFill,
  pickColor,
  wandMask,
  paintBlockReason,
  type StrokeOptions
} from './tools/paint'
export * from './tools/selection'
export { encodePng, decodePng, scaleNearest } from './io/png'
export { saveDocument, loadDocument, exportImagePng, FormatError } from './io/pixeltor'
export { brushOffsets, linePoints } from './raster/draw'
export * from './model/shapes'
export * from './tools/shapes'
export {
  renderShape,
  renderShapeCached,
  renderShapeRegion,
  pixelBounds,
  shapeAlphaAt,
  shapeLines,
  type ShapeBitmap
} from './render/shape'
export { ellipseOutline, ellipseMasks } from './raster/ellipse'
export { fillPolygons } from './raster/scan'
export * from './tools/paths'
export { apply, invert, multiply, IDENTITY, translation } from './geometry/geometry'
export { colorAt, ditherThreshold, gradientSampler, gradientT, sortedStops } from './render/paint'
export { defaultGradient } from './render/shape'
export * from './tools/align'
export * from './tools/snap'
export * from './palette/palette'
export * from './palette/library'
export * from './tools/palettes'
export * from './raster/symmetry'
export * from './tools/pathops'
export * from './effects/edit'
export * from './effects/async'
export * from './tools/images'
