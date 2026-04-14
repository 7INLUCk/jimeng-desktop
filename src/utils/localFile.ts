/**
 * Local file URL helper
 *
 * Electron's protocol.handle has a confirmed unfixed bug (electron/electron#38749):
 * Range requests don't work for custom schemes in Electron 37+, which breaks
 * video seeking and canvas thumbnail capture. We use a local HTTP server in
 * the main process instead. Call localFileUrl(absolutePath) to get a URL that
 * the <video> / <img> elements can load reliably.
 */

let _port: number | null = null;

async function getPort(): Promise<number> {
  if (_port !== null) return _port;
  _port = await window.api.getFileServerPort();
  return _port!;
}

/**
 * Returns an http://127.0.0.1:PORT/file?path=... URL for a local absolute path.
 * Returns a promise — call once per component mount and cache the result.
 */
export async function localFileUrl(absolutePath: string): Promise<string> {
  const port = await getPort();
  return `http://127.0.0.1:${port}/file?path=${encodeURIComponent(absolutePath)}`;
}

/**
 * Synchronous version — returns empty string until port is initialized.
 * Call initLocalFileServer() on app startup to pre-warm the port.
 */
export function localFileUrlSync(absolutePath: string): string {
  if (_port === null) return '';
  return `http://127.0.0.1:${_port}/file?path=${encodeURIComponent(absolutePath)}`;
}

/** Call once on app startup (e.g. in App.tsx useEffect) to pre-warm the port. */
export async function initLocalFileServer(): Promise<void> {
  await getPort();
}
