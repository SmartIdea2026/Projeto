import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Desmonta o que foi renderizado ao fim de cada teste.
 *
 * O React Testing Library só faz isso sozinho com `globals: true` no Vitest,
 * que este projeto não usa. Sem a limpeza, cada `render` acumula no mesmo
 * documento e um teste passa a enxergar os elementos do anterior.
 */
afterEach(cleanup);
