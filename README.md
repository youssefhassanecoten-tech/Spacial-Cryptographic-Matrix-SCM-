# SCM Studio

The Spatial Cryptographic Matrix (SCM) is a next-generation data storage and transfer system that treats a complex geometric object as a multi-dimensional, fragmented cryptographic drive.

SCM Studio is the local-first renderer, studio, encrypted payload vault, verification lab, and export suite for that matrix.

## Live app

**https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/**

## How the sealed workflow works

1. **Compose** any combination of text items, images, video, folders, PDFs, and documents.
2. **Seal** the vault. The content root and a fresh salt derive a new matrix seed, matrix ID, shape, and token. The cube visibly reshapes.
3. **Content disappears** from the studio. Only the encrypted private ID token and the encrypted `.scm` package remain.
4. **Decrypt** by opening the Decrypt tab and pasting the private ID token. File items also need the matching `.scm` package. A solved-matrix explosion reveals the content.
5. **Edit Studio** is gated by the private ID token. Add, remove, or edit items, then re-seal to mint a new shape and token.

Offline encryption cannot revoke an old token. A re-seal archives the previous version locally, but any external copy of the old token and package still decrypts the old content.

## QR and guest mode

- The QR contains a **public shape token** (`SCMS1`) and never the private ID token.
- Scanning opens a guest viewer with the exact 3D shape and animation only.
- The guest page exposes one **Input Token** window. Content stays locked until the private `SCM1` token is pasted and, for files, the `.scm` package is loaded.
- The private token is shared separately from the QR.

## Features

### Cryptographic core
- Deterministic 9×9×9 matrix built from a seeded PRNG
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

## Payload limits

- Maximum total payload: 64 MB per SCM
- Text item that can embed in the token: 2 KB
- Total embedded text per token: 4 KB
- Larger text and all files go into the encrypted `.scm` package

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

## Web deployment

The `gh-pages` branch contains the production build. GitHub Pages serves it at the URL above. To rebuild for a project path:

```powershell
$env:VITE_BASE_PATH="/Spacial-Cryptographic-Matrix-SCM-/"
$env:VITE_PUBLIC_APP_URL="https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/"
npm.cmd run build
```

## Android

The native shell lives in `android/` and is built with Capacitor 8.

```powershell
$env:VITE_BASE_PATH="/"
$env:VITE_PUBLIC_APP_URL="https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/"
npm.cmd run build
npx.cmd cap sync android
cd android
.\gradlew.bat assembleRelease
```

Outputs:

- `android/app/build/outputs/apk/release/app-release.apk`
- `release/SCM-Studio-1.1.0.apk` (local copy)

The release APK is signed with the local keystore in `android/keystore/`. That folder, `local.properties`, and all build outputs are gitignored. Keep the keystore safe for future updates.

## License

MIT
