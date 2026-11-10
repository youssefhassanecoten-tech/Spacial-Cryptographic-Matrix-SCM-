import type { StudioTab } from "../types";

export const TUTORIAL_STORAGE_KEY = "scm-tutorial-seen-version";

export interface TutorialStep {
  id: string;
  sinceVersion: string;
  title: string;
  body: string;
  bullets?: string[];
  tab?: StudioTab;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    sinceVersion: "1.0.0",
    title: "Welcome to SCM Studio",
    body: "SCM Studio is a local-first 3D cryptographic workspace. It turns a payload into an encrypted vault, a private token, a public shape, and an optional package.",
    bullets: [
      "The shape is public and visual.",
      "The private token is the key.",
      "File bytes stay in the encrypted .scm package.",
    ],
    tab: "design",
  },
  {
    id: "payload",
    sinceVersion: "1.0.0",
    title: "Build the payload",
    body: "Open Payload to add text, images, video, documents, or whole folders. The preview matrix reshapes live as you add or remove items.",
    bullets: [
      "Small text can embed inside the token.",
      "Larger text and files go into the .scm package.",
      "Draft items are not sealed yet.",
    ],
    tab: "payload",
  },
  {
    id: "scale",
    sinceVersion: "1.0.0",
    title: "Choose scale and fill",
    body: "Auto grows the lattice as the payload approaches the next capacity tier. Full fills every voxel; Data count fills one voxel per payload byte.",
    bullets: [
      "Manual sizes run from 3³ to 33³.",
      "Auto is the safest default.",
      "The Fill target row shows the current voxel budget.",
    ],
    tab: "payload",
  },
  {
    id: "seal",
    sinceVersion: "1.0.0",
    title: "Seal, then split the secrets",
    body: "Seal the vault to create the private token, public shape token, and encrypted package. Keep the private token and package separate from the public shape.",
    bullets: [
      "Private token + package = full decrypt.",
      "Public shape link/QR = shape only.",
      "Re-sealing mints a new shape and token.",
    ],
    tab: "payload",
  },
  {
    id: "decrypt",
    sinceVersion: "1.0.0",
    title: "Decrypt",
    body: "Open Decrypt, paste the private token, and load the .scm package when files are attached. A valid token triggers the reveal explosion and content cards.",
    bullets: [
      "The Decrypt tab always exposes the token input.",
      "Files need the matching package.",
      "SHA-256 checks every item after decrypt.",
    ],
    tab: "decrypt",
  },
  {
    id: "blank",
    sinceVersion: "1.3.1",
    title: "Blank start and volume fill",
    body: "New sessions begin with an empty lattice. Shapes fill fully by default, or you can choose Data count to fill only as many voxels as the payload needs.",
    tab: "design",
  },
  {
    id: "shapes",
    sinceVersion: "1.4.0",
    title: "Flat-faced shapes and surface glyphs",
    body: "Choose from flat-faced polyhedra and stepped forms. Glyphs now sit on exposed faces across all six directions, so they follow the topography instead of floating.",
    bullets: [
      "Cube, pyramid, cross, shell, diamond, octahedron, icosahedron, dodecahedron, hex prism, ziggurat, obelisk, star, crystal.",
      "Glyph complexity grows with fill and lattice size.",
      "Curved legacy masks are hidden but still readable.",
    ],
    tab: "design",
  },
  {
    id: "large",
    sinceVersion: "1.5.0",
    title: "Large payloads",
    body: "The lattice cap is 33³ and the payload cap is 8 GB. Uploads stay as lazy file references, packages compress per file, and chunks are encrypted as they stream.",
    bullets: [
      "No whole-file load on upload.",
      "4 MB authenticated chunks.",
      "Legacy packages remain readable.",
    ],
    tab: "payload",
  },
  {
    id: "integrity",
    sinceVersion: "1.6.0",
    title: "Per-chunk keys and Merkle roots",
    body: "Each package chunk gets its own HKDF-derived AES-GCM key. The chunk list is committed by a Merkle root, so tampered chunks are rejected before extraction.",
    tab: "token",
  },
  {
    id: "shards",
    sinceVersion: "1.7.0",
    title: "Threshold shares and package shards",
    body: "Split the private token into k-of-n shares, split a package into k-of-n shards, and recover either from any threshold subset. Every shard carries a Merkle proof.",
    bullets: [
      "Token shares: 2-of-3, 3-of-5, 4-of-7.",
      "Package shards: .scmshard files.",
      "Printable cube net for very small packages.",
    ],
    tab: "token",
  },
  {
    id: "recover",
    sinceVersion: "1.7.0",
    title: "Recover custody",
    body: "Use Decrypt to rebuild a package from shard files and to reconstruct a token from shares. Recovered packages still need the private token.",
    tab: "decrypt",
  },
  {
    id: "custody-kit",
    sinceVersion: "1.11.0",
    title: "Paper custody, scanning, and provenance",
    body: "Token share cards, QR scanning, Ed25519 provenance, and block-based shards turn the vault into a custody kit rather than a single-file app.",
    bullets: [
      "Print one QR card per token share and store cards separately.",
      "Scan share QR images or use the camera where BarcodeDetector is supported.",
      "Sign the shape and package hash with a device or project Ed25519 key.",
      "Large packages use block-based shards and OPFS when available.",
    ],
    tab: "token",
  },
  {
    id: "passphrase",
    sinceVersion: "1.10.0",
    title: "Passphrase-locked tokens",
    body: "Set an optional passphrase before sealing. The private token is then encrypted with a PBKDF2-derived key, so the token alone is not enough.",
    bullets: [
      "Share the passphrase separately from the token and package.",
      "Older tokens still unlock without a passphrase.",
      "Large packages above 64 MB use the browser's OPFS disk storage for assembly when available.",
    ],
    tab: "payload",
  },
  {
    id: "shares-split",
    sinceVersion: "1.9.0",
    title: "Separate share files",
    body: "Token shares now download as separate files, one share per file, and each share carries a checksum. Decrypt can import those files directly.",
    bullets: [
      "A damaged share fails fast before reconstruction.",
      "Keep each file on a separate device or location.",
      "Package shards already downloaded as separate .scmshard files.",
    ],
    tab: "token",
  },
  {
    id: "printability",
    sinceVersion: "1.8.1",
    title: "Printability disclaimers",
    body: "The app now warns when a shape is thin, perforated, or overhanging, when the footprint exceeds a common 220 mm bed, or when the payload is too large for the printable shard net.",
    bullets: [
      "Warnings do not block the STL export.",
      "Shell, star, crystal, icosahedron, and dodecahedron are flagged as harder prints.",
      "Payloads above ~6 KB can still be sharded digitally but not carried by one printable cube net.",
    ],
    tab: "design",
  },
  {
    id: "tours",
    sinceVersion: "1.8.0",
    title: "Tours that follow updates",
    body: "New users get the full walkthrough. Returning users only see what changed since their last seen version. Reopen the full tour any time from the book icon in the header.",
    bullets: [
      "Progress is stored locally per device.",
      "Skipping marks the current version as seen.",
      "Future releases can add a new tutorial step with the next version.",
    ],
    tab: "design",
  },
];
