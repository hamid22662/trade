# TradeLog implementation status

- [x] Web/PWA persistence through IndexedDB
- [x] Android persistence through SQLite and managed local image files
- [x] Portable JSON backup with embedded image bytes
- [x] Restore through the system document picker
- [x] Static same-origin `/app-config.json` with environment fallback
- [x] Byte-for-byte config copy into the web build
- [x] Fail-closed sponsor banner on Dashboard and Settings
- [x] Local-first privacy screen accessible from Settings
- [x] No authentication, subscription, admin, cloud database, or backend dependency
- [x] Installable PWA manifest with real standard, maskable, and Apple icons
- [x] Offline PWA shell with network-only `/app-config.json`
- [x] Safari iPhone standalone metadata
- [x] Real Gradle APK build path with structural APK verification
- [x] APK workflow without application secrets or environment configuration
- [x] TypeScript, security, web database, backup, app-config, PWA, web build, and APK checks

Pending product work:

- [ ] Advertising integration
- [ ] Advertising consent flow
- [ ] Minimum-version / forced-update UI

External acceptance (requires deployed HTTPS / GitHub runner / real devices):

- [ ] Chrome Android, Safari iPhone, and desktop Chrome/Edge install UI
- [ ] GitHub Actions APK artifact installation and first offline launch
