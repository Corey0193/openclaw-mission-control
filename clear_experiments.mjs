/**
 * clear_experiments.mjs
 *
 * Archives all pre-realism-fix experiment JSON files and deletes all
 * experiment records from Convex so Mission Control starts fresh.
 *
 * Usage:
 *   node clear_experiments.mjs [--dry-run]
 */

import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("VITE_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const HOME = process.env.HOME || "/home/cburroughs";
const WORKSPACE_DIR = process.env.OPENCLAW_WORKSPACE || path.join(HOME, ".openclaw/workspace-copy");
const EXPERIMENTS_DIR = path.join(WORKSPACE_DIR, "experiments");
const COMPLETED_DIR = path.join(EXPERIMENTS_DIR, "completed");
const MILESTONES_DIR = path.join(EXPERIMENTS_DIR, "milestones");
const ARCHIVE_DIR = path.join(EXPERIMENTS_DIR, "pre_realism_fix");

const client = new ConvexClient(CONVEX_URL);

async function run() {
  console.log(DRY_RUN ? "[DRY RUN] No changes will be made.\n" : "");

  // 1. Archive completed JSON files
  if (fs.existsSync(COMPLETED_DIR)) {
    const files = fs.readdirSync(COMPLETED_DIR).filter(f => f.endsWith(".json"));
    if (files.length > 0) {
      if (!DRY_RUN) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      for (const file of files) {
        const src = path.join(COMPLETED_DIR, file);
        const dst = path.join(ARCHIVE_DIR, file);
        console.log(`  archive completed: ${file}`);
        if (!DRY_RUN) fs.renameSync(src, dst);
      }
    }
  }

  // 2. Archive milestone JSON files
  if (fs.existsSync(MILESTONES_DIR)) {
    const files = fs.readdirSync(MILESTONES_DIR).filter(f => f.endsWith(".json"));
    if (files.length > 0) {
      const milestonesArchive = path.join(ARCHIVE_DIR, "milestones");
      if (!DRY_RUN) fs.mkdirSync(milestonesArchive, { recursive: true });
      for (const file of files) {
        const src = path.join(MILESTONES_DIR, file);
        const dst = path.join(milestonesArchive, file);
        console.log(`  archive milestone: ${file}`);
        if (!DRY_RUN) fs.renameSync(src, dst);
      }
    }
  }

  // 3. Delete all experiments from Convex
  console.log("\nDeleting all experiments from Convex...");
  if (!DRY_RUN) {
    const result = await client.mutation(api.experiments.deleteAllExperiments, {
      tenantId: "default",
    });
    console.log(`  Deleted ${result.deleted} experiment records.`);
  } else {
    console.log("  [DRY RUN] Would call deleteAllExperiments.");
  }

  console.log("\nDone. Mission Control experiments cleared.");
  console.log(`Old JSON files archived to: ${ARCHIVE_DIR}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
