# SCM Studio

The Spatial Cryptographic Matrix (SCM) is a next-generation data storage and transfer system that treats a complex geometric object as a multi-dimensional, fragmented cryptographic drive.

SCM Studio is the local-first renderer, studio, encrypted payload vault, verification lab, and export suite for that matrix.

## Live app

**https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/**

## How the sealed workflow works

1. **Compose** any combination of text items, images, video, folders, PDFs, and documents.
2. **Choose the lattice scale** or let Auto grow it from 9³ up to 21³ based on payload size. 3³ and 6³ are manual mini modes.
3. **Seal** the vault. The content root and a fresh salt derive a new matrix seed, matrix ID, shape, and token. The cube visibly reshapes.
4. **Content disappears** from the studio. Only the encrypted private ID token and the encrypted `.scm` package remain.
5. **Decrypt** by opening the Decrypt tab and pasting the private ID token. File items also need the matching `.scm` package. A solved-matrix explosion reveals the content.
6. **Edit Studio** is gated by the private ID token. Add, remove, or edit items, then re-seal to mint a new shape and token.

Offline encryption cannot revoke an old token. A re-seal archives the previous version locally, but any external copy of the old token and package still decrypts the old content.

## Scalable lattice and face codes

Supported matrix sizes: **3³, 6³, 9³, 12³, 15³, 18³, 21³**.

- **Auto** keeps 9³ for small payloads and grows to 12³, 15³, 18³, then 21³ as the package grows toward 64 MB.
- **3³ and 6³** are manual mini modes.
- **Face codes:** auto mode puts a maze micro-code on every active cube below 9³, and separate hidden-anchor points at 9³ and above. The Design tab can force all faces or turn them off.
- Each marker is a content-derived maze shard rendered on one cube face. Full content remains in the private token and `.scm` package; the face layer is a distributed visual data surface, not a replacement for the package.

## QR and guest mode

- The QR contains a **public shape token** (`SCMS1`) and never the private ID token.
- Scanning opens a guest viewer with the exact 3D shape, lattice scale, and animation only.
- The guest page exposes one **Input Token** window. Content stays locked until the private `SCM1` token is pasted and, for files, the `.scm` package is loaded.
- The private token is shared separately from the QR.

## Features

### Cryptographic core
- Deterministic 3³–21³ matrix built from a seeded PRNG
- Three hidden alignment anchors and a carved Manhattan path
- Content-derived matrix seed: any add, remove, rename, or edit reshapes the matrix and changes the token
- Public shape tokens (`SCMS1`) and AES-GCM private tokens (`SCM1`)
- SHA-256 integrity checks for every payload item
- Guest shape verification against the private token commitment
- Phase 5 Test E/F verification in the app and in Vitest

### 3D studio
- React Three Fiber viewport with bounded orbit controls
- Classic voxel, maze pipe, and polyhedral geometry modes
- Eight overall shape masks: cube, sphere, diamond, cylinder, torus, pyramid, cross, shell
- Eight per-block procedural surface patterns: stripes, checker, dots, grid, circuit, waves, glyph
- Matte, metallic, glass, and neon materials
- Linear-Z and radial 3D gradients with eight palettes
- Contrast guard, alignment anchors, macro-block cage, and token trajectory overlays
- Reorderable cascade timeline: explode, layer wave, pulse, glow, and scanline
- Clickable home logo and collapsible studio sidebar

### Multi-item payload vault
- Text, images, video, documents, and whole folders in one SCM
- Small text embeds inside the private token; everything else is encrypted into a portable `.scm` package
- Locked sealed state with no plaintext content retained in the studio store
- Decrypted text reveals with a scramble animation; images and video preview; documents download
- Native Android save/share through Capacitor Filesystem and Share

### Exports
- Binary STL and Wavefront OBJ
- Six orthogonal face maps as high-resolution PNG/SVG
- Six-face contact sheet
- Public shape QR PNG/SVG and SCM digital shape card PNG
- Private ID token save and encrypted `.scm` package download

## Payload and lattice limits

- Maximum total payload: 64 MB per SCM
- Text item that can embed in the token: 2 KB
- Total embedded text per token: 4 KB
- Larger text and all files go into the encrypted `.scm` package
- Lattice limit: 21³ = 9,261 voxels. This is deliberately the practical upper bound for smooth rendering on phones; 21³ is supported, but 3³–12³ will be lighter.

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://localhost:5173.

On systems where `npm` is allowed, use `npm` directly.

## Build and verify

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

## Windows desktop app

```powershell
npm.cmd run dist:win
```

Outputs: `release-electron/SCM-Studio-Setup-1.3.1.exe`, `release-electron/SCM-Studio-Portable-1.3.1.exe`, `latest.yml`, and the blockmap.

Local copies live in `release/`. The NSIS installer supports automatic minor updates through `electron-updater`. The portable executable is unsigned, so Windows SmartScreen may warn on first launch, and portable builds do not self-update. The app loads through a secure `scm://` protocol with Web Crypto enabled.

## Updates

`public/update.json` is the remote manifest. It is fetched from the `main` branch on `raw.githubusercontent.com`, so publishing a new version only requires updating that file and pushing it.

- Web/PWA: minor updates reload automatically; major versions show a confirmation dialog.
- Android: one-tap prompt to download the new APK, followed by Android's install confirmation.
- iOS: prompts and opens the release page; self-updating is not permitted outside the App Store.
- Windows NSIS: minor updates download silently and install on quit; major versions open the release page.
- Windows portable: manual downloads only.

Bump `version` in `package.json`, `public/update.json`, and `android/app/build.gradle` (`versionCode` and `versionName`) for every release.

## Android

```powershell
$env:VITE_BASE_PATH="/"
$env:VITE_PUBLIC_APP_URL="https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/"
npm.cmd run build
npx.cmd cap sync android
cd android
.\gradlew.bat assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

The release APK is signed with the local keystore in `android/keystore/`. That folder and all build outputs are gitignored.

## iOS

The Capacitor iOS project lives in `ios/`. It can be opened and built on macOS with Xcode:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

A signed `.ipa` requires macOS, Xcode, an Apple Developer account, and provisioning profiles. This Windows environment can generate and commit the project but cannot produce or sign an iOS build. The PWA is already usable on iPhone via Safari → Add to Home Screen.

## SCM Chat / SCMC

SCM Chat is intentionally deferred until the server phase. A Raspberry Pi can host it:

- Pi 4/5 with 2 GB+ RAM, Node.js, and a WebSocket service
- HTTPS through Cloudflare Tunnel or Caddy/nginx with a certificate
- The Pi relays ciphertext and session/token rotation messages; it should never receive plaintext
- Token rotation per message means a snapshot exported at moment A stays readable with token A, while the live room moves to token B. Old token A cannot read messages after B, but it still decrypts the exported snapshot A.

## Web deployment

The `gh-pages` branch contains the production build. GitHub Pages serves it at the URL above.

```powershell
$env:VITE_BASE_PATH="/Spacial-Cryptographic-Matrix-SCM-/"
$env:VITE_PUBLIC_APP_URL="https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/"
npm.cmd run build
```

## License

MIT
