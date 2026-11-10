const PACKAGE_DIRECTORY = "scm-packages";
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function cleanupStaleOpfsPackages(
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): Promise<void> {
  if (typeof navigator === "undefined") {
    return;
  }
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof storage?.getDirectory !== "function") {
    return;
  }
  try {
    const root = await storage.getDirectory();
    const directory = await root.getDirectoryHandle(PACKAGE_DIRECTORY, {
      create: true,
    });
    const entries = (
      directory as unknown as {
        entries?: () => AsyncIterableIterator<
          [string, FileSystemHandle]
        >;
      }
    ).entries;
    if (!entries) {
      return;
    }
    for await (const [name, handle] of entries.call(directory)) {
      if (
        !name.startsWith("package-") &&
        !name.startsWith("tmp-")
      ) {
        continue;
      }
      if (handle.kind !== "file") {
        continue;
      }
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        if (Date.now() - file.lastModified > maxAgeMs) {
          await directory.removeEntry(name).catch(() => undefined);
        }
      } catch {
        continue;
      }
    }
  } catch {
    return;
  }
}
