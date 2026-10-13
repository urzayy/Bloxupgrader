import { useEffect } from 'react';
import { applyDocumentSeo } from '../lib/documentSeo';

/** Keep document title / meta / canonical in sync with the SPA path. */
export function useDocumentSeo(): void {
  useEffect(() => {
    const bootH1 = document.getElementById('boot-h1');
    if (bootH1) bootH1.setAttribute('data-booted', '1');

    const sync = () => {
      applyDocumentSeo(window.location.pathname);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
}
