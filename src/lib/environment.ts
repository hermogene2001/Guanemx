export function hasDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && !url.includes("user:password@") && !url.includes("YOUR_DATABASE_URL"));
}
