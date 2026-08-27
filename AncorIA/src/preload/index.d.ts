import type { ApiAncorIA } from './index';

declare global {
  interface Window {
    ancoria: ApiAncorIA;
  }
}

export {};
