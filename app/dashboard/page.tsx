import { requireCurrentUser, AUTH_ERROR_CODE } from "@/lib/auth";
import { getRegistrationAvailability } from "@/lib/registrationMode";
import LoginCard from "./LoginCard";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const auth = await requireCurrentUser();
  if ("error" in auth) {
    if (auth.error.code === AUTH_ERROR_CODE.accountDisabled) {
      return (
        <main style={{ padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>账号已禁用</h1>
          <p style={{ color: "#6b7280" }}>请联系管理员处理。</p>
        </main>
      );
    }
    const registrationAvailability = await getRegistrationAvailability();
    return (
      <LoginCard
        allowRegister={registrationAvailability.allowRegister}
        selfUseModeEnabled={registrationAvailability.selfUseModeEnabled}
      />
    );
  }

  return <DashboardClient user={auth.user} />;
}

