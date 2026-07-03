export const databaseUrl = process.env.DATABASE_URL;
export const port = process.env.PORT ?? "3000";
export const publicUrl = import.meta.env.NEXT_PUBLIC_APP_URL;
export const requiredToken = env("SERVICE_TOKEN");
