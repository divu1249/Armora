import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { applyTheme, initialTheme } from './brand.ts';

// apply the stored theme before the first paint of React content
applyTheme(initialTheme());

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fullPage>
    <App />
  </ErrorBoundary>
);
