import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/noto-sans-georgian';
import '@fontsource-variable/noto-serif-georgian';
import './styles/tokens.css';
import './styles/app.css';
import './styles/product.css';
import './styles/product-login.css';
import './styles/product-dashboard.css';
import './styles/product-command.css';
import './styles/product-workspaces.css';
import './styles/product-operations.css';
import { App } from './App';
import { queryClient } from './lib/api';
import { Preferences } from './lib/preferences';
import { ToastProvider } from './components/ui';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <link
      rel="preload"
      href="/fonts/product/gl-tatishvili-12-normal.ttf"
      as="font"
      type="font/ttf"
      crossOrigin="anonymous"
    />
    <QueryClientProvider client={queryClient}>
      <Preferences>
        <ToastProvider>
          <App />
        </ToastProvider>
      </Preferences>
    </QueryClientProvider>
  </StrictMode>,
);
