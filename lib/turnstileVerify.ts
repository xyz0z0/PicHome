const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyJson = {
  success?: boolean;
  "error-codes"?: string[];
};

export function isTurnstileSecretConfigured(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  return typeof secret === "string" && secret.trim().length > 0;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | undefined
): Promise<{ ok: boolean; errorCodes?: string[] }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const json = (await res.json()) as SiteverifyJson;
    if (json.success === true) {
      return { ok: true };
    }
    return { ok: false, errorCodes: json["error-codes"] };
  } catch {
    return { ok: false, errorCodes: ["internal-error"] };
  }
}
