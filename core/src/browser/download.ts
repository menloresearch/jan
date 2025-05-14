import {
  open,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

export async function downloadFile(
  url: string,
  path: string,
  signal?: AbortSignal): Promise<{
    size: number;
    iterator: AsyncGenerator<number, void, void>;
  }> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const totalSize = parseInt(response.headers.get("Content-Length") ?? "0", 10);
  const file = await open(path, { create: true, write: true, baseDir: BaseDirectory.AppLocalData });

  async function* streamWriter(): AsyncGenerator<number, void, void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body stream not supported");

    let downloaded = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await file.write(value);
          downloaded += value.length;
          yield downloaded;
        }
      }
    } catch (err) {
      if (signal?.aborted) {
        console.warn("Download aborted.");
      } else {
        throw err;
      }
    } finally {
      await file.close();
      reader.releaseLock();
    }
  }

  return { size: totalSize, iterator: streamWriter() };
}
