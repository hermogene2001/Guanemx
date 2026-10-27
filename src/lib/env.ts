import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
  PAYMENT_PROVIDER_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  MAIL_DRIVER: z.enum(["log", "resend", "smtp"]).default("log"),
  MAIL_FROM: z.string().email().optional().or(z.literal("")),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  PAYOUT_ENCRYPTION_KEY: z.string().optional(),
  REFERRAL_RECHARGE_BONUS_PERCENT: z.coerce.number().min(0).max(100).default(0),
  USD_TO_RWF_RATE: z.coerce.number().positive().default(1400),
  WITHDRAWAL_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  MARKET_DATA_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters").optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.format());
    throw new Error("Invalid environment variables");
  }
  
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isProduction() {
  return getEnv().NODE_ENV === "production";
}

export function isDevelopment() {
  return getEnv().NODE_ENV === "development";
}
