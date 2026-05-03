"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type LoginCardProps = {
  allowRegister: boolean;
  selfUseModeEnabled: boolean;
};
const LOGIN_ONLY_MODES: Mode[] = ["login"];
const LOGIN_REGISTER_MODES: Mode[] = ["login", "register"];

const TURNSTILE_SITE_KEY =
  typeof process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY === "string"
    ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY.trim()
    : "";
const TURNSTILE_WIDGET_ENABLED = TURNSTILE_SITE_KEY.length > 0;

const colors = {
  primary: "#4f46e5",
  danger: "#ef4444",
  border: "#e5e7eb",
  muted: "#6b7280",
  bg: "#f9fafb",
};

export default function LoginCard({
  allowRegister,
  selfUseModeEnabled,
}: LoginCardProps) {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!username.trim()) { setError("请输入用户名"); return; }
    if (!password)         { setError("请输入密码"); return; }
    if (mode === "register" && !allowRegister) {
      setError("当前为自用模式，已关闭公开注册");
      return;
    }
    if (mode === "register" && TURNSTILE_WIDGET_ENABLED && !turnstileToken) {
      setError("请完成人机验证");
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload: {
        username: string;
        password: string;
        turnstileToken?: string;
      } = { username: username.trim(), password };
      if (mode === "register" && turnstileToken) {
        payload.turnstileToken = turnstileToken;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || data?.message || "请求失败，请重试");
        turnstileRef.current?.reset();
        setTurnstileToken("");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const modes = allowRegister ? LOGIN_REGISTER_MODES : LOGIN_ONLY_MODES;
  return (
    <div style={{
      minHeight: "100vh",
      background: colors.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "#fff",
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        padding: 36,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: colors.primary }}>PicHome</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: colors.muted }}>简单好用的私人图床</p>
        </div>

        {/* 模式切换 */}
        <div style={{
          display: "flex",
          background: colors.bg,
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
        }}>
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setTurnstileToken("");
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? colors.primary : colors.muted,
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        {!allowRegister && selfUseModeEnabled && (
          <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted }}>
            当前为自用模式，仅支持已有账号登录。
          </p>
        )}

        {/* 表单 */}
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              用户名
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              placeholder="请输入用户名"
              autoComplete="username"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              placeholder={mode === "register" ? "至少 6 位" : "请输入密码"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {mode === "register" && TURNSTILE_WIDGET_ENABLED && (
            <div style={{ minHeight: 70 }}>
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                options={{ size: "flexible", theme: "auto" }}
                onSuccess={setTurnstileToken}
                onExpire={() => {
                  setTurnstileToken("");
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fef2f2",
              border: `1px solid #fecaca`,
              fontSize: 13,
              color: colors.danger,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={loading}
            style={{
              padding: "11px 0",
              borderRadius: 10,
              border: "none",
              background: loading ? "#a5b4fc" : colors.primary,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              transition: "background 0.15s",
              marginTop: 4,
            }}
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册账号"}
          </button>
        </div>
      </div>
    </div>
  );
}
