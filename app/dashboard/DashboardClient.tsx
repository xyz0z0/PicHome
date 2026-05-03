"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/app/generated/prisma/enums";

type User = {
  id: number;
  username: string;
  role: (typeof UserRole)[keyof typeof UserRole];
};
type ImageItem = {
  id: string;
  originalName: string;
  createdAt: string;
  isVisible: boolean;
  url: string;
  pageUrl: string;
  thumbUrl: string;
};
type ApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

// ─── 样式常量 ─────────────────────────────────────────────────────────────────
const colors = {
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  danger: "#ef4444",
  dangerHover: "#dc2626",
  border: "#e5e7eb",
  bg: "#f9fafb",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  success: "#059669",
};

const btn = (variant: "primary" | "danger" | "ghost" | "outline" = "primary"): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    transition: "opacity 0.15s",
    whiteSpace: "nowrap",
  };
  if (variant === "primary") return { ...base, background: colors.primary, color: "#fff" };
  if (variant === "danger")  return { ...base, background: colors.danger,  color: "#fff" };
  if (variant === "outline") return { ...base, background: "transparent", color: colors.primary, border: `1px solid ${colors.primary}` };
  return { ...base, background: "transparent", color: colors.muted, border: `1px solid ${colors.border}` };
};

const input: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const card: React.CSSProperties = {
  background: colors.card,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  padding: 20,
};

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const [tab, setTab] = useState<"images" | "apikeys">("images");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      {/* 顶栏 */}
      <header style={{
        background: colors.card,
        borderBottom: `1px solid ${colors.border}`,
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: colors.primary }}>PicHome</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user.role === UserRole.ADMIN ? (
            <button
              style={btn("outline")}
              onClick={() => router.push("/admin")}
            >
              后台管理
            </button>
          ) : null}
          <span style={{ fontSize: 13, color: colors.muted }}>
            👤 {user.username}
          </span>
          <button style={btn("ghost")} onClick={logout}>退出登录</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* 标签页切换 */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${colors.border}` }}>
          {(["images", "apikeys"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                color: tab === t ? colors.primary : colors.muted,
                borderBottom: tab === t ? `2px solid ${colors.primary}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t === "images" ? "📷 我的图片" : "🔑 API Key"}
            </button>
          ))}
        </div>

        {tab === "images" ? <ImagesTab /> : <ApiKeysTab />}
      </main>
    </div>
  );
}

// ─── 图片标签页 ───────────────────────────────────────────────────────────────
function ImagesTab() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingVisibleId, setTogglingVisibleId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastUploadUrl, setLastUploadUrl] = useState<string | null>(null);

  const fetchImages = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ mine: "true", limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/images?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return data as { items: ImageItem[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchImages().then((data) => {
      if (data) {
        setItems(data.items);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [fetchImages]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const data = await fetchImages(nextCursor);
    if (data) {
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  async function reload() {
    setLoading(true);
    const data = await fetchImages();
    if (data) {
      setItems(data.items);
      setNextCursor(data.nextCursor);
    }
    setLoading(false);
  }

  async function onDelete(id: string) {
    if (!confirm("确定删除该图片吗？（软删除）")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error?.message || "删除失败");
        return;
      }
      setItems((prev) => prev.filter((img) => img.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function onCopy(url: string, id: string) {
    await copyText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function onToggleVisible(image: ImageItem) {
    setTogglingVisibleId(image.id);
    try {
      const res = await fetch(`/api/images/${image.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visible: !image.isVisible }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || "更新可见状态失败");
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === image.id ? { ...item, isVisible: Boolean(data?.image?.isVisible) } : item
        )
      );
    } finally {
      setTogglingVisibleId(null);
    }
  }

  return (
    <div>
      <UploadZone onUploaded={(url) => { setLastUploadUrl(url); reload(); }} />

      {lastUploadUrl && (
        <div style={{
          ...card,
          marginBottom: 20,
          background: "#f0fdf4",
          border: `1px solid #86efac`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 14, color: colors.success, fontWeight: 600 }}>✅ 上传成功</span>
          <code style={{
            flex: 1,
            fontSize: 12,
            background: "#dcfce7",
            padding: "4px 10px",
            borderRadius: 6,
            wordBreak: "break-all",
            color: "#166534",
          }}>{lastUploadUrl}</code>
          <button style={btn("outline")} onClick={() => copyText(lastUploadUrl)}>复制链接</button>
          <button style={{ ...btn("ghost"), fontSize: 18, padding: "2px 8px" }} onClick={() => setLastUploadUrl(null)}>×</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text }}>
          我的图片 {!loading && `(${items.length}${nextCursor ? "+" : ""})`}
        </h2>
      </div>

      {loading && <p style={{ color: colors.muted, textAlign: "center", padding: 40 }}>加载中...</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: colors.muted, textAlign: "center", padding: 40 }}>暂无图片，上传第一张吧！</p>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 14,
      }}>
        {items.map((img) => (
          <div key={img.id} style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <a href={img.pageUrl || img.url} target="_blank" rel="noreferrer" style={{ display: "block", aspectRatio: "4/3", overflow: "hidden" }}>
              <img
                src={img.thumbUrl}
                alt={img.originalName}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </a>
            <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: colors.text, wordBreak: "break-all", fontWeight: 500 }}
                title={img.originalName}>
                {img.originalName.length > 28 ? img.originalName.slice(0, 26) + "…" : img.originalName}
              </div>
              <div style={{ fontSize: 11, color: colors.muted }}>{formatDate(img.createdAt)}</div>
              <div style={{ fontSize: 11, color: img.isVisible ? colors.success : colors.muted }}>
                {img.isVisible ? "可见" : "不可见（外部访问将显示占位图）"}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  style={{ ...btn("outline"), flex: 1, justifyContent: "center", fontSize: 12 }}
                  onClick={() => onCopy(img.url, img.id)}
                >
                  {copiedId === img.id ? "✅ 已复制" : "复制链接"}
                </button>
                <button
                  style={{ ...btn("outline"), fontSize: 12 }}
                  onClick={() => onToggleVisible(img)}
                  disabled={togglingVisibleId === img.id}
                >
                  {togglingVisibleId === img.id
                    ? "更新中..."
                    : img.isVisible
                    ? "设为不可见"
                    : "设为可见"}
                </button>
                <button
                  style={{ ...btn("danger"), fontSize: 12 }}
                  onClick={() => onDelete(img.id)}
                  disabled={deletingId === img.id}
                >
                  {deletingId === img.id ? "…" : "删除"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {nextCursor && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button style={btn("ghost")} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 上传区组件 ───────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }: { onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/images", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "上传失败");
        return;
      }
      onUploaded(data.url);
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{
        ...card,
        marginBottom: 20,
        border: `2px dashed ${dragging ? colors.primary : colors.border}`,
        background: dragging ? "#eff6ff" : colors.card,
        cursor: uploading ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 32,
        transition: "all 0.15s",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? (
        <>
          <div style={{ fontSize: 28 }}>⏳</div>
          <div style={{ fontSize: 14, color: colors.muted }}>上传中，请稍候...</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 32 }}>☁️</div>
          <div style={{ fontSize: 14, color: colors.muted }}>
            拖拽图片到此处，或<span style={{ color: colors.primary, fontWeight: 600 }}>点击上传</span>
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>支持 PNG、JPG、GIF、WEBP，最大 5MB</div>
        </>
      )}
      {error && <div style={{ fontSize: 13, color: colors.danger, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ─── API Key 标签页 ───────────────────────────────────────────────────────────
function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copiedNew, setCopiedNew] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadKeys() {
    setLoading(true);
    const res = await fetch("/api/apikeys");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setKeys(data.keys || []);
    setLoading(false);
  }

  useEffect(() => { loadKeys(); }, []);

  async function createKey() {
    if (!newName.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data?.error?.message || "创建失败");
        return;
      }
      setNewRawKey(data.key.rawKey);
      setCopiedNew(false);
      setNewName("");
      await loadKeys();
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("确定撤销此 API Key？撤销后无法恢复。")) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
      if (res.ok) setKeys((prev) => prev.filter((k) => k.id !== id));
    } finally {
      setRevokingId(null);
    }
  }

  async function copyNewKey() {
    if (!newRawKey) return;
    await copyText(newRawKey);
    setCopiedNew(true);
  }

  return (
    <div>
      {/* 生成新 Key 表单 */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>生成新 API Key</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            style={{ ...input, maxWidth: 320 }}
            placeholder="Key 名称（如：PicGo、自用脚本）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createKey()}
          />
          <button style={btn("primary")} onClick={createKey} disabled={creating || !newName.trim()}>
            {creating ? "生成中..." : "生成 Key"}
          </button>
        </div>
        {createError && <p style={{ margin: "8px 0 0", fontSize: 13, color: colors.danger }}>{createError}</p>}

        {newRawKey && (
          <div style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 10,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
              ⚠️ 请立即保存此 Key，关闭后将无法再次查看！
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{
                flex: 1,
                fontSize: 12,
                background: "#fef3c7",
                padding: "8px 12px",
                borderRadius: 8,
                wordBreak: "break-all",
                color: "#78350f",
              }}>
                {newRawKey}
              </code>
              <button style={btn("outline")} onClick={copyNewKey}>
                {copiedNew ? "✅ 已复制" : "复制"}
              </button>
              <button style={{ ...btn("ghost"), fontSize: 18, padding: "2px 8px" }} onClick={() => setNewRawKey(null)}>
                ×
              </button>
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
              使用方式：<code style={{ background: "#e5e7eb", padding: "2px 6px", borderRadius: 4 }}>
                curl -X POST https://your-domain/api/images -H &quot;Authorization: Bearer {"{API_KEY}"}&quot; -F &quot;file=@image.jpg&quot;
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Key 列表 */}
      <div style={card}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>
          已有 API Key {!loading && `(${keys.length})`}
        </h3>
        {loading && <p style={{ color: colors.muted }}>加载中...</p>}
        {!loading && keys.length === 0 && (
          <p style={{ color: colors.muted, margin: 0 }}>还没有 API Key，立即生成一个吧。</p>
        )}
        {keys.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  {["名称", "前缀", "创建时间", "最后使用", "操作"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      color: colors.muted,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{k.name}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <code style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                        {k.prefix}…
                      </code>
                    </td>
                    <td style={{ padding: "10px 12px", color: colors.muted, whiteSpace: "nowrap" }}>
                      {formatDate(k.createdAt)}
                    </td>
                    <td style={{ padding: "10px 12px", color: colors.muted, whiteSpace: "nowrap" }}>
                      {k.lastUsedAt ? formatDate(k.lastUsedAt) : "从未"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        style={btn("danger")}
                        onClick={() => revokeKey(k.id)}
                        disabled={revokingId === k.id}
                      >
                        {revokingId === k.id ? "撤销中..." : "撤销"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
