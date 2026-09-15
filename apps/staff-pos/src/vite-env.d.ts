/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
import '@testing-library/jest-dom/vitest'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  [key: string]: string | boolean | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
