export const DEFAULT_GRID_SIZE = 9;
export const MIN_GRID_SIZE = 3;
export const MAX_GRID_SIZE = 33;
export const GRID_SIZE_OPTIONS = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33] as const;
export const GRID_SIZE = DEFAULT_GRID_SIZE;
export const BLOCK_SIZE = 3;
export const VOXEL_COUNT = DEFAULT_GRID_SIZE ** 3;
export const GRID_HALF = (DEFAULT_GRID_SIZE - 1) / 2;
export const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024 * 1024;

export type ExplosionType =
  | "radial"
  | "vortex"
  | "shatter"
  | "cascade"
  | "prism"
  | "implode";

export interface RevealDirective {
  v: number;
  type: string;
}

export type Vec3 = [number, number, number];
export type FillMode = "full" | "data";
export type MobileLayout = "split" | "drawer" | "tabs" | "minimap";
export type GridSizeOption =
  | "auto"
  | "3"
  | "6"
  | "9"
  | "12"
  | "15"
  | "18"
  | "21"
  | "24"
  | "27"
  | "30"
  | "33";

export interface SCMAnchor {
  id: number;
  label: string;
  coord: Vec3;
}

export interface SCMMatrix {
  id: string;
  seed: number;
  label: string;
  createdAt: string;
  gridSize: number;
  voxelCount: number;
  bits: Uint8Array;
  anchors: SCMAnchor[];
  path: number[];
  order: number[];
  orderRank: Uint16Array;
  activeCount: number;
  fill?: FillMode;
  fillCount?: number;
  reveal?: ExplosionType;
}

export type PayloadKind = "text" | "image" | "video" | "document";
export type PayloadMode = "embedded" | "external";
export type PayloadItemMode = "embedded" | "package";

export interface SCMPayload {
  kind: PayloadKind;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  mode: PayloadMode;
  data?: string;
}

export interface SCMPayloadItem {
  id: string;
  kind: PayloadKind;
  name: string;
  path: string;
  mime: string;
  size: number;
  sha256: string;
  mode: PayloadItemMode;
  data?: string;
}

export interface SCMPayloadManifest {
  v: 1;
  items: SCMPayloadItem[];
  totalSize: number;
  embeddedSize: number;
  packageSize: number;
  contentRoot: string;
}

export interface SCMShapePayload {
  v: 1;
  kind: "shape";
  id: string;
  seed: number;
  label: string;
  createdAt: string;
  gridSize: number;
  anchors: Vec3[];
  shapeId: string;
  fill?: FillMode;
  fillCount?: number;
  reveal?: RevealDirective;
}

export interface RevealedItem extends SCMPayloadItem {
  blob?: Blob;
}

export interface RevealResult {
  manifest: SCMPayloadManifest;
  items: RevealedItem[];
  shape: SCMShapePayload | null;
  packageLoaded: boolean;
}

export interface SCMTokenPayload {
  v: 1;
  id: string;
  seed: number;
  label: string;
  createdAt: string;
  gridSize?: number;
  anchors: Vec3[];
  shapeId?: string;
  fill?: FillMode;
  fillCount?: number;
  reveal?: RevealDirective;
  salt?: string;
  contentRoot?: string;
  manifest?: SCMPayloadManifest;
  payload?: SCMPayload;
}

export type ShapeType =
  | "cube"
  | "sphere"
  | "diamond"
  | "cylinder"
  | "torus"
  | "pyramid"
  | "cross"
  | "shell"
  | "octahedron"
  | "icosahedron"
  | "dodecahedron"
  | "hexPrism"
  | "ziggurat"
  | "obelisk"
  | "star"
  | "crystal";

export type PatternType =
  | "none"
  | "stripes"
  | "checker"
  | "dots"
  | "grid"
  | "circuit"
  | "waves"
  | "glyph";

export type GeometryStyle = "classic" | "maze" | "polyhedral";
export type MaterialType = "matte" | "metallic" | "glass" | "neon";
export type GradientMode = "none" | "linear" | "radial";

export interface DesignState {
  geometry: GeometryStyle;
  material: MaterialType;
  gradient: GradientMode;
  shape: ShapeType;
  pattern: PatternType;
  patternScale: number;
  patternIntensity: number;
  patternColor: string;
  colorBase: string;
  colorA: string;
  colorB: string;
  colorC: string;
  roughness: number;
  metalness: number;
  opacity: number;
  glow: number;
  showGrid: boolean;
  showAnchors: boolean;
  showTrajectory: boolean;
  contrastGuard: boolean;
  autoRotate: boolean;
  faceCodeMode: "auto" | "off" | "all";
}

export type AnimationType =
  | "explode"
  | "layerWave"
  | "pulse"
  | "glow"
  | "scanline";

export type EasingName =
  | "linear"
  | "easeInQuad"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "sine"
  | "backOut";

export type Axis = "x" | "y" | "z";
export type WaveMode = "slice" | "spiral";

export interface AnimationLayer {
  id: string;
  type: AnimationType;
  name: string;
  enabled: boolean;
  delay: number;
  duration: number;
  easing: EasingName;
  repeat: number;
  intensity: number;
  axis: Axis;
  mode: WaveMode;
  explosion?: ExplosionType;
}

export interface VerificationResult {
  id: "E" | "F";
  name: string;
  passed: boolean;
  detail: string;
  metrics: Record<string, string | number>;
  durationMs: number;
}

export interface TrajectoryPoint2D {
  x: number;
  y: number;
}

export interface TrajectoryResult {
  points3D: Vec3[];
  segments: Array<[Vec3, Vec3]>;
  anchorPoints3D: Vec3[];
  constellation: TrajectoryPoint2D[];
  constellationAnchors: TrajectoryPoint2D[];
  signature: string;
  constellationSignature: string;
}

export interface ExportOptions {
  includeBasePlate: boolean;
  baseThickness: number;
  scale: number;
}

export type StudioTab =
  | "design"
  | "payload"
  | "animate"
  | "export"
  | "verify"
  | "decrypt"
  | "token";
