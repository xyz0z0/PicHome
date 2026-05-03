/** @type {import('next').NextConfig} */
const GLOBAL_HEADER_SOURCE = "/(.*)";
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ["'self'", "https://challenges.cloudflare.com"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  scriptSrcBase: ["'self'", "'unsafe-inline'"],
  scriptSrcThirdParty: ["https://challenges.cloudflare.com"],
  connectSrcBase: ["'self'", "https:"],
  connectSrcThirdParty: ["https://challenges.cloudflare.com"],
  connectSrcDevExtra: ["ws:", "wss:"],
  formAction: ["'self'"],
};

function createContentSecurityPolicy() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const scriptSrcValues = isDevelopment
    ? [
        ...CSP_DIRECTIVES.scriptSrcBase,
        ...CSP_DIRECTIVES.scriptSrcThirdParty,
        "'unsafe-eval'",
      ]
    : [...CSP_DIRECTIVES.scriptSrcBase, ...CSP_DIRECTIVES.scriptSrcThirdParty];
  const connectSrcValues = isDevelopment
    ? [
        ...CSP_DIRECTIVES.connectSrcBase,
        ...CSP_DIRECTIVES.connectSrcThirdParty,
        ...CSP_DIRECTIVES.connectSrcDevExtra,
      ]
    : [...CSP_DIRECTIVES.connectSrcBase, ...CSP_DIRECTIVES.connectSrcThirdParty];
  return [
    `default-src ${CSP_DIRECTIVES.defaultSrc.join(" ")}`,
    `base-uri ${CSP_DIRECTIVES.baseUri.join(" ")}`,
    `frame-ancestors ${CSP_DIRECTIVES.frameAncestors.join(" ")}`,
    `frame-src ${CSP_DIRECTIVES.frameSrc.join(" ")}`,
    `img-src ${CSP_DIRECTIVES.imgSrc.join(" ")}`,
    `style-src ${CSP_DIRECTIVES.styleSrc.join(" ")}`,
    `script-src ${scriptSrcValues.join(" ")}`,
    `connect-src ${connectSrcValues.join(" ")}`,
    `form-action ${CSP_DIRECTIVES.formAction.join(" ")}`,
  ].join("; ");
}

const SECURITY_HEADERS = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: createContentSecurityPolicy(),
  },
];

const nextConfig = {
  // Let the adapter routes control Content-Type and caching.
  //
  // 局域网用 IP（如 http://192.168.x.x:3000）访问 dev 时，不要在 allowedDevOrigins 里写带
  // 协议的完整 URL：Next 只比对 hostname，写错会开启 block 模式导致 /_next 静态资源 403。
  // 未配置 allowedDevOrigins 时仅 warn，本机 + 局域网均可访问。若必须收紧，请只写 hostname，
  // 例如: allowedDevOrigins: ["127.0.0.1", "192.168.1.23"]
  async headers() {
    return [
      {
        source: GLOBAL_HEADER_SOURCE,
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;

