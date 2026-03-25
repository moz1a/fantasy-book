import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
  // Для локальной БД можно оставить false.
  // Для некоторых облачных PostgreSQL-провайдеров может понадобиться SSL.
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      state_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}



// import Database from "better-sqlite3";
// import type { Database as DatabaseType } from "better-sqlite3";
// import fs from "node:fs";
// import path from "node:path";
// import { fileURLToPath } from "node:url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // db.ts: .../apps/api/src/db/db.ts → поднимаемся в .../apps/api
// const apiRoot = path.resolve(__dirname, "..", "..");
// const dataDir = path.join(apiRoot, "data");

// // ВАЖНО: создаём папку до открытия БД
// fs.mkdirSync(dataDir, { recursive: true }); // [web:132]

// const dbPath = path.join(dataDir, "game.sqlite");

// console.log("DB PATH:", dbPath);
// console.log("DIR EXISTS:", fs.existsSync(dataDir));

// export const db: DatabaseType = new Database(dbPath);

// db.pragma("journal_mode = WAL"); // [web:115]
// db.exec(`
//   CREATE TABLE IF NOT EXISTS sessions (
//     id TEXT PRIMARY KEY,
//     state_json TEXT NOT NULL
//   );
// `);

// db.pragma("wal_checkpoint(FULL)");
