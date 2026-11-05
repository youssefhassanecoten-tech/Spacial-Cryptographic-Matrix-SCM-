# SCM Studio

The Spatial Cryptographic Matrix (SCM) is a next-generation data storage and transfer system that treats a complex geometric object as a multi-dimensional, fragmented cryptographic drive.

SCM Studio is the local-first renderer, studio, verification lab, and export suite for that matrix.

## Features

- Deterministic 9×9×9 three-dimensional matrix with a seeded PRNG path shuffler
- AES-GCM sealed `SCM1` tokens and QR deep-link auto-load
- React Three Fiber viewport with bounded orbit controls
- Classic voxel, maze pipe, and polyhedral geometry modes
- Matte, metallic, glass, and neon materials
- Linear-Z and radial 3D gradients with eight palettes
- Contrast guard, alignment anchors, macro-block cage, and token trajectory overlays
- Reorderable cascade timeline: explode, layer wave, pulse, glow, and scanline
- Binary STL, OBJ, six-face PNG/SVG projections, contact sheets, and digital cards
- Phase 5 Test E/F verification inside the app and in Vitest
- Installable PWA and Android app shell via Capacitor

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

## Mobile

The app runs as a PWA from an HTTPS deployment, or as a native Android shell in `android/`.

```powershell
npm.cmd run build
npx.cmd cap sync android
cd android
.\gradlew.bat assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## License

MIT
