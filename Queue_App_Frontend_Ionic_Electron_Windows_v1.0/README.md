# Queue App Kiosk — Ionic Angular 17 + Electron

The kiosk frontend is an Ionic/Angular 17 application packaged with Electron for Windows. Electron uses `contextIsolation: true`, `nodeIntegration: false`, a minimal preload bridge and allowlisted print IPC. The backend confirms ticket creation before the kiosk attempts printing; a print failure must be handled as a reprint of the same ticket, not a new ticket.

See `docs/WINDOWS-BUILD-DEPLOYMENT.md` in the delivery bundle for full build instructions. The first version uses the Windows default printer via Electron silent print; validate the exact printer model, driver, paper width and kiosk account on target hardware before production.
