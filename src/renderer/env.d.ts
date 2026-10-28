/// <reference types="vite/client" />
import type { PixeltorApi } from '@shared/ipc'

declare global {
  interface Window {
    pixeltor: PixeltorApi
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
