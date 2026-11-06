const { app, BrowserWindow, protocol, shell } = require("electron");
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

app.whenReady().then(() => {
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
