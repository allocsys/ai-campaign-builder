// ============================================================================
// Evidence storage adapter (plan.md "Evidence storage provider", decided
// 2026-09-11) -- backs task_submissions.evidence_url with a real uploaded
// file instead of TaskSubmitModal.tsx's filename-placeholder convention.
//
// Provider: Backblaze B2. plan.md frames B2 as "S3-compatible object
// storage" and picks it partly for that S3 compatibility, but this adapter
// deliberately talks to B2's OWN native API (b2_authorize_account /
// b2_get_upload_url / upload) rather than the S3-compatible endpoint --
// the native API needs no AWS SigV4 request signing (just a bearer-style
// auth token plus a SHA1 body checksum, both trivial with Workers'
// crypto.subtle), which is meaningfully less code to get right in a Workers
// runtime with no AWS SDK available. The bucket/pricing/account decision
// from plan.md is unchanged; only the wire protocol used to reach the same
// bucket differs from what "S3-compatible" might imply. If this repo ever
// needs true S3-API compatibility (e.g. a library that only speaks S3),
// swap this file for a SigV4 implementation against
// https://s3.<region>.backblazeb2.com -- the bucket itself works either way.
//
// Auth is re-fetched on every call rather than cached across requests: B2
// account auth tokens are valid for 24h and upload URLs/tokens are valid for
// 24h or until an upload to that URL fails, but Workers has no
// request-shared, safely-invalidatable cache for this without adding a
// KV/DO binding (same "no shared state" constraint noted in vision.ts's key
// rotation comment). One evidence upload is a rare, human-paced action (a
// customer submitting one task), so the extra ~2 round-trips per upload is
// an acceptable tradeoff over adding new infra just to cache a token.
//
// The B2 bucket is private. Downloads go through server-side proxied functions
// in this module (`downloadEvidenceImage`), called by vision.ts server-side
// and by an authenticated review.ts route for the Review Console, rather than
// relying on public URLs.
// ============================================================================

import type { Env } from "../types";
import { EVIDENCE_MIME_TO_EXTENSION } from "@ai-campaign-builder/shared-config";

export interface UploadedEvidence {
  key: string;
}

interface B2AuthorizeResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
}

interface B2GetUploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

interface B2UploadFileResponse {
  fileName: string;
}

// B2 file names are UTF-8 percent-encoded, but "/" is kept literal on
// purpose -- B2 treats it as a virtual-folder delimiter, same as S3 keys.
// encodeURIComponent alone would escape it to %2F.
function encodeB2FileName(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

async function sha1Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authorizeAccount(keyId: string, applicationKey: string): Promise<B2AuthorizeResponse> {
  const credentials = btoa(`${keyId}:${applicationKey}`);
  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) {
    throw new Error(`b2_authorize_account failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as B2AuthorizeResponse;
}

async function getUploadUrl(apiUrl: string, accountAuthToken: string, bucketId: string): Promise<B2GetUploadUrlResponse> {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: accountAuthToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });
  if (!res.ok) {
    throw new Error(`b2_get_upload_url failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as B2GetUploadUrlResponse;
}

// ============================================================================
// Public entry points used by routes/customer.ts, vision.ts, and routes/review.ts
// ============================================================================

// Accepted evidence formats -- matches what a phone camera/screenshot
// realistically produces; anything else is rejected before B2 is even
// contacted (see routes/customer.ts's validation). Sourced from
// packages/shared-config so this mime->extension mapping stays in sync with
// apps/customer/src/routes/TaskSubmitModal.tsx's file-input accept list
// instead of being a second independent hardcoded copy.
export const ALLOWED_EVIDENCE_CONTENT_TYPES: Record<string, string> = EVIDENCE_MIME_TO_EXTENSION;

// Conservative cap: a phone screenshot/photo comfortably fits well under
// this, and it keeps a single upload from tying up a Worker's CPU/memory
// budget or eating unnecessary B2 free-tier storage.
export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function uploadEvidenceImage(
  env: Env,
  customerId: string,
  contentType: string,
  bytes: ArrayBuffer
): Promise<UploadedEvidence> {
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID || !env.B2_BUCKET_NAME) {
    throw new Error("B2 storage is not configured (B2_KEY_ID/B2_APPLICATION_KEY/B2_BUCKET_ID/B2_BUCKET_NAME)");
  }

  const ext = ALLOWED_EVIDENCE_CONTENT_TYPES[contentType];
  if (!ext) {
    throw new Error(`unsupported evidence content type: ${contentType}`);
  }

  const auth = await authorizeAccount(env.B2_KEY_ID, env.B2_APPLICATION_KEY);
  const upload = await getUploadUrl(auth.apiUrl, auth.authorizationToken, env.B2_BUCKET_ID);

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const fileName = `evidence/${customerId}/${timestamp}-${random}.${ext}`;
  const sha1 = await sha1Hex(bytes);

  const uploadRes = await fetch(upload.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: upload.authorizationToken,
      "X-Bz-File-Name": encodeB2FileName(fileName),
      "Content-Type": contentType,
      "X-Bz-Content-Sha1": sha1,
    },
    body: bytes,
  });
  if (!uploadRes.ok) {
    throw new Error(`b2 file upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const uploaded = (await uploadRes.json()) as B2UploadFileResponse;

  return { key: uploaded.fileName };
}

export async function downloadEvidenceImage(
  env: Env,
  key: string
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID || !env.B2_BUCKET_NAME) {
    throw new Error("B2 storage is not configured (B2_KEY_ID/B2_APPLICATION_KEY/B2_BUCKET_ID/B2_BUCKET_NAME)");
  }

  const auth = await authorizeAccount(env.B2_KEY_ID, env.B2_APPLICATION_KEY);
  const res = await fetch(`${auth.downloadUrl}/file/${env.B2_BUCKET_NAME}/${encodeB2FileName(key)}`, {
    method: "GET",
    headers: {
      Authorization: auth.authorizationToken,
    },
  });
  if (!res.ok) {
    throw new Error(`b2 file download failed: ${res.status} ${await res.text()}`);
  }

  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  return { bytes, contentType };
}
