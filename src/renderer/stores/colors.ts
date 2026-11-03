import { defineStore } from 'pinia'

// Colores de trabajo del usuario (datos, no tokens de UI). El selector completo llega en F1.
export const useColorsStore = defineStore('colors', {
  state: () => ({
    fill: '#000000',
    stroke: '#FFFFFF',
    /** Cuál de los dos recibe los cambios del selector. */
    target: 'fill' as 'fill' | 'stroke',
    /** Las formas nuevas llevan un degradado (de relleno a contorno) en lugar de un color liso. */
    fillGradient: false,
    strokeGradient: false
  }),
  actions: {
    swap() {
      ;[this.fill, this.stroke] = [this.stroke, this.fill]
    },
    reset() {
      this.fill = '#000000'
      this.stroke = '#FFFFFF'
    },
    toggleTarget() {
      this.target = this.target === 'fill' ? 'stroke' : 'fill'
    }
  }
})
