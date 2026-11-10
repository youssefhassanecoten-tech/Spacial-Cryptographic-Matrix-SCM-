interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
}

function isNativePlatform(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((window as unknown as CapacitorWindow).Capacitor?.isNativePlatform?.());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function writeNativeFile(
  filename: string,
  base64: string,
  mime: string,
): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({
    title: filename,
    text: `${filename} · ${mime}`,
    url: written.uri,
    dialogTitle: "Save or share SCM export",
  });
}

async function saveNativeBlob(blob: Blob, filename: string): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  await Filesystem.deleteFile({
    path: filename,
    directory: Directory.Cache,
  }).catch(() => undefined);

  const chunkSize = 8 * 1024 * 1024;
  let offset = 0;
  let first = true;
  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + chunkSize);
    const base64 = bytesToBase64(
      new Uint8Array(await chunk.arrayBuffer()),
    );
    if (first) {
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      first = false;
    } else {
      await Filesystem.appendFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
    }
    offset += chunkSize;
  }
  if (blob.size === 0) {
    await Filesystem.writeFile({
      path: filename,
      data: "",
      directory: Directory.Cache,
      recursive: true,
    });
  }
  const uri = await Filesystem.getUri({
    path: filename,
    directory: Directory.Cache,
  });
  await Share.share({
    title: filename,
    text: `${filename} - ${blob.type || "application/octet-stream"}`,
    url: uri.uri,
    dialogTitle: "Save or share SCM export",
  });
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      await saveNativeBlob(blob, filename);
    } catch (error) {
      console.error("Native export failed", error);
    }
    return;
  }
  if (typeof document === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadText(
  text: string,
  filename: string,
  mime = "text/plain;charset=utf-8",
): Promise<void> {
  await downloadBlob(new Blob([text], { type: mime }), filename);
}

export async function downloadDataUrl(
  dataUrl: string,
  filename: string,
): Promise<void> {
  if (isNativePlatform()) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match) {
      console.error("Cannot export an invalid data URL.");
      return;
    }
    const [, mime, base64Flag, payload] = match;
    try {
      const base64 = base64Flag ? payload : bytesToBase64(new TextEncoder().encode(decodeURIComponent(payload)));
      await writeNativeFile(filename, base64, mime);
    } catch (error) {
      console.error("Native data export failed", error);
    }
    return;
  }
  if (typeof document === "undefined") {
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function safeFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "scm-lattice"
  );
}
