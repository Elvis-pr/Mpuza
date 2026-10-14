/// <reference types="vite/client" />

// Allow importing CSS files as modules
declare module '*.css';

interface ImportMetaEnv {
  /** Absolute API base for native builds (Capacitor). Web uses relative '/api'. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
