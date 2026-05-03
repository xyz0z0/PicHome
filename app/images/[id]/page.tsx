import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CopyButtons from "./CopyButtons";
import "./image-page.css";

export default async function ImagePage({
  params,
}: {
  params: { id: string };
}) {
  const image = await prisma.image.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      originalName: true,
      originalMimeType: true,
      size: true,
      width: true,
      height: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  if (!image || image.deletedAt) {
    notFound();
  }

  const baseUrl = (process.env.BASEURL || "").replace(/\/+$/, "");
  const thumbUrl = baseUrl
    ? `${baseUrl}/api/images/${image.id}?variant=thumb`
    : `/api/images/${image.id}?variant=thumb`;
  const originalUrl = baseUrl
    ? `${baseUrl}/api/images/${image.id}?variant=original`
    : `/api/images/${image.id}?variant=original`;
  const pageUrl = baseUrl
    ? `${baseUrl}/images/${image.id}`
    : `/images/${image.id}`;

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  const uploadedAt = new Date(image.createdAt).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="ip-root">
      <header className="ip-header">
        <a href="/" className="ip-logo">PicHome</a>
      </header>

      <main className="ip-main">
        <div className="ip-card">
          <div className="ip-image-wrap">
            <a href={originalUrl} target="_blank" rel="noreferrer">
              <img
                src={thumbUrl}
                alt={image.originalName}
                className="ip-image"
              />
            </a>
          </div>

          <div className="ip-info">
            <h1 className="ip-filename" title={image.originalName}>
              {image.originalName}
            </h1>

            <div className="ip-meta">
              {image.width && image.height && (
                <span className="ip-tag">{image.width} × {image.height}</span>
              )}
              <span className="ip-tag">{formatSize(image.size)}</span>
              <span className="ip-tag">{image.originalMimeType}</span>
              <span className="ip-tag">{uploadedAt}</span>
            </div>

            <CopyButtons
              imageUrl={originalUrl}
              originalUrl={originalUrl}
              originalName={image.originalName}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
