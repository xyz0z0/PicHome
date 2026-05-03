"use client";

import { useState } from "react";

interface CopyButtonsProps {
  imageUrl: string;
  originalUrl: string;
  originalName: string;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

export default function CopyButtons({ imageUrl, originalUrl, originalName }: CopyButtonsProps) {
  const { copied, copy } = useCopy();

  const markdown = `![${originalName}](${imageUrl})`;

  return (
    <div className="copy-actions">
      <button
        className={`copy-btn${copied === "url" ? " copied" : ""}`}
        onClick={() => copy(imageUrl, "url")}
      >
        {copied === "url" ? "✓ 已复制" : "复制图片链接"}
      </button>
      <button
        className={`copy-btn secondary${copied === "md" ? " copied" : ""}`}
        onClick={() => copy(markdown, "md")}
      >
        {copied === "md" ? "✓ 已复制" : "复制 Markdown"}
      </button>
      <a className="copy-btn outline" href={originalUrl} target="_blank" rel="noreferrer">
        查看原图
      </a>
    </div>
  );
}
