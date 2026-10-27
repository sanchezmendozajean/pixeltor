/* Pixeltor · pt-data.js — iconos, contenido de ejemplo y ayudantes compartidos por las pantallas del prototipo.
   Expone window.PT. Todo es determinista: el mismo código produce los mismos píxeles. */
(function () {
/*ICONS-BEGIN*/
var ICONS = {
  // Herramientas — rejilla 20, trazo 1.5
  sel:{g:20,d:'M5.5 3.5v12.5l3.4-3.3 2.4 5 2.1-1-2.4-4.9h4.6z'},
  dsel:{g:20,d:'M4.5 3.5v11l3-2.9 2.1 4.4 1.8-.9-2.1-4.3h4.2z M13.5 13.5h4v4h-4z'},
  groupSel:{g:20,d:'M4.5 3.5v11l3-2.9 2.1 4.4 1.8-.9-2.1-4.3h4.2z M15.5 12v6 M12.5 15h6'},
  marquee:{g:20,d:'M3.5 7V4.5H6 M9 4.5h2 M14 4.5h2.5V7 M16.5 10v1 M16.5 13v2.5H14 M11 15.5H9 M6 15.5H3.5V13 M3.5 10v1'},
  marqueeEll:{g:20,d:'M10 4.5c-1.2 0-2.3.2-3.2.6 M13.2 5.1c1.9.7 3.3 2 3.3 3.6 M16.4 11.6c-.6 1.6-2.4 2.8-4.7 3.3 M8.3 14.9c-2.3-.5-4.1-1.7-4.7-3.3 M3.6 8.7c0-1.6 1.4-2.9 3.2-3.6'},
  lasso:{g:20,d:'M10 3.5c4.1 0 7 1.9 7 4.5s-2.9 4.5-7 4.5-7-1.9-7-4.5 2.9-4.5 7-4.5z M6.2 11.8c-.9 1.2-.6 2.6.8 3.1 1.3.5 1.4 1.8-.3 2.6'},
  polyLasso:{g:20,d:'M4 6.5l6-3 7 3.5-2.5 5.5H5.5z M6 12.5c-.8 1.2-.4 2.6 1 3 1.2.4 1.2 1.6-.3 2.3'},
  wand:{g:20,d:'M3.5 16.5l8-8 M10.5 7.5l2 2 M15 2.5v3 M13.5 4h3',f:'M14 9h2v2h-2z M9 3h2v2H9z'},
  pen:{g:20,d:'M10 2.5l5 7-2.5 5.5h-5L5 9.5z M10 2.5v6 M7 17.5h6 M11.2 9.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z'},
  addAnchor:{g:20,d:'M8.5 2.5l4.5 6.5-2.2 5h-4.6L4 9z M8.5 2.5v5.5 M15.5 12v6 M12.5 15h6'},
  delAnchor:{g:20,d:'M8.5 2.5l4.5 6.5-2.2 5h-4.6L4 9z M8.5 2.5v5.5 M12.5 15h6'},
  convAnchor:{g:20,d:'M3.5 16.5L10 5l6.5 11.5 M8.5 3.5h3v3h-3z'},
  vpencil:{g:20,d:'M4.5 14.5c2.5-5 5-1 7.5-5 1.4-2.3 2.4-3.6 3.5-4.5 M2.5 13.5h3v3h-3z M14.5 3h3v3h-3z'},
  line:{g:20,d:'M4.5 15.5l11-11'},
  rect:{g:20,d:'M3.5 5.5h13v9h-13z'},
  ellipse:{g:20,d:'M17 10c0 3-3.1 5.5-7 5.5S3 13 3 10s3.1-5.5 7-5.5 7 2.5 7 5.5z'},
  polygon:{g:20,d:'M10 3l6 3.5v7L10 17l-6-3.5v-7z'},
  star:{g:20,d:'M10 3l2 5 5.2.2-4.1 3.3 1.5 5.1-4.6-3-4.6 3 1.5-5.1-4.1-3.3L8 8z'},
  pencil:{g:20,d:'M7.5 12.5l7-7 2.5 2.5-7 7z M12.5 7.5l2.5 2.5',f:'M3.5 15.5h2v2h-2z M5.5 13.5h2v2h-2z'},
  brush:{g:20,d:'M17 3.5l-6.5 6.5 M10.5 10l1.5 1.5c-.3 2.4-2.2 4.5-6 4.5.3-3.6 2-5.7 4.5-6z',f:'M3 15h2v2H3z'},
  shade:{g:20,d:'M17 3.5l-6.5 6.5 M10.5 10l1.5 1.5c-.3 2.4-2.2 4.5-6 4.5.3-3.6 2-5.7 4.5-6z',f:'M2 3h2v2H2z M4 3h2v2H4z M2 5h2v2H2z'},
  eraser:{g:20,d:'M3.5 12.5l7-7 5.5 5.5-5 5h-4z M7 9l5.5 5.5 M11.5 16h5',f:'M17 13h2v2h-2z'},
  bucket:{g:20,d:'M3.5 9.5l6-6 6 6-6 6z M3.5 9.5h12 M7 6L4.5 3.5',f:'M16.5 12h2v2h-2z M16.5 15h2v2h-2z'},
  replaceColor:{g:20,d:'M3.5 9.5l6-6 6 6-6 6z M3.5 9.5h12 M14 15.5h4.5 M17 14l1.5 1.5-1.5 1.5',f:'M16.5 10h2v2h-2z'},
  gradient:{g:20,d:'M3.5 4.5h13v11h-13z',f:'M5 6h2v2H5zM5 8h2v2H5zM5 10h2v2H5zM5 12h2v2H5zM7 6h2v2H7zM7 10h2v2H7zM9 8h2v2H9zM9 12h2v2H9zM11 6h2v2h-2zM13 10h2v2h-2z'},
  eyedrop:{g:20,d:'M12.5 4.5l1.8-1.8a1.9 1.9 0 0 1 2.7 2.7l-1.8 1.8 M11 4l5 5 M13.5 7.5l-7.5 7.5-2.5.5.5-2.5 7.5-7.5'},
  hand:{g:20,d:'M7 10.5V5a1.2 1.2 0 0 1 2.4 0v4.5 M9.4 9V3.8a1.2 1.2 0 0 1 2.4 0V9 M11.8 9V4.8a1.2 1.2 0 0 1 2.4 0V10 M14.2 10V7a1.2 1.2 0 0 1 2.4 0v5c0 3.3-2.4 5.5-5.4 5.5h-1.1c-1.6 0-2.8-.7-3.7-1.9L3.6 12.1a1.3 1.3 0 0 1 2-1.6L7 12'},
  zoom:{g:20,d:'M14 8.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z M12.4 12.4L17 17'},
  screenMode:{g:20,d:'M3.5 4.5h13v11h-13z M3.5 7.5h13'},
  // Paneles — rejilla 16, trazo 1.25
  props:{g:16,d:'M2.5 4.5h3 M9.5 4.5h4 M2.5 11.5h7 M12.5 11.5h1 M7.5 3v3 M11 10v3'},
  layers:{g:16,d:'M8 2.5l5.5 3-5.5 3-5.5-3z M2.5 8.5l5.5 3 5.5-3 M2.5 11l5.5 3 5.5-3'},
  appearance:{g:16,d:'M2.5 3h3v3h-3z M2.5 10h3v3h-3z M8 4.5h5.5 M8 8h5.5 M8 11.5h5.5'},
  color:{g:16,d:'M8 2.5a5.5 5.5 0 0 0 0 11c1 0 1.5-.6 1.5-1.3 0-1-.8-1.2-.8-2 0-.7.6-1.2 1.3-1.2h1.3c1.4 0 2.2-1 2.2-2.3C13.5 4.4 11.2 2.5 8 2.5z',f:'M4.5 6.5H6V8H4.5z M7 4h1.5v1.5H7z M5 9.5h1.5V11H5z'},
  swatches:{g:16,d:'M2.5 2.5h4.5v4.5H2.5z M9 2.5h4.5v4.5H9z M2.5 9h4.5v4.5H2.5z M9 9h4.5v4.5H9z'},
  navigator:{g:16,d:'M2.5 3.5h11v9h-11z M6 6h4.5v3.5H6z'},
  align:{g:16,d:'M2.5 2v12 M5 4.5h8V7H5z M5 9h5v2.5H5z'},
  stroke:{g:16,d:'M2.5 3.5h11 M2.5 7h11',f:'M2 10h12v2.5H2z'},
  gradientp:{g:16,d:'M2.5 2.5h11v11h-11z',f:'M4 4h2v2H4zM4 6h2v2H4zM4 8h2v2H4zM4 10h2v2H4zM6 4h2v2H6zM6 8h2v2H6zM8 6h2v2H8zM8 10h2v2H8zM10 4h2v2h-2z'},
  frames:{g:16,d:'M2.5 3.5h11v9h-11z M6.2 3.5v9 M9.8 3.5v9'},
  preview:{g:16,d:'M2.5 3.5h11v9h-11z',f:'M6.5 5.8v4.4L10.2 8z'},
  styles:{g:16,d:'M8 2.5l1.4 3.6 3.6 1.4-3.6 1.4L8 12.5 6.6 8.9 3 7.5l3.6-1.4z M12.5 11v3 M11 12.5h3'},
  pathfinder:{g:16,d:'M2.5 2.5h7v7h-7z M6.5 6.5h7v7h-7z'},
  history:{g:16,d:'M2.5 8a5.5 5.5 0 1 0 1.6-3.9 M2.5 2.5v2.5H5 M8 5v3l2 1.5'},
  // Interfaz — rejilla 16, trazo 1.25
  eye:{g:16,d:'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'},
  eyeOff:{g:16,d:'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z M2.5 13.5l11-11'},
  lock:{g:16,d:'M4 7.5h8v6H4z M5.5 7.5v-2a2.5 2.5 0 0 1 5 0v2'},
  unlock:{g:16,d:'M4 7.5h8v6H4z M5.5 7.5v-2a2.5 2.5 0 0 1 4.9-.7'},
  plus:{g:16,d:'M8 3.5v9 M3.5 8h9'},
  minus:{g:16,d:'M3.5 8h9'},
  trash:{g:16,d:'M3 4.5h10 M6.5 4.5V3h3v1.5 M4.5 4.5l.7 9h5.6l.7-9 M7 7v4 M9 7v4'},
  menu:{g:16,d:'M3 4.5h10 M3 8h10 M3 11.5h10'},
  chevDown:{g:16,d:'M4.5 6.5L8 10l3.5-3.5'},
  chevUp:{g:16,d:'M4.5 9.5L8 6l3.5 3.5'},
  chevRight:{g:16,d:'M6.5 4.5L10 8l-3.5 3.5'},
  chevLeft:{g:16,d:'M9.5 4.5L6 8l3.5 3.5'},
  close:{g:16,d:'M4.5 4.5l7 7 M11.5 4.5l-7 7'},
  link:{g:16,d:'M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.8.8 M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.8-.8'},
  newLayer:{g:16,d:'M2.5 5.5h8v8h-8z M5.5 2.5h8v8 M6.5 7.5v4 M4.5 9.5h4'},
  fromSel:{g:16,d:'M2.5 4.5v-2h2 M6.5 2.5h2 M10.5 2.5V4 M2.5 6.5v2 M2.5 10.5h2 M12 8.5v5 M9.5 11h5'},
  folder:{g:16,d:'M2 4h4l1.5 1.5h6.5v7H2z'},
  folderOpen:{g:16,d:'M2 12.5V4h4l1.5 1.5H13V7 M2 12.5L4 7.5h11l-2 5z'},
  newDoc:{g:16,d:'M4 2.5h5l3 3v8H4z M9 2.5v3h3 M8 7.5v4 M6 9.5h4'},
  file:{g:16,d:'M4 2.5h5l3 3v8H4z M9 2.5v3h3'},
  save:{g:16,d:'M3 2.5h8l2.5 2.5v8.5H3z M5.5 2.5v3h4v-3 M5 13.5v-4h6v4'},
  exportIc:{g:16,d:'M8 10V2.5 M5 5.5l3-3 3 3 M3 9v4.5h10V9'},
  settings:{g:16,d:'M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M8 2v1.6 M8 12.4V14 M2 8h1.6 M12.4 8H14 M3.8 3.8l1.1 1.1 M11.1 11.1l1.1 1.1 M3.8 12.2l1.1-1.1 M11.1 4.9l1.1-1.1'},
  keyboard:{g:16,d:'M1.5 4.5h13v7h-13z M4.5 9.5h7',f:'M3.5 6h1.5v1.5H3.5z M6 6h1.5v1.5H6z M8.5 6H10v1.5H8.5z M11 6h1.5v1.5H11z'},
  monitor:{g:16,d:'M2 3h12v8H2z M6 13.5h4 M8 11v2.5'},
  canvasIc:{g:16,d:'M2.5 2.5h11v11h-11z',f:'M2.5 2.5h3v3h-3z M8.5 2.5h3v3h-3z M5.5 5.5h3v3h-3z M2.5 8.5h3v3h-3z M8.5 8.5h3v3h-3z'},
  cpu:{g:16,d:'M4.5 4.5h7v7h-7z M6.5 6.5h3v3h-3z M6 2v2.5 M10 2v2.5 M6 11.5V14 M10 11.5V14 M2 6h2.5 M2 10h2.5 M11.5 6H14 M11.5 10H14'},
  globe:{g:16,d:'M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z M2.5 8h11 M8 2.5c1.6 1.6 2.4 3.4 2.4 5.5S9.6 11.9 8 13.5C6.4 11.9 5.6 10.1 5.6 8S6.4 4.1 8 2.5z'},
  sparkle:{g:16,d:'M8 2v3 M8 11v3 M2 8h3 M11 8h3 M4.2 4.2l1.6 1.6 M10.2 10.2l1.6 1.6 M4.2 11.8l1.6-1.6 M10.2 5.8l1.6-1.6'},
  pin:{g:16,d:'M6 2.5h4 M6.5 2.5v4L4.5 9h7l-2-2.5v-4 M8 9v4.5'},
  external:{g:16,d:'M9 2.5h4.5V7 M13.5 2.5L7.5 8.5 M11.5 9.5v4h-9v-9h4'},
  layoutV:{g:16,d:'M2.5 3h11v10h-11z M8 3v10'},
  layoutH:{g:16,d:'M2.5 3h11v10h-11z M2.5 8h11'},
  stamp:{g:16,d:'M6.5 2.5h3V6L12 7.5V10H4V7.5L6.5 6z M3 12.5h10'},
  flipH:{g:16,d:'M8 2v12 M6 4.5l-3.5 7H6z M10 4.5l3.5 7H10z'},
  flipV:{g:16,d:'M2 8h12 M4.5 6l7-3.5V6z M4.5 10l7 3.5V10z'},
  rotate:{g:16,d:'M12.5 8a4.5 4.5 0 1 1-1.3-3.2 M11.5 2v3h-3'},
  alL:{g:16,d:'M2.5 2v12 M5 4.5h8V7H5z M5 9h5v2.5H5z'},
  alCH:{g:16,d:'M8 2v12 M3.5 4.5h9V7h-9z M5.5 9h5v2.5h-5z'},
  alR:{g:16,d:'M13.5 2v12 M3 4.5h8V7H3z M6 9h5v2.5H6z'},
  alT:{g:16,d:'M2 2.5h12 M4.5 5H7v8H4.5z M9 5h2.5v5H9z'},
  alCV:{g:16,d:'M2 8h12 M4.5 3.5H7v9H4.5z M9 5.5h2.5v5H9z'},
  alB:{g:16,d:'M2 13.5h12 M4.5 3H7v8H4.5z M9 6h2.5v5H9z'},
  gridPx:{g:16,d:'M2 5.5h12 M2 10.5h12 M5.5 2v12 M10.5 2v12'},
  tiles:{g:16,d:'M2.5 2.5h11v11h-11z M8 2.5v11 M2.5 8h11'},
  paths:{g:16,d:'M3.5 12C5 6 10 10 12.5 4',f:'M2.5 11h2v2h-2z M11.5 3h2v2h-2z'},
  onion:{g:16,d:'M9.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M8 4.6a3.5 3.5 0 1 1 0 6.8'},
  mosaic:{g:16,d:'M2.5 2.5h11v11h-11z M6.2 2.5v11 M9.8 2.5v11 M2.5 6.2h11 M2.5 9.8h11'},
  play:{g:16,d:'M5 3.5v9l7-4.5z',f:'M5 3.5v9l7-4.5z'},
  pause:{g:16,f:'M4.5 3.5H7v9H4.5z M9 3.5h2.5v9H9z'},
  first:{g:16,d:'M4 3.5v9',f:'M12.5 3.5v9L6 8z'},
  last:{g:16,d:'M12 3.5v9',f:'M3.5 3.5v9L10 8z'},
  prevF:{g:16,d:'M10.5 4L6.5 8l4 4'},
  nextF:{g:16,d:'M5.5 4l4 4-4 4'},
  loop:{g:16,d:'M3 8.5V7a2.5 2.5 0 0 1 2.5-2.5H12 M10.5 3L12 4.5 10.5 6 M13 7.5V9a2.5 2.5 0 0 1-2.5 2.5H4 M5.5 13L4 11.5 5.5 10'},
  more:{g:16,f:'M3 7h2v2H3z M7 7h2v2H7z M11 7h2v2h-2z'},
  search:{g:16,d:'M10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z M9.6 9.6l3.9 3.9'},
  magnet:{g:16,d:'M3.5 2.5h3v5a1.5 1.5 0 0 0 3 0v-5h3v5a4.5 4.5 0 0 1-9 0z M3.5 5h3 M9.5 5h3'},
  snapAnchor:{g:16,d:'M5.5 5.5h5v5h-5z M2 8h3.5 M10.5 8H14'},
  snapGuide:{g:16,d:'M5.5 2v12 M2 10.5h12'},
  snapCanvas:{g:16,d:'M2.5 2.5h11v11h-11z M8 6v4 M6 8h4'},
  swap:{g:16,d:'M4.5 11V7.5a3 3 0 0 1 3-3H11 M9.5 3L11 4.5 9.5 6 M3 9.5L4.5 11 6 9.5'},
  check:{g:16,d:'M3.5 8.5l3 3 6-6.5'},
  spinner:{g:16,d:'M13.5 8A5.5 5.5 0 1 1 8 2.5'},
  zoomPx:{g:16,d:'M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M10 10l3.5 3.5',f:'M5 5h2v2H5z M7 7h2v2H7z'},
  minimize:{g:16,d:'M3.5 8h9'},
  maximize:{g:16,d:'M3.5 3.5h9v9h-9z'},
  ellipse16:{g:16,d:'M13.5 8c0 2.5-2.5 4.5-5.5 4.5S2.5 10.5 2.5 8 5 3.5 8 3.5s5.5 2 5.5 4.5z'},
  rect16:{g:16,d:'M2.5 4.5h11v7h-11z'},
  rrect16:{g:16,d:'M5 3.5h6a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z'},
  polygon16:{g:16,d:'M8 2.5l5 3v5l-5 3-5-3v-5z'},
  star16:{g:16,d:'M8 2.5l1.6 3.6 3.9.3-3 2.6.9 3.8L8 10.8l-3.4 2 .9-3.8-3-2.6 3.9-.3z'},
  line16:{g:16,d:'M3.5 12.5l9-9'},
  path16:{g:16,d:'M3.5 12C5 6 10 10 12.5 4',f:'M2.5 11h2v2h-2z M11.5 3h2v2h-2z'},
  group16:{g:16,d:'M2.5 2.5h7v7h-7z M6.5 6.5h7v7h-7z'},
  pixels16:{g:16,f:'M2.5 2.5h3v3h-3z M10.5 2.5h3v3h-3z M6.5 6.5h3v3h-3z M2.5 10.5h3v3h-3z M10.5 10.5h3v3h-3z'},
  lockAlpha:{g:16,d:'M2.5 2.5h8v8h-8z M10 10.5h4V14h-4z M11 10.5v-1a1 1 0 0 1 2 0v1',f:'M2.5 2.5h4v4h-4z M6.5 6.5h4v4h-4z'},
  cursor:{g:16,d:'M4 2.5v10l2.6-2.4 1.7 3.9 1.6-.7-1.7-3.8h3.6z'},
  warning:{g:16,d:'M8 2.5l6 10.5H2z M8 6.5v3 M8 11.2v.1'},
  info:{g:16,d:'M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z M8 7.5V11 M8 5v.1'},
  eyedrop16:{g:16,d:'M10 3.5l1.3-1.3a1.6 1.6 0 0 1 2.3 2.3L12.3 5.8 M9 3l4 4 M11 5.3l-6.3 6.3-2.2.4.4-2.2 6.3-6.3'},
  anchorCorner:{g:16,d:'M2.5 13.5L8 5l5.5 8.5 M6.5 3.5h3v3h-3z'},
  anchorSmooth:{g:16,d:'M2.5 12.5C4 7 6 5 8 5s4 2 5.5 7.5 M2 5h12 M6.5 3.5h3v3h-3z'},
  scissors:{g:16,d:'M6 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M6 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M5.6 6.2L14 12 M5.6 9.8L14 4'},
  join:{g:16,d:'M2.5 11.5C4 6 6 6 7 8 M9 8c1-2 3-2 4.5 3.5 M6.5 6.5h3v3h-3z'},
  dither:{g:16,f:'M2 2h2v2H2zM6 2h2v2H6zM10 2h2v2h-2zM4 4h2v2H4zM8 4h2v2H8zM12 4h2v2h-2zM2 6h2v2H2zM6 6h2v2H6zM10 6h2v2h-2zM4 10h2v2H4zM10 10h2v2h-2zM2 12h2v2H2zM8 12h2v2H8z'},
  addStroke:{g:16,d:'M2.5 2.5h7v7h-7z M5 5h2v2H5z M12 9.5v5 M9.5 12h5'},
  addFill:{g:16,d:'M12 9.5v5 M9.5 12h5',f:'M2.5 2.5h7v7h-7z'},
  clear:{g:16,d:'M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z M4.1 11.9l7.8-7.8'},
  duplicate:{g:16,d:'M5.5 5.5h8v8h-8z M2.5 10.5v-8h8'},
  bringFront:{g:16,d:'M5.5 5.5h8v8h-8z M2.5 10.5v-8h8',f:'M5.5 5.5h8v8h-8z'},
  sendBack:{g:16,d:'M5.5 5.5h8v8h-8z',f:'M2.5 2.5h8v3h-5v5h-3z'}
};
/*ICONS-END*/

var PAL = {k:'#1B1526',v:'#0E0B14',d:'#4F5D75',H:'#8796AB',h:'#C7D0DC',w:'#EEF3F8',p:'#E04B55',P:'#8F2638',c:'#3D6BD1',C:'#263F86',b:'#7A4A2B',l:'#5A3A2A',g:'#F2C14E',e:'#2F9E74',
  z:'rgba(12,8,20,.38)',F:'#22314A',G:'#5BAE3A',D:'#3C7A2A',y:'#8CCF4D',n:'#FF6FB5',A:'#8DB6FF',
  q:'rgba(27,21,38,.6)',j:'rgba(61,139,255,.45)',r:'rgba(255,77,77,.32)',u:'rgba(77,141,255,.32)',s:'#6B4A2E'};
var SWATCH_ORDER = ['k','v','d','H','h','w','p','P','c','C','b','l','g','e','G','D','F'];

var TOP = ['','......kkk','.....kpppk','....kppPppk','....kpPPk..kkkkkkk','.....kPk..khhhhhhhk','......kPkkhhhhhhhhhk','.......kkkhhhhhhhhHk','.........kHhhhhvvvvk','.........kHHhhhhHHHk','.........kHHHhhvvvvk','.........kdHHHHHHHdk','..........kddHHHHddk','..........kkddddddkk','........kHHkccccccckHHk','.......kHhhkcCccccckhhHk','.......kHHHkcccccCckHHHk','........kdkkccccccckllk','........kdkbbbbgbbbkllk','........kkcccCccccCck','.........kcCcccccCcck','.........kkkkkkkkkkkk'];
var LEGS = {
  A:['..........kHdk..kHdk','..........kHdk..kHdk','..........kHdk..kHdk','..........kHdk..kHdk','.........kllllk.kllllk','.........kllllk.kllllk','.........kkkkkk.kkkkkk'],
  B:['..........kHdk...kHdk','.........kHdk.....kHdk','........kHdk.......kHdk','........kHdk.......kHdk','.......kllllk......kllllk','.......kkkkkk......kkkkkk',''],
  C:['..........kHdkkHdk','..........kHdkkHdk','..........kHdkkllllk','..........kHdkkkkkkk','.........kllllk','.........kllllk','.........kkkkkk'],
  D:['...........kHdk.kHdk','..........kHdk...kHdk','.........kHdk.....kHdk','.........kHdk.....kHdk','........kllllk.....kllllk','........kkkkkk.....kkkkkk','']
};
var POSES = ['A','B','C','D','A','D','C','B'];
var DURS = [100,100,150,100,100,100,150,100];
var BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];

function blank(w,h){ w=w||32; h=h||w; var g=[]; for(var y=0;y<h;y++){ var r=[]; for(var x=0;x<w;x++) r.push('.'); g.push(r);} return g; }
function put(g,rows,y0){ rows.forEach(function(row,i){ for(var x=0;x<g[0].length&&x<row.length;x++){ if(row[x]!=='.') g[y0+i][x]=row[x]; } }); }
function over(dst,src){ for(var y=0;y<dst.length;y++) for(var x=0;x<dst[0].length;x++) if(src[y][x]!=='.') dst[y][x]=src[y][x]; }
function compose(list){ var o=blank(list[0][0].length,list[0].length); list.forEach(function(l){ over(o,l); }); return o; }
function shift(g,dx,dy,ch){ var o=blank(g[0].length,g.length); for(var y=0;y<g.length;y++) for(var x=0;x<g[0].length;x++){ if(g[y][x]==='.'||g[y][x]==='z') continue; var X=x+dx,Y=y+dy; if(X>=0&&Y>=0&&X<g[0].length&&Y<g.length) o[Y][X]=ch; } return o; }
function tint(g,ch){ var o=blank(g[0].length,g.length); for(var y=0;y<g.length;y++) for(var x=0;x<g[0].length;x++) if(g[y][x]!=='.'&&g[y][x]!=='z') o[y][x]=ch; return o; }

function knight(pose){
  var sombra=blank();
  for(var y=26;y<32;y++) for(var x=0;x<32;x++){ var dx=(x+.5-15.5)/7, dy=(y+.5-29.5)/1.6; if(dx*dx+dy*dy<=1) sombra[y][x]='z'; }
  var cuerpo=blank(); put(cuerpo,TOP,0); put(cuerpo,LEGS[pose||'A'],22);
  var inE=function(x,y){ var dx=(x+.5-7)/4, dy=(y+.5-19)/5; return dx*dx+dy*dy<=1; };
  for(var y2=12;y2<26;y2++) for(var x2=1;x2<13;x2++){
    if(!inE(x2,y2)) continue;
    var edge=!inE(x2-1,y2)||!inE(x2+1,y2)||!inE(x2,y2-1)||!inE(x2,y2+1);
    var ring=!edge&&(!inE(x2-2,y2)||!inE(x2+2,y2)||!inE(x2,y2-2)||!inE(x2,y2+2));
    var cross=((x2===6||x2===7)&&y2>=16&&y2<=21)||(y2===18&&x2>=5&&x2<=8);
    cuerpo[y2][x2]=edge?'k':ring?'H':cross?'g':'e';
  }
  cuerpo[17][22]='l'; cuerpo[18][22]='l'; cuerpo[17][23]='b'; cuerpo[16][23]='g'; cuerpo[17][24]='g';
  for(var i=0;i<7;i++){ cuerpo[16-i][24+i]='w'; if(i>0) cuerpo[17-i][24+i]='H'; }
  cuerpo[9][31]='w';
  var contorno=blank();
  var solid=function(x,y){ if(x<0||y<0||x>31||y>31) return false; var c=cuerpo[y][x]; return c!=='.'&&c!=='k'; };
  for(var y3=0;y3<32;y3++) for(var x3=0;x3<32;x3++){ if(cuerpo[y3][x3]!=='.') continue; if(solid(x3-1,y3)||solid(x3+1,y3)||solid(x3,y3-1)||solid(x3,y3+1)) contorno[y3][x3]='k'; }
  var luz=blank();
  [[12,6],[13,6],[11,7],[12,7],[9,15],[20,15],[13,15],[11,8]].forEach(function(p){ var c=cuerpo[p[1]][p[0]]; if(c!=='.'&&c!=='k') luz[p[1]][p[0]]='w'; });
  var comp=compose([sombra,cuerpo,contorno,luz]);
  return {sombra:sombra,cuerpo:cuerpo,contorno:contorno,luz:luz,comp:comp,body:compose([cuerpo,contorno,luz])};
}

// Tile de hierba 16×16 (documento hierba.pixeltor): ráster + formas "Piedra" (elipse) y "Flor" (estrella)
function grass(){
  var g=blank(16,16);
  for(var y=0;y<16;y++) for(var x=0;x<16;x++){ var h=(x*7+y*13+((x*y)%5)*3+(x^y))%11; g[y][x]=h<4?'D':h<9?'G':'y'; }
  [[2,2],[9,4],[13,9],[5,12],[11,14],[1,8]].forEach(function(p){ g[p[1]][p[0]]='y'; if(p[1]>0) g[p[1]-1][p[0]]='y'; });
  var inS=function(x,y){ var dx=(x+.5-11)/3, dy=(y+.5-11)/2; return dx*dx+dy*dy<=1; };
  for(var y2=8;y2<14;y2++) for(var x2=7;x2<15;x2++){ if(!inS(x2,y2)) continue; var edge=!inS(x2-1,y2)||!inS(x2+1,y2)||!inS(x2,y2+1)||!inS(x2,y2-1); g[y2][x2]=edge?'d':(y2<10?'h':'H'); }
  [[4,3],[3,4],[5,4],[4,5]].forEach(function(p){ g[p[1]][p[0]]='n'; }); g[4][4]='g';
  return g;
}

// Icono de app 16/32/48 (documento icono-app.pixeltor): rectángulo redondeado con degradado tramado, 2 contornos, sombra y resplandor
function appIcon(N){
  N=N||32; var S=32/N, g=blank(N,N);
  var inRR=function(x,y){ var px=(x+.5)*S, py=(y+.5)*S; if(px<4||px>28||py<4||py>28) return false; var dx=Math.max(9-px,0,px-23), dy=Math.max(9-py,0,py-23); return dx*dx+dy*dy<=25; };
  var inside=function(x,y){ return x>=0&&y>=0&&x<N&&y<N&&inRR(x,y); };
  var glyph=['wwwwww','ww..ww','ww..ww','wwwwww','ww....','ww....','ww....'];
  var fillC=['A','c','C'];
  var outer=blank(N,N), fillL=blank(N,N), center=blank(N,N), glow=blank(N,N), glyphL=blank(N,N);
  for(var y=0;y<N;y++) for(var x=0;x<N;x++){
    var th=(BAYER[y%4][x%4]+.5)/16;
    if(inside(x,y)){
      var t=((y+.5)*S-4)/24, a,b,u; if(t<.5){a=0;b=1;u=t*2;}else{a=1;b=2;u=(t-.5)*2;}
      fillL[y][x]=fillC[u>th?b:a];
      var edge=!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1);
      if(edge){ var t2=((x+.5)*S-4)/24; center[y][x]=t2>th?'n':'g'; }
      var gx=Math.floor(((x+.5)*S-10)/2), gy=Math.floor(((y+.5)*S-9)/2);
      if(gy>=0&&gy<glyph.length&&gx>=0&&gx<6&&glyph[gy][gx]==='w') glyphL[y][x]='w';
    } else {
      var n4=inside(x-1,y)||inside(x+1,y)||inside(x,y-1)||inside(x,y+1);
      var n8=n4||inside(x-1,y-1)||inside(x+1,y+1)||inside(x-1,y+1)||inside(x+1,y-1)||inside(x-2,y)||inside(x+2,y)||inside(x,y-2)||inside(x,y+2);
      if(n4) outer[y][x]='k'; else if(n8&&((x+y)%2===0)) glow[y][x]='j';
    }
  }
  var shapeAll=compose([outer,fillL]);
  var sh=shift(shapeAll,1,2,'q');
  return {comp:compose([glow,sh,outer,fillL,center,glyphL]), layers:{glow:glow,shadow:sh,outer:outer,fill:fillL,center:center,glyph:glyphL}};
}

var COFRE=['','','...kkkkkkkkkk...','..kbbbbbbbbbbk..','..kbllllllllbk..','..kbbbbbbbbbbk..','..kkkkkggkkkkk..','..kbbbbgwbbbbk..','..kbllllggllbk..','..kbbbbbbbbbbk..','..kbllllllllbk..','..kbbbbbbbbbbk..','..kkkkkkkkkkkk..','...zzzzzzzzzz...'];
function cofre(){ var g=blank(16,16); put(g,COFRE,0); return g; }

function sh(g,s,ox,oy){
  ox=ox||0; oy=oy||0; var out=[];
  for(var y=0;y<g.length;y++) for(var x=0;x<g[0].length;x++){ var c=g[y][x]; if(c!=='.') out.push(((x+1)*s+ox)+'px '+((y+1)*s+oy)+'px 0 0 '+PAL[c]); }
  return out.length?out.join(','):'none';
}
// Repite una rejilla nx×ny veces (modo mosaico)
function tile(g,nx,ny){ var w=g[0].length,h=g.length,o=blank(w*nx,h*ny); for(var y=0;y<h*ny;y++) for(var x=0;x<w*nx;x++) o[y][x]=g[y%h][x%w]; return o; }

function icons(){ var o={}; Object.keys(ICONS).forEach(function(k){ o[k]={d:ICONS[k].d||'',f:ICONS[k].f||''}; }); return o; }

var TOOLS=[
  ['sel','Selección','V',0],['dsel','Selección directa','A',1],null,
  ['marquee','Marco rectangular','S',1],['lasso','Lazo','Q',1],['wand','Varita mágica','W',0],null,
  ['pen','Pluma','P',1],['vpencil','Lápiz vectorial','Mayús+N',0],['SHAPE','','',1],null,
  ['pencil','Lápiz','N',0],['brush','Pincel','B',1],['eraser','Borrador','E',0],['bucket','Bote de pintura','K',1],['gradient','Degradado','G',0],['eyedrop','Cuentagotas','I',0],null,
  ['hand','Mano','H',0],['zoom','Zoom','Z',0]
];
var SHAPES={rect:['Rectángulo','M'],ellipse:['Elipse','L'],polygon:['Polígono','—'],star:['Estrella','—'],line:['Línea','\\']};
function tools(active,shape,pressing){
  shape=shape||'rect';
  return TOOLS.map(function(t){
    if(!t) return {btn:false,sep:true};
    var k=t[0],label=t[1],key=t[2];
    if(k==='SHAPE'){ k=shape; label=SHAPES[shape][0]; key=SHAPES[shape][1]; }
    var cls='pt-toolbtn'+(t[3]?' has-fly':'')+(k===active?' is-active':'')+(k===pressing?' is-pressing':'');
    return {btn:true,sep:false,k:k,cls:cls,label:label+(key!=='—'?' ('+key+')':''),tip:label+(key!=='—'?'  '+key:''),d:ICONS[k].d||'',f:ICONS[k].f||''};
  });
}

var MENUS=['Archivo','Editar','Objeto','Capa','Efecto','Imagen','Seleccionar','Ver','Ventana','Ayuda'];
function menus(open){ return MENUS.map(function(m){ return {name:m,cls:'pt-menuitem'+(m===open?' is-open':'')}; }); }

// Filas del panel Capas del caballero
function layerRows(o){
  o=o||{}; var ic=icons(), K=knight(o.pose||'A');
  var fondo=blank(); for(var y=0;y<32;y++) for(var x=0;x<32;x++) fondo[y][x]='F';
  var cur=o.current||'Cuerpo', sel=o.sel||null, exp=o.expanded===undefined?'Cuerpo':o.expanded;
  var L=function(name,color,thumb,fx,extra){ extra=extra||{};
    var hasSel=(name==='Cuerpo'&&sel&&sel!=='layer')||(name===cur&&sel==='layer');
    return {isLayer:true,isSub:false,name:name,color:color,thumb:sh(thumb,1),fx:!!fx,
      cls:'pt-lrow'+(name===cur?' is-current':'')+(extra.hidden?' is-hidden':''),
      eye:extra.hidden?ic.eyeOff.d:ic.eye.d, lock:extra.lock?ic.lock.d:'', chev:(exp===name?ic.chevDown.d:ic.chevRight.d),
      target:'pt-target'+(hasSel?' is-sel':''), selsq:'pt-selsq'+(hasSel?'':' pt-selsq--empty')}; };
  var S=function(name,kind,icon,fx,isSel){ return {isLayer:false,isSub:true,name:name,kind:kind,color:'#3FD07F',fx:!!fx,
      cls:'pt-lrow pt-srow'+(isSel?' is-selected':''), eye:ic.eye.d, iconD:ic[icon].d, iconF:ic[icon].f,
      target:'pt-target'+(isSel?' is-sel':''), selsq:'pt-selsq'+(isSel?'':' pt-selsq--empty')}; };
  var rows=[
    L('Luz','#2FD3E0',K.luz,true),
    L('Contorno','#D46BFF',K.contorno,true,{lock:true}),
    L('Cuerpo','#3FD07F',K.cuerpo,o.cuerpoFx)
  ];
  if(exp==='Cuerpo'){ rows.push(S('Espada','Trazado','path16',false,sel==='Espada')); rows.push(S('Escudo','Elipse','ellipse16',false,sel==='Escudo')); rows.push(S('Píxeles','Ráster base','pixels16',false,false)); }
  rows.push(L('Sombra','#FF5A5A',K.sombra,true));
  rows.push(L('Fondo','#4F9DFF',fondo,false,{hidden:true,lock:true}));
  return rows;
}

function frames(active,opt){
  opt=opt||{}; var cls=opt.small?'pt-frame pt-frame--sm':'pt-frame';
  return POSES.map(function(p,i){ var K=knight(p); return {n:i+1,ms:DURS[i],name:'Caminar_0'+(i+1),sh:sh(K.comp,1),
    cls:cls+(i===active?' is-active':'')+((opt.sel||[]).indexOf(i)>=0?' is-sel':'')}; });
}

function swatches(selKey){ return SWATCH_ORDER.map(function(k){ return {hex:PAL[k],cls:'pt-swcell'+(k===selKey?' is-on':'')}; }); }

function bayerBar(stops,w,h,s){
  var out=[]; for(var y=0;y<h;y++) for(var x=0;x<w;x++){ var t=x/(w-1),n=stops.length-1,seg=Math.min(n-1,Math.floor(t*n)),u=t*n-seg,th=(BAYER[y%4][x%4]+.5)/16; out.push(((x+1)*s)+'px '+((y+1)*s)+'px 0 0 '+stops[u>th?seg+1:seg]); }
  return out.join(',');
}

window.PT={ICONS:ICONS,PAL:PAL,BAYER:BAYER,POSES:POSES,DURS:DURS,blank:blank,put:put,over:over,compose:compose,shift:shift,tint:tint,
  knight:knight,grass:grass,appIcon:appIcon,cofre:cofre,sh:sh,tile:tile,icons:icons,tools:tools,menus:menus,layerRows:layerRows,frames:frames,swatches:swatches,bayerBar:bayerBar};
})();
