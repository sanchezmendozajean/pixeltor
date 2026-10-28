<script setup lang="ts">
// Tira de imágenes colapsada (32 px). El panel Animación completo llega en F5.
import PtIcon from '@/components/PtIcon.vue'
import ActionButton from '@/components/ActionButton.vue'
import { t } from '@/i18n'

// Maqueta de F0: un documento con una imagen de 100 ms (valor por defecto de specs/02).
const frames = [{ n: 1, ms: 100 }]
const total = frames.reduce((sum, f) => sum + f.ms, 0)
</script>

<template>
  <section class="pt-strip" :aria-label="t('frames.title')">
    <button
      type="button"
      class="pt-iconbtn"
      :data-tip="t('frames.expand')"
      :aria-label="t('frames.expand')"
    >
      <PtIcon name="chevUp" />
    </button>
    <span class="pt-strip__title">{{ t('frames.title') }}</span>
    <ActionButton id="view.play" />
    <span class="pt-sep pt-sep--inset" />
    <div class="frames">
      <button
        v-for="f in frames"
        :key="f.n"
        type="button"
        class="pt-frame pt-frame--sm is-active"
        :aria-label="`${t('viewer.image')} ${f.n}, ${f.ms} ms`"
      >
        <span class="pt-fnum">{{ f.n }}</span>
      </button>
      <ActionButton id="image.new" />
    </div>
    <div class="pt-spacer" />
    <span class="pt-sec2">{{ t('frames.empty', { n: 1, total: frames.length }) }} · 100 ms</span>
    <span class="pt-sep pt-sep--inset" />
    <span class="pt-mono pt-sec2 total">{{ t('frames.total', { ms: total }) }}</span>
  </section>
</template>

<style scoped>
.frames {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-1);
}
.total {
  font-size: 10.5px;
}
</style>
