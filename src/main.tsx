import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { applyTheme, loadTheme } from './ui/theme';
import './ui/styles.css';

// Before the first render, so a saved Day or Night choice shows without a flash.
applyTheme(loadTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
