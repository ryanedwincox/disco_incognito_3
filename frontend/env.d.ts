/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_UI_MODE?: "minimal" | "full";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
