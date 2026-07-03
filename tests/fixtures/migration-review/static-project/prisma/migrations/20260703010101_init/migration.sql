CREATE TABLE "User" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL
);

ALTER TABLE "User" DROP COLUMN "legacyName";
