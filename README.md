# SCM Studio

The Spatial Cryptographic Matrix (SCM) is a next-generation data storage and transfer system that treats a complex geometric object as a multi-dimensional, fragmented cryptographic drive.

SCM Studio is the local-first renderer, studio, payload vault, verification lab, and export suite for that matrix.

## Features

### Cryptographic core
- Deterministic 9×9×9 matrix built from a seeded PRNG
- Three hidden alignment anchors and a carved Manhattan path
- Token-derived execution order used by the reveal animations
- AES-GCM sealed `SCM1` tokens
- QR deep links that auto-load and decrypt the matrix
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

### Payload vault
- Encrypt text, images, video, and documents such as PDF and DOCX
- Small text (≤ 512 UTF-8 bytes) embeds directly inside the `SCM1` token
- Larger text and all files are AES-GCM sealed into a portable `.scm` container
- SHA-256 integrity verification and decrypted previews
- Native Android share/save support through Capacitor Filesystem and Share

### Exports
- Binary STL and Wavefront OBJ
- Six orthogonal face maps as high-resolution PNG/SVG
- Six-face contact sheet
- QR code PNG/SVG and the SCM digital card PNG

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

The built site is compatible with GitHub Pages project paths. Build with the repository
base path:

```powershell
$env:VITE_BASE_PATH="/Spacial-Cryptographic-Matrix-SCM-/"
$env:VITE_PUBLIC_APP_URL="https://youssefhassanecoten-tech.github.io/Spacial-Cryptographic-Matrix-SCM-/"
npm.cmd run build
```

The `gh-pages` branch contains the deployed build. To publish it, open the repository
settings and set **Pages → Build and deployment → Source** to **Deploy from a branch**,
then choose `gh-pages` and `/ (root)`.

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
- `release/SCM-Studio-1.0.0.apk` (local copy)

The release APK is signed with the local keystore in `android/keystore/`. That folder,
`local.properties`, and every build output are gitignored. Keep the keystore safe if you
plan to publish updates with the same application signature.

## Payload limits

- Maximum payload: 64 MB per attachment
- Embedded token text: 512 UTF-8 bytes
- Larger content: share the generated `.scm` container alongside the QR/token

## License

MIT
