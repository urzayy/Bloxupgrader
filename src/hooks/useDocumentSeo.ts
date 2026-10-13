import { useEffect } from 'react';
import { applyDocumentSeo } from '../lib/documentSeo';

/** Keep document title / meta / canonical in sync with the SPA path. */
export function useDocumentSeo(): void {
  useEffect(() => {
    const sync = () => {
      applyDocumentSeo(window.location.pathname);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
}
