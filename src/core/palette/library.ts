// Biblioteca de paletas de la app. Solo paletas de uso libre y muy extendidas en pixel art;
// los colores son datos (no creaciones protegidas). Autores: PICO-8 (Lexaloffle), Sweetie 16
// (GrafxKid), Endesga 32 (Endesga), Game Boy (tonos clásicos).

import type { RGBA } from '../model/types'
import { hexToColor } from './palette'

export interface LibraryPalette {
  key: string
  name: string
  colors: string[]
}

export const LIBRARY: LibraryPalette[] = [
  {
    key: 'pico8',
    name: 'PICO-8',
    colors: [
      '000000', '1D2B53', '7E2553', '008751', 'AB5236', '5F574F', 'C2C3C7', 'FFF1E8',
      'FF004D', 'FFA300', 'FFEC27', '00E436', '29ADFF', '83769C', 'FF77A8', 'FFCCAA'
    ]
  },
  { key: 'gameboy', name: 'Game Boy (4 tonos)', colors: ['0F380F', '306230', '8BAC0F', '9BBC0F'] },
  {
    key: 'sweetie16',
    name: 'Sweetie 16',
    colors: [
      '1A1C2C', '5D275D', 'B13E53', 'EF7D57', 'FFCD75', 'A7F070', '38B764', '257179',
      '29366F', '3B5DC9', '41A6F6', '73EFF7', 'F4F4F4', '94B0C2', '566C86', '333C57'
    ]
  },
  {
    key: 'endesga32',
    name: 'Endesga 32',
    colors: [
      'BE4A2F', 'D77643', 'EAD4AA', 'E4A672', 'B86F50', '733E39', '3E2731', 'A22633',
      'E43B44', 'F77622', 'FEAE34', 'FEE761', '63C74D', '3E8948', '265C42', '193C3E',
      '124E89', '0099DB', '2CE8F5', 'FFFFFF', 'C0CBDC', '8B9BAE', '5A6988', '3A4466',
      '262B44', '181425', 'FF0044', '68386C', 'B55088', 'F6757A', 'E8B796', 'C28569'
    ]
  }
]

export function libraryColors(p: LibraryPalette): RGBA[] {
  return p.colors.map((h) => hexToColor(h)!)
}
