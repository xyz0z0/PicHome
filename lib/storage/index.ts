import { LocalStorageAdapter } from "./local";
import { StorageAdapter } from "./adapter";

// 先用本地磁盘实现接口；后续切 S3/MinIO/Supabase 时仅替换此处
let adapter: StorageAdapter | null = null;

export function getStorageAdapter() {
  if (adapter) return adapter;
  adapter = new LocalStorageAdapter();
  return adapter;
}

