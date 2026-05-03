import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ENV_BASE_URL = "PICHOME_BASE_URL";
const ENV_API_KEY = "PICHOME_API_KEY";
const ENV_TIMEOUT_MS = "PICHOME_REQUEST_TIMEOUT_MS";
const ENV_UPLOAD_MAX_BYTES = "PICHOME_UPLOAD_MAX_BYTES";

const TOOL_LIST_IMAGES = "pichome_list_images";
const TOOL_DELETE_IMAGE = "pichome_delete_image";
const TOOL_UPLOAD_IMAGE_FROM_URL = "pichome_upload_image_from_url";
const TOOL_UPLOAD_IMAGE_BASE64 = "pichome_upload_image_base64";
const TOOL_UPLOAD_IMAGE_FILE_PATH = "pichome_upload_image_file_path";

const HTTP_METHOD_DELETE = "DELETE";
const HTTP_METHOD_GET = "GET";
const HTTP_METHOD_POST = "POST";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPLOAD_FILE_NAME = "mcp-upload-image";
const DEFAULT_BINARY_CONTENT_TYPE = "application/octet-stream";
const MIME_IMAGE_PREFIX = "image/";
const BASE64_ENCODING = "base64";
const IMAGE_EXTENSION_CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
const SUCCESS_STATUS_MIN = 200;
const SUCCESS_STATUS_MAX = 299;

function readRequiredEnv(name) {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return rawValue.trim();
}

function readNumberEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }
  return parsedValue;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function isSuccessStatus(status) {
  return status >= SUCCESS_STATUS_MIN && status <= SUCCESS_STATUS_MAX;
}

function buildApiUrl(baseUrl, pathname, query) {
  const url = new URL(`${baseUrl}${pathname}`);
  const entries = Object.entries(query || {});
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timerId };
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessageFromBody(body, fallbackMessage) {
  if (body && typeof body === "object") {
    const errorMessage = body?.error?.message;
    if (typeof errorMessage === "string" && errorMessage.length > 0) {
      return errorMessage;
    }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message;
    }
  }
  return fallbackMessage;
}

async function callPicHomeJson({
  baseUrl,
  apiKey,
  timeoutMs,
  pathname,
  method,
  query,
  body,
}) {
  const url = buildApiUrl(baseUrl, pathname, query);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const { signal, timerId } = createAbortSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    const payload = await parseJsonSafe(response);

    if (!isSuccessStatus(response.status)) {
      const message = getErrorMessageFromBody(
        payload,
        `PicHome API request failed with status ${response.status}`
      );
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timerId);
  }
}

function getFileNameFromUrl(imageUrl, fallbackName) {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname || "";
    const name = pathname.split("/").filter(Boolean).pop();
    return name || fallbackName;
  } catch {
    return fallbackName;
  }
}

async function downloadImageBuffer(imageUrl, timeoutMs, maxBytes) {
  const { signal, timerId } = createAbortSignal(timeoutMs);
  try {
    const response = await fetch(imageUrl, { method: HTTP_METHOD_GET, signal });
    if (!isSuccessStatus(response.status)) {
      throw new Error(`Failed to download image, status ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith(MIME_IMAGE_PREFIX)) {
      throw new Error("Target URL is not an image resource");
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Image is too large, max bytes: ${maxBytes}`);
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  } finally {
    clearTimeout(timerId);
  }
}

async function uploadImageBuffer({
  baseUrl,
  apiKey,
  timeoutMs,
  buffer,
  contentType,
  fileName,
}) {
  const formData = new FormData();
  const fileBlob = new Blob([buffer], {
    type: contentType || DEFAULT_BINARY_CONTENT_TYPE,
  });
  formData.append("file", fileBlob, fileName);

  const { signal, timerId } = createAbortSignal(timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/images`, {
      method: HTTP_METHOD_POST,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal,
    });

    const payload = await parseJsonSafe(response);
    if (!isSuccessStatus(response.status)) {
      const message = getErrorMessageFromBody(
        payload,
        `Image upload failed with status ${response.status}`
      );
      throw new Error(message);
    }

    return payload;
  } finally {
    clearTimeout(timerId);
  }
}

async function uploadImageFromUrl({
  baseUrl,
  apiKey,
  timeoutMs,
  imageUrl,
  fileName,
  maxBytes,
}) {
  const downloaded = await downloadImageBuffer(imageUrl, timeoutMs, maxBytes);
  return uploadImageBuffer({
    baseUrl,
    apiKey,
    timeoutMs,
    buffer: downloaded.buffer,
    contentType: downloaded.contentType,
    fileName,
  });
}

function decodeBase64ImagePayload(base64Data) {
  const dataPrefix = "data:";
  const base64Marker = ";base64,";
  let payload = base64Data;
  let contentType = DEFAULT_BINARY_CONTENT_TYPE;

  if (base64Data.startsWith(dataPrefix) && base64Data.includes(base64Marker)) {
    const markerIndex = base64Data.indexOf(base64Marker);
    const mimeSection = base64Data.slice(dataPrefix.length, markerIndex).trim();
    const payloadSection = base64Data.slice(markerIndex + base64Marker.length);
    if (mimeSection.length > 0) {
      contentType = mimeSection;
    }
    payload = payloadSection;
  }

  const cleanedPayload = payload.replace(/\s+/g, "");
  if (cleanedPayload.length === 0) {
    throw new Error("Parameter base64Data is empty.");
  }

  const buffer = Buffer.from(cleanedPayload, BASE64_ENCODING);
  if (buffer.byteLength === 0) {
    throw new Error("Parameter base64Data is invalid.");
  }

  return { buffer, contentType };
}

function getFileNameFromPath(filePath, fallbackName) {
  const parsed = path.parse(filePath);
  if (typeof parsed.base === "string" && parsed.base.length > 0) {
    return parsed.base;
  }
  return fallbackName;
}

function guessContentTypeFromPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSION_CONTENT_TYPES[extension] || DEFAULT_BINARY_CONTENT_TYPE;
}

async function readLocalFileForUpload(filePath, maxBytes) {
  const resolvedPath = path.resolve(filePath);
  const stats = await stat(resolvedPath);
  if (!stats.isFile()) {
    throw new Error("Parameter filePath must point to a file.");
  }
  if (stats.size > maxBytes) {
    throw new Error(`Image is too large, max bytes: ${maxBytes}`);
  }
  const fileBuffer = await readFile(resolvedPath);
  return { fileBuffer, resolvedPath };
}

function asTextContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const baseUrl = normalizeBaseUrl(readRequiredEnv(ENV_BASE_URL));
const apiKey = readRequiredEnv(ENV_API_KEY);
const timeoutMs = readNumberEnv(ENV_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
const uploadMaxBytes = readNumberEnv(
  ENV_UPLOAD_MAX_BYTES,
  DEFAULT_UPLOAD_MAX_BYTES
);

const server = new Server(
  {
    name: "pichome-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: TOOL_LIST_IMAGES,
        description: "List current user's images from PicHome.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              minimum: 1,
              maximum: MAX_LIMIT,
              default: DEFAULT_LIMIT,
            },
            cursor: {
              type: "string",
              description: "Cursor returned by previous list call.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: TOOL_DELETE_IMAGE,
        description: "Soft delete an image by image id.",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              minLength: 1,
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: TOOL_UPLOAD_IMAGE_FROM_URL,
        description:
          "Download an image from a public URL and upload it to PicHome.",
        inputSchema: {
          type: "object",
          required: ["imageUrl"],
          properties: {
            imageUrl: {
              type: "string",
              format: "uri",
            },
            fileName: {
              type: "string",
              minLength: 1,
              description: "Optional filename override.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: TOOL_UPLOAD_IMAGE_BASE64,
        description: "Upload image from base64 content directly to PicHome.",
        inputSchema: {
          type: "object",
          required: ["base64Data"],
          properties: {
            base64Data: {
              type: "string",
              minLength: 1,
              description:
                "Raw base64 string or data URL format: data:image/png;base64,...",
            },
            fileName: {
              type: "string",
              minLength: 1,
              description: "Optional filename override.",
            },
            contentType: {
              type: "string",
              minLength: 1,
              description:
                "Optional MIME type, used when base64Data is not data URL.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: TOOL_UPLOAD_IMAGE_FILE_PATH,
        description: "Upload image from a local file path directly to PicHome.",
        inputSchema: {
          type: "object",
          required: ["filePath"],
          properties: {
            filePath: {
              type: "string",
              minLength: 1,
              description: "Absolute or relative local file path.",
            },
            fileName: {
              type: "string",
              minLength: 1,
              description: "Optional filename override.",
            },
            contentType: {
              type: "string",
              minLength: 1,
              description:
                "Optional MIME type override, inferred from file extension by default.",
            },
          },
          additionalProperties: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};

  if (toolName === TOOL_LIST_IMAGES) {
    const parsedLimit = Number.parseInt(String(args.limit ?? DEFAULT_LIMIT), 10);
    const limit = Math.min(
      Math.max(Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const cursor = typeof args.cursor === "string" ? args.cursor : undefined;
    const result = await callPicHomeJson({
      baseUrl,
      apiKey,
      timeoutMs,
      pathname: "/api/images",
      method: HTTP_METHOD_GET,
      query: {
        mine: "true",
        limit,
        cursor,
      },
    });
    return asTextContent(result);
  }

  if (toolName === TOOL_DELETE_IMAGE) {
    const id = typeof args.id === "string" ? args.id.trim() : "";
    if (!id) {
      throw new Error("Parameter id is required.");
    }
    const result = await callPicHomeJson({
      baseUrl,
      apiKey,
      timeoutMs,
      pathname: `/api/images/${encodeURIComponent(id)}`,
      method: HTTP_METHOD_DELETE,
    });
    return asTextContent(result);
  }

  if (toolName === TOOL_UPLOAD_IMAGE_FROM_URL) {
    const imageUrl = typeof args.imageUrl === "string" ? args.imageUrl.trim() : "";
    if (!imageUrl) {
      throw new Error("Parameter imageUrl is required.");
    }
    const fileNameInput =
      typeof args.fileName === "string" ? args.fileName.trim() : "";
    const fileName =
      fileNameInput || getFileNameFromUrl(imageUrl, DEFAULT_UPLOAD_FILE_NAME);
    const result = await uploadImageFromUrl({
      baseUrl,
      apiKey,
      timeoutMs,
      imageUrl,
      fileName,
      maxBytes: uploadMaxBytes,
    });
    return asTextContent(result);
  }

  if (toolName === TOOL_UPLOAD_IMAGE_BASE64) {
    const base64Data =
      typeof args.base64Data === "string" ? args.base64Data.trim() : "";
    if (!base64Data) {
      throw new Error("Parameter base64Data is required.");
    }

    const fileNameInput =
      typeof args.fileName === "string" ? args.fileName.trim() : "";
    const contentTypeInput =
      typeof args.contentType === "string" ? args.contentType.trim() : "";
    const decoded = decodeBase64ImagePayload(base64Data);
    const fileName = fileNameInput || DEFAULT_UPLOAD_FILE_NAME;
    const contentType = contentTypeInput || decoded.contentType;

    if (decoded.buffer.byteLength > uploadMaxBytes) {
      throw new Error(`Image is too large, max bytes: ${uploadMaxBytes}`);
    }

    const result = await uploadImageBuffer({
      baseUrl,
      apiKey,
      timeoutMs,
      buffer: decoded.buffer,
      contentType,
      fileName,
    });
    return asTextContent(result);
  }

  if (toolName === TOOL_UPLOAD_IMAGE_FILE_PATH) {
    const filePathInput =
      typeof args.filePath === "string" ? args.filePath.trim() : "";
    if (!filePathInput) {
      throw new Error("Parameter filePath is required.");
    }

    const fileNameInput =
      typeof args.fileName === "string" ? args.fileName.trim() : "";
    const contentTypeInput =
      typeof args.contentType === "string" ? args.contentType.trim() : "";

    const localFile = await readLocalFileForUpload(filePathInput, uploadMaxBytes);
    const fileName =
      fileNameInput ||
      getFileNameFromPath(localFile.resolvedPath, DEFAULT_UPLOAD_FILE_NAME);
    const contentType =
      contentTypeInput || guessContentTypeFromPath(localFile.resolvedPath);

    const result = await uploadImageBuffer({
      baseUrl,
      apiKey,
      timeoutMs,
      buffer: localFile.fileBuffer,
      contentType,
      fileName,
    });
    return asTextContent(result);
  }

  throw new Error(`Unsupported tool: ${toolName}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
