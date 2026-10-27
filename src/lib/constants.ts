export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "guanemx_session";

export const RATE_LIMITS = {
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  PASSWORD_RESET_REQUEST: { limit: 3, windowMs: 60 * 60 * 1000 },
  RECHARGE_REQUEST: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  WITHDRAWAL_REQUEST: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export const FILE_UPLOAD = {
  MAX_PROOF_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_PROOF_MIME_TYPES: ["image/jpeg", "image/png", "image/jpg", "application/pdf"] as const,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
