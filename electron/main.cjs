const {
  app,
  BrowserWindow,
  Notification,
  dialog,
  protocol,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const DIST_ROOT = path.join(__dirname, "..", "dist");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "scm",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    title: "SCM Studio",
    backgroundColor: "#05070d",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setMenu(null);
  window.loadURL("scm://app/index.html");
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) {
    return;
  }
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (error) {
    console.warn("[updater] electron-updater unavailable", error);
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.warn("[updater] error", error?.message ?? error);
  });

  autoUpdater.on("update-available", async (info) => {
    const remoteMajor = Number.parseInt(info.version.split(".")[0], 10) || 0;
    const localMajor = Number.parseInt(app.getVersion().split(".")[0], 10) || 0;
    if (remoteMajor > localMajor) {
      const result = await dialog.showMessageBox({
        type: "info",
        title: "SCM Studio major update",
        message: `SCM Studio ${info.version} is available.`,
        detail:
          "This is a new major version. Install it from the release page. Existing tokens and .scm packages stay compatible.",
        buttons: ["Open download page", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) {
        void shell.openExternal(
          `https://github.com/youssefhassanecoten-tech/Spacial-Cryptographic-Matrix-SCM-/releases/tag/v${info.version}`,
        );
      }
      return;
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.warn("[updater] download failed", error?.message ?? error);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    if (!Notification.isSupported()) {
      return;
    }
    new Notification({
      title: "SCM Studio updated",
      body: `Version ${info.version} installs when you restart the app.`,
    }).show();
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn("[updater] check failed", error?.message ?? error);
    });
  };

  setTimeout(check, 12000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.youssefhassan.scm");
  protocol.handle("scm", async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "" || pathname === "/") {
      pathname = "/index.html";
    }
    const target = path.normalize(path.join(DIST_ROOT, pathname));
    if (!target.startsWith(DIST_ROOT)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = await fs.readFile(target);
      const extension = path.extname(target).toLowerCase();
      return new Response(data, {
        headers: {
          "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  createWindow();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
