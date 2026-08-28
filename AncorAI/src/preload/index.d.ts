import type { ApiAncorAI } from './index';

declare global {
  interface Window {
    ancorai: ApiAncorAI;
  }
}

export {};
