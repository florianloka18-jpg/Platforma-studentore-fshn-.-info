/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WELIB_EMAIL: string;
  readonly VITE_WELIB_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
