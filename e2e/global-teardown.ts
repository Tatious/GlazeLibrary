import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default function globalTeardown() {
  const dbPath = process.env.GLAZE_DB_PATH;
  if (!dbPath || path.dirname(dbPath) !== os.tmpdir()) return;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}