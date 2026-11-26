import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { startSync } from './sync/sync';
import './styles.css';

// Offline support + "Add to Home Screen" on iPhone.
// Updates install themselves; also look for one whenever you come back to the app,
// so a tab left open picks up fixes without a manual reload.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    window.setInterval(check, 60 * 60 * 1000);
  },
});
// Sync with your other devices (does nothing until this device is connected).
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
