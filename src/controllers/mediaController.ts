import type { Request, Response } from "express";
import { findMediaAssetById } from "../repositories/media.repo";
import { sendError } from "../utils/response";

function parsePositiveId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function profilePlaceholder(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="Profile image">
  <rect width="800" height="600" fill="#f3f4f6"/>
  <circle cx="400" cy="240" r="96" fill="#d1d5db"/>
  <rect x="230" y="370" width="340" height="34" rx="17" fill="#d1d5db"/>
  <rect x="270" y="425" width="260" height="24" rx="12" fill="#e5e7eb"/>
  <text x="400" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#6b7280">Profile image</text>
</svg>`;
  return Buffer.from(svg);
}

function postPlaceholder(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="Post image">
  <rect width="800" height="600" fill="#f3f4f6"/>
  <rect x="230" y="180" width="340" height="240" rx="18" fill="#d1d5db"/>
  <rect x="255" y="205" width="290" height="190" rx="8" fill="#f9fafb"/>
  <circle cx="325" cy="265" r="34" fill="#d1d5db"/>
  <path d="M265 390 L365 305 L440 365 L485 315 L535 390 Z" fill="#d1d5db"/>
  <text x="400" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#6b7280">Post image</text>
</svg>`;
  return Buffer.from(svg);
}

function genericImagePlaceholder(label: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${label}">
  <rect width="800" height="600" fill="#f3f4f6"/>
  <rect x="210" y="170" width="380" height="260" rx="20" fill="#d1d5db"/>
  <rect x="245" y="205" width="310" height="190" rx="10" fill="#f9fafb"/>
  <path d="M260 390 L365 300 L450 365 L500 320 L540 390 Z" fill="#d1d5db"/>
  <text x="400" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#6b7280">${label}</text>
</svg>`;
  return Buffer.from(svg);
}

function placeholderPayload(type: string): { contentType: string; body: Buffer } {
  if (type === "document" || type === "revision") {
    return {
      contentType: "application/pdf",
      body: Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
      ),
    };
  }

  if (type === "profile") {
    return {
      contentType: "image/svg+xml; charset=utf-8",
      body: profilePlaceholder(),
    };
  }

  if (type === "post") {
    return {
      contentType: "image/svg+xml; charset=utf-8",
      body: postPlaceholder(),
    };
  }

  return {
    contentType: "image/svg+xml; charset=utf-8",
    body: genericImagePlaceholder(type === "lodge" ? "Lodge image" : "Image"),
  };
}

export async function getMediaHandler(req: Request, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id === null) return sendError(res, 404, "Media hittades inte");

  const asset = await findMediaAssetById(id);
  if (!asset) return sendError(res, 404, "Media hittades inte");

  const etag = `"${asset.checksumSha256}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("Content-Length", String(asset.byteSize));
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.status(200).send(asset.data);
}

export function getMediaPlaceholderHandler(req: Request, res: Response) {
  const { contentType, body } = placeholderPayload(String(req.params.type ?? ""));
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", String(body.length));
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(200).send(body);
}

export default {
  getMediaHandler,
  getMediaPlaceholderHandler,
};
