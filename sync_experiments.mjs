import { ConvexClient } from "convex/browser";
import { api, internal } from "./convex/_generated/api.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("VITE_CONVEX_URL not found in .env.local");
  process.exit(1);
}

const client = new ConvexClient(CONVEX_URL);

// Use environment variables or sensible defaults to avoid hardcoding (S1)
const HOME = process.env.HOME || "/home/cburroughs";
const WORKSPACE_DIR = process.env.OPENCLAW_WORKSPACE || path.join(HOME, ".openclaw/workspace-copy");
const EXPERIMENTS_DIR = path.join(WORKSPACE_DIR, "experiments");

async function sync() {
  console.log(`Starting sync from ${EXPERIMENTS_DIR}...`);
  const now = Date.now();

  // 1. Check Compute Loop Status
  const lockPath = path.join(WORKSPACE_DIR, "run_experiment.lock");
  const isRunning = fs.existsSync(lockPath);
  let lastHeartbeat = 0;
  if (isRunning) {
    lastHeartbeat = fs.statSync(lockPath).mtimeMs;
  } else {
    const completedDir = path.join(EXPERIMENTS_DIR, "completed");
    if (fs.existsSync(completedDir)) {
      const files = fs.readdirSync(completedDir).filter(f => f.endsWith(".json"));
      if (files.length > 0) {
        const latestFile = files.sort().reverse()[0];
        lastHeartbeat = fs.statSync(path.join(completedDir, latestFile)).mtimeMs;
      }
    }
  }

  try {
    await client.mutation(api.experiments.syncExperiment, {
      tenantId: "default",
      experimentId: "system_compute_loop",
      hypothesis: "Internal state for compute loop status",
      status: isRunning ? "active" : "idle",
      completedAt: new Date(lastHeartbeat).toISOString(),
      lastSyncedAt: now,
    });
  } catch (err) {
    console.error("Failed to sync compute loop status:", err.message);
  }

  // 2. Sync Completed & Milestones
  const completedDir = path.join(EXPERIMENTS_DIR, "completed");
  if (fs.existsSync(completedDir)) {
    const completedFiles = fs.readdirSync(completedDir).filter(f => f.endsWith(".json"));
    const milestonesDir = path.join(EXPERIMENTS_DIR, "milestones");
    const milestonesFiles = new Set(
      fs.existsSync(milestonesDir) ? fs.readdirSync(milestonesDir).filter(f => f.endsWith(".json")) : []
    );

    for (const file of completedFiles) {
      try {
        const filePath = path.join(completedDir, file);
        // S2: Wrap in try-catch to handle partial writes
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw);
        
        const isMilestone = milestonesFiles.has(file);
        let frozenParams = {};
        const archivePath = path.join(EXPERIMENTS_DIR, "archive", `${data.id}.json`);
        if (fs.existsSync(archivePath)) {
          frozenParams = JSON.parse(fs.readFileSync(archivePath, "utf-8")).params || {};
        }

        await client.mutation(api.experiments.syncExperiment, {
          tenantId: "default",
          experimentId: data.id,
          hypothesis: data.hypothesis,
          status: isMilestone ? "milestone" : "completed",
          completedAt: data.completed_at,
          durationSeconds: data.duration_seconds,
          frozenParams,
          bestTrial: data.best_trial,
          summary: data.summary,
          error: data.error,
          lastSyncedAt: now,
        });
        console.log(`✓ Synced ${data.id}`);
      } catch (err) {
        console.warn(`! Failed to sync ${file}: ${err.message}`);
      }
    }
  }

  // 3. Sync Pending
  const pendingDir = path.join(EXPERIMENTS_DIR, "pending");
  if (fs.existsSync(pendingDir)) {
    const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith(".json"));
    for (const file of pendingFiles) {
      try {
        const filePath = path.join(pendingDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        await client.mutation(api.experiments.syncExperiment, {
          tenantId: "default",
          experimentId: data.id,
          hypothesis: data.hypothesis,
          status: "pending",
          lastSyncedAt: now,
        });
      } catch (err) {
        console.warn(`! Failed to sync pending ${file}: ${err.message}`);
      }
    }
  }

  console.log("Sync complete.");
  process.exit(0);
}

sync();
