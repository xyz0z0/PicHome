import { RateLimiterMemory } from "rate-limiter-flexible";

export function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

const limiterLogin = new RateLimiterMemory({
  points: 10,
  duration: 10 * 60, // 10 min
  keyPrefix: "pichome:login",
});

const limiterRegister = new RateLimiterMemory({
  points: 5,
  duration: 10 * 60, // 10 min
  keyPrefix: "pichome:register",
});

const limiterUpload = new RateLimiterMemory({
  points: 20,
  duration: 60 * 60, // 1 hour
  keyPrefix: "pichome:upload",
});

async function consume(
  limiter: RateLimiterMemory,
  ip: string
): Promise<{ limited: boolean; retryAfterMs?: number }> {
  try {
    await limiter.consume(ip);
    return { limited: false };
  } catch (e: any) {
    const retryAfterMs = e?.msBeforeNext ?? undefined;
    return { limited: true, retryAfterMs };
  }
}

export async function rateLimitLogin(req: Request) {
  return consume(limiterLogin, getClientIp(req));
}

export async function rateLimitRegister(req: Request) {
  return consume(limiterRegister, getClientIp(req));
}

export async function rateLimitUpload(req: Request) {
  return consume(limiterUpload, getClientIp(req));
}

