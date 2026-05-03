import { requireAdminUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    if (auth.error.status === 401) {
      redirect("/dashboard");
    }
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>无权限访问</h1>
        <p style={{ color: "#6b7280" }}>当前账号不是管理员。</p>
      </main>
    );
  }

  return <AdminClient user={auth.user} />;
}
