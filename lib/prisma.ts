import { PrismaClient } from "../app/generated/prisma/client";
import path from "path";

// 避免开发环境下创建多个 PrismaClient 实例。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Prisma CLI 以 schema 文件所在目录（prisma/）为基准解析相对路径，
 * 而 PrismaClient 运行时以进程 CWD（项目根目录）为基准。
 * 此函数统一两者行为，确保指向同一个 SQLite 文件。
 */
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") && !path.isAbsolute(url.slice(5))) {
    const schemaDir = path.join(process.cwd(), "prisma");
    return `file:${path.resolve(schemaDir, url.slice(5))}`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl() },
    },
    log: [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

