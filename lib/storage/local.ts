import fs from "fs/promises";
import path from "path";
import { StorageAdapter, PutObjectInput } from "./adapter";

function resolveStorageRoot() {
  const raw = process.env.STORAGE_ROOT || process.env.UPLOAD_PATH || "";
  // Windows 下经常拿不到 `/var/www/...` 这类路径，统一兜底到项目相对目录
  const safeRaw = raw.trim();
  if (!safeRaw) return path.join(process.cwd(), "uploads");
  const normalized = safeRaw.startsWith("/") ? safeRaw.replace(/^\//, "") : safeRaw;
  // 如果仍然是相对路径，就落到项目根目录
  if (!path.isAbsolute(normalized)) {
    return path.join(process.cwd(), normalized);
  }
  return normalized;
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private rootDir: string = resolveStorageRoot()) {}

  private resolvePath(relPath: string) {
    const fullPath = path.join(this.rootDir, relPath);
    return fullPath;
  }

  async putObject(input: PutObjectInput) {
    const fullPath = this.resolvePath(input.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.data);
  }

  async getObject(relPath: string) {
    const fullPath = this.resolvePath(relPath);
    return fs.readFile(fullPath);
  }

  async deleteObject(relPath: string) {
    const fullPath = this.resolvePath(relPath);
    try {
      await fs.unlink(fullPath);
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
}

