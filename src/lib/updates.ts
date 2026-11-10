import { Capacitor } from "@capacitor/core";

export const APP_VERSION =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.6.0";

export type AppPlatform = "web" | "android" | "ios" | "desktop";
export type UpdateKind = "none" | "minor" | "major";

export interface UpdateManifest {
  version: string;
  notes: string;
  releaseUrl: string;
  downloads: Partial<Record<AppPlatform, string>>;
}

const REMOTE_MANIFEST_URL =
  "https://raw.githubusercontent.com/youssefhassanecoten-tech/Spacial-Cryptographic-Matrix-SCM-/main/public/update.json";

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(value: string): ParsedVersion {
  const cleaned = value.trim().replace(/^v/i, "");
  const [major = 0, minor = 0, patch = 0] = cleaned
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return { major, minor, patch };
}

export function compareVersions(a: string, b: string): number {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  if (av.major !== bv.major) return av.major > bv.major ? 1 : -1;
  if (av.minor !== bv.minor) return av.minor > bv.minor ? 1 : -1;
  if (av.patch !== bv.patch) return av.patch > bv.patch ? 1 : -1;
  return 0;
}

export function getUpdateKind(local: string, remote: string): UpdateKind {
  if (compareVersions(remote, local) <= 0) {
    return "none";
  }
  const localVersion = parseVersion(local);
  const remoteVersion = parseVersion(remote);
  return remoteVersion.major > localVersion.major ? "major" : "minor";
}

export function getAppPlatform(): AppPlatform {
  if (typeof window === "undefined") {
    return "web";
  }
  if (
    window.navigator.userAgent.includes("Electron") ||
    Boolean((window as unknown as { scmDesktop?: boolean }).scmDesktop)
  ) {
    return "desktop";
  }
  const platform = Capacitor.getPlatform();
  if (platform === "android") return "android";
  if (platform === "ios") return "ios";
  return "web";
}

export async function fetchUpdateManifest(): Promise<UpdateManifest> {
  const response = await fetch(
    `${REMOTE_MANIFEST_URL}?cacheBust=${Date.now()}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Update manifest returned ${response.status}.`);
  }
  const value = (await response.json()) as Partial<UpdateManifest>;
  if (typeof value.version !== "string" || typeof value.releaseUrl !== "string") {
    throw new Error("Update manifest is incomplete.");
  }
  return {
    version: value.version,
    notes: typeof value.notes === "string" ? value.notes : "",
    releaseUrl: value.releaseUrl,
    downloads: value.downloads ?? {},
  };
}

export function updateDownloadUrl(
  manifest: UpdateManifest,
  platform: AppPlatform,
): string {
  return (
    manifest.downloads[platform] ??
    manifest.downloads.web ??
    manifest.releaseUrl
  );
}

export async function refreshPwaForUpdate(): Promise<void> {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) =>
        registration.update().catch(() => undefined),
      ),
    );
  }
  window.location.reload();
}
