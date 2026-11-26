import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { startSync } from './sync/sync';
import './styles.css';

// Offline support + "Add to Home Screen" on iPhone. Updates install themselves.
registerSW({ immediate: true });
// Sync with your other devices (does nothing until this device is connected).
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
