import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyDocumentSeo } from './lib/documentSeo';
import './index.css';

// Apply route SEO before React mounts so crawlers that execute JS see index/follow
// (or noindex on private routes) even if hydration is slow.
applyDocumentSeo();

if (import.meta.env.PROD) {
  (window as Window & { __BLOX_BUILD?: string }).__BLOX_BUILD = '20261013-seo-index-follow';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
