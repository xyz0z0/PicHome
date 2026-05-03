export type PutObjectInput = {
  // 相对存储根目录的路径（例如：`images/<id>/thumb.webp`）
  path: string;
  data: Buffer;
  contentType: string;
};

export interface StorageAdapter {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(path: string): Promise<Buffer>;
  deleteObject(path: string): Promise<void>;
}

