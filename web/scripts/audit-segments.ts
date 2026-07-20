/**
 * Audit local CSV store segment folders (no Mongo).
 */
import fs from "fs/promises";
import path from "path";
import { LOCAL_DATA_ROOT } from "../src/lib/storage";

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function main() {
  for (const exchange of ["NSE", "BSE"]) {
    console.log(`\n=== ${exchange} ===`);
    for (const segment of ["INDEX", "STOCK", "OTHER"]) {
      const root = path.join(LOCAL_DATA_ROOT, exchange, segment);
      const symbols = await listDirs(root);
      console.log(`${segment}: ${symbols.length} symbols`);
      if (symbols.length && symbols.length <= 20) {
        console.log(" ", symbols.join(", "));
      } else if (symbols.length) {
        console.log(" ", symbols.slice(0, 12).join(", "), "…");
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
