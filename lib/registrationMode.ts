import { prisma } from "@/lib/prisma";

const ENABLED_VALUES = ["1", "true", "yes", "on"] as const;

function isTruthyEnvValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return ENABLED_VALUES.includes(normalizedValue as (typeof ENABLED_VALUES)[number]);
}

export function isSelfUseModeEnabled() {
  const rawValue = process.env.SELF_USE_MODE || "";
  return isTruthyEnvValue(rawValue);
}

export async function getRegistrationAvailability() {
  const selfUseModeEnabled = isSelfUseModeEnabled();
  if (!selfUseModeEnabled) {
    return {
      selfUseModeEnabled,
      allowRegister: true,
    };
  }

  const existingUserCount = await prisma.user.count();
  return {
    selfUseModeEnabled,
    allowRegister: existingUserCount === 0,
  };
}
