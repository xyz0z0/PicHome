"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: number;
  username: string;
  role: "USER" | "ADMIN";
  disabledAt: string | null;
  createdAt: string;
  _count?: {
    images: number;
    apiKeys: number;
  };
};

type AdminImage = {
  id: string;
  originalName: string;
  createdAt: string;
  isVisible: boolean;
  uploader: {
    id: number;
    username: string;
  };
  url: string;
  pageUrl: string;
  thumbUrl: string;
};

type AdminPageUser = {
  id: number;
  username: string;
  role: "USER" | "ADMIN";
};

type AdminAuditLog = {
  id: number;
  action:
    | "ADMIN_LOGIN"
    | "ADMIN_USER_DISABLE"
    | "ADMIN_USER_ENABLE"
    | "ADMIN_IMAGE_HIDE"
    | "ADMIN_IMAGE_SHOW"
    | "ADMIN_IMAGE_DELETE";
  detail: string | null;
  createdAt: string;
  actor: {
    id: number;
    username: string;
  };
  targetUser: {
    id: number;
    username: string;
  } | null;
};

const colors = {
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  danger: "#ef4444",
  border: "#e5e7eb",
  bg: "#f9fafb",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  success: "#059669",
};

const btn = (
  variant: "primary" | "danger" | "outline" = "primary"
): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  if (variant === "danger") {
    return { ...base, background: colors.danger, color: "#fff" };
  }
  if (variant === "outline") {
    return {
      ...base,
      background: "transparent",
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    };
  }
  return { ...base, background: colors.primary, color: "#fff" };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminClient({ user }: { user: AdminPageUser }) {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "images" | "audit">("users");

  return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      <header
        style={{
          background: colors.card,
          borderBottom: `1px solid ${colors.border}`,
          height: 56,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, color: colors.primary }}>
            PicHome Admin
          </span>
          <span style={{ fontSize: 12, color: colors.muted }}>
            当前管理员：{user.username}
          </span>
        </div>
        <button
          style={btn("outline")}
          onClick={() => router.push("/dashboard")}
        >
          返回工作台
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: 20,
          }}
        >
          <button
            style={{
              ...btn("outline"),
              border: "none",
              borderBottom:
                tab === "users"
                  ? `2px solid ${colors.primary}`
                  : "2px solid transparent",
              borderRadius: 0,
              color: tab === "users" ? colors.primary : colors.muted,
            }}
            onClick={() => setTab("users")}
          >
            用户管理
          </button>
          <button
            style={{
              ...btn("outline"),
              border: "none",
              borderBottom:
                tab === "images"
                  ? `2px solid ${colors.primary}`
                  : "2px solid transparent",
              borderRadius: 0,
              color: tab === "images" ? colors.primary : colors.muted,
            }}
            onClick={() => setTab("images")}
          >
            图片管理
          </button>
          <button
            style={{
              ...btn("outline"),
              border: "none",
              borderBottom:
                tab === "audit"
                  ? `2px solid ${colors.primary}`
                  : "2px solid transparent",
              borderRadius: 0,
              color: tab === "audit" ? colors.primary : colors.muted,
            }}
            onClick={() => setTab("audit")}
          >
            审计日志
          </button>
        </div>

        {tab === "users" ? <AdminUsersTab currentUserId={user.id} /> : null}
        {tab === "images" ? <AdminImagesTab /> : null}
        {tab === "audit" ? <AdminAuditLogsTab /> : null}
      </main>
    </div>
  );
}

function AdminUsersTab({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users?limit=100");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "加载用户失败");
    }
    return data.users as AdminUser[];
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const nextUsers = await fetchUsers();
      setUsers(nextUsers);
    } catch (e: any) {
      setError(e?.message || "加载用户失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggleUser(user: AdminUser) {
    const operation = user.disabledAt ? "enable" : "disable";
    setUpdatingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error?.message || "操作失败");
        return;
      }
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, disabledAt: data.user.disabledAt } : item
        )
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <p style={{ color: colors.muted }}>正在加载用户...</p>;
  }
  if (error) {
    return (
      <div>
        <p style={{ color: colors.danger }}>{error}</p>
        <button style={btn("outline")} onClick={reload}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...panelStyle }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>用户名</th>
            <th style={thStyle}>角色</th>
            <th style={thStyle}>状态</th>
            <th style={thStyle}>图片数</th>
            <th style={thStyle}>创建时间</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => {
            const isCurrentUser = item.id === currentUserId;
            const isDisabled = Boolean(item.disabledAt);
            return (
              <tr key={item.id}>
                <td style={tdStyle}>{item.id}</td>
                <td style={tdStyle}>{item.username}</td>
                <td style={tdStyle}>{item.role}</td>
                <td style={tdStyle}>
                  {isDisabled ? (
                    <span style={{ color: colors.danger }}>已禁用</span>
                  ) : (
                    <span style={{ color: colors.success }}>正常</span>
                  )}
                </td>
                <td style={tdStyle}>{item._count?.images || 0}</td>
                <td style={tdStyle}>{formatDate(item.createdAt)}</td>
                <td style={tdStyle}>
                  {isCurrentUser ? (
                    <span style={{ color: colors.muted }}>当前账号</span>
                  ) : (
                    <button
                      style={btn(isDisabled ? "primary" : "danger")}
                      disabled={updatingId === item.id}
                      onClick={() => toggleUser(item)}
                    >
                      {updatingId === item.id
                        ? "处理中..."
                        : isDisabled
                        ? "启用"
                        : "禁用"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminImagesTab() {
  const [items, setItems] = useState<AdminImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null);

  const fetchImages = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "30" });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const res = await fetch(`/api/admin/images?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "加载图片失败");
    }
    return data as { items: AdminImage[]; nextCursor: string | null };
  }, []);

  async function loadInitial() {
    setLoading(true);
    try {
      const data = await fetchImages();
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (e: any) {
      alert(e?.message || "加载图片失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadMore() {
    if (!nextCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const data = await fetchImages(nextCursor);
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function deleteImage(id: string) {
    if (!confirm("确认删除该图片？")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/images/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error?.message || "删除失败");
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleVisibility(item: AdminImage) {
    setTogglingVisibilityId(item.id);
    try {
      const operation = item.isVisible ? "hide" : "show";
      const res = await fetch(`/api/admin/images/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error?.message || "更新可见状态失败");
        return;
      }
      setItems((prev) =>
        prev.map((image) =>
          image.id === item.id
            ? { ...image, isVisible: Boolean(data?.image?.isVisible) }
            : image
        )
      );
    } finally {
      setTogglingVisibilityId(null);
    }
  }

  if (loading) {
    return <p style={{ color: colors.muted }}>正在加载图片...</p>;
  }

  return (
    <div style={{ ...panelStyle }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>图片</th>
            <th style={thStyle}>文件名</th>
            <th style={thStyle}>上传者</th>
            <th style={thStyle}>上传时间</th>
            <th style={thStyle}>可见性</th>
            <th style={thStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={tdStyle}>
                <img
                  src={item.thumbUrl}
                  alt={item.originalName}
                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
                />
              </td>
              <td style={tdStyle}>{item.originalName}</td>
              <td style={tdStyle}>
                {item.uploader.username} (#{item.uploader.id})
              </td>
              <td style={tdStyle}>{formatDate(item.createdAt)}</td>
              <td style={tdStyle}>
                <span style={{ color: item.isVisible ? colors.success : colors.muted }}>
                  {item.isVisible ? "可见" : "不可见"}
                </span>
              </td>
              <td style={tdStyle}>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={item.pageUrl || item.url} target="_blank" style={{ ...btn("outline"), textDecoration: "none" }}>
                    查看
                  </a>
                  <button
                    style={btn("outline")}
                    onClick={() => toggleVisibility(item)}
                    disabled={togglingVisibilityId === item.id}
                  >
                    {togglingVisibilityId === item.id
                      ? "更新中..."
                      : item.isVisible
                      ? "设为不可见"
                      : "设为可见"}
                  </button>
                  <button
                    style={btn("danger")}
                    disabled={deletingId === item.id}
                    onClick={() => deleteImage(item.id)}
                  >
                    {deletingId === item.id ? "删除中..." : "删除"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16 }}>
        {nextCursor ? (
          <button
            style={btn("outline")}
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        ) : (
          <span style={{ color: colors.muted, fontSize: 12 }}>没有更多了</span>
        )}
      </div>
    </div>
  );
}

function AdminAuditLogsTab() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchLogs = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "30" });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "加载审计日志失败");
    }
    return data as { logs: AdminAuditLog[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLogs()
      .then((data) => {
        setLogs(data.logs);
        setNextCursor(data.nextCursor);
      })
      .catch((e: any) => {
        alert(e?.message || "加载审计日志失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function loadMore() {
    if (!nextCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const data = await fetchLogs(nextCursor);
      setLogs((prev) => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function getActionLabel(action: AdminAuditLog["action"]) {
    if (action === "ADMIN_LOGIN") {
      return "管理员登录";
    }
    if (action === "ADMIN_USER_DISABLE") {
      return "禁用用户";
    }
    if (action === "ADMIN_USER_ENABLE") {
      return "启用用户";
    }
    if (action === "ADMIN_IMAGE_HIDE") {
      return "隐藏图片";
    }
    if (action === "ADMIN_IMAGE_SHOW") {
      return "显示图片";
    }
    if (action === "ADMIN_IMAGE_DELETE") {
      return "删除图片";
    }
    return "未知操作";
  }

  if (loading) {
    return <p style={{ color: colors.muted }}>正在加载审计日志...</p>;
  }

  return (
    <div style={panelStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>时间</th>
            <th style={thStyle}>操作</th>
            <th style={thStyle}>操作者</th>
            <th style={thStyle}>目标用户</th>
            <th style={thStyle}>详情</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={tdStyle}>{formatDate(log.createdAt)}</td>
              <td style={tdStyle}>{getActionLabel(log.action)}</td>
              <td style={tdStyle}>
                {log.actor.username} (#{log.actor.id})
              </td>
              <td style={tdStyle}>
                {log.targetUser
                  ? `${log.targetUser.username} (#${log.targetUser.id})`
                  : "-"}
              </td>
              <td style={tdStyle}>{log.detail || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16 }}>
        {nextCursor ? (
          <button
            style={btn("outline")}
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        ) : (
          <span style={{ color: colors.muted, fontSize: 12 }}>没有更多了</span>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 14,
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 820,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 13,
  color: colors.muted,
  borderBottom: `1px solid ${colors.border}`,
  padding: "10px 8px",
};

const tdStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.text,
  borderBottom: `1px solid ${colors.border}`,
  padding: "10px 8px",
  verticalAlign: "middle",
};
