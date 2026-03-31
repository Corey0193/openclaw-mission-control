import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import fs from "fs";
import path from "path";

const WORKSPACE_DIR = "/home/cburroughs/.openclaw/workspace-copy";
const EXPERIMENTS_DIR = path.join(WORKSPACE_DIR, "experiments");

export const syncExperiments = internalAction({
  args: {},
  handler: async (ctx) => {
    // Check if compute loop is running
    const lockPath = path.join(WORKSPACE_DIR, "run_experiment.lock");
    const isRunning = fs.existsSync(lockPath);
    let lastHeartbeat = 0;
    if (isRunning) {
      lastHeartbeat = fs.statSync(lockPath).mtimeMs;
    } else {
      // If not running, use the latest file in completed/ as a proxy for last run
      const completedDir = path.join(EXPERIMENTS_DIR, "completed");
      if (fs.existsSync(completedDir)) {
        const files = fs.readdirSync(completedDir).filter(f => f.endsWith(".json"));
        if (files.length > 0) {
          const latestFile = files.sort().reverse()[0];
          lastHeartbeat = fs.statSync(path.join(completedDir, latestFile)).mtimeMs;
        }
      }
    }

    // Read completed
    const completedDir = path.join(EXPERIMENTS_DIR, "completed");
    if (fs.existsSync(completedDir)) {
      const completedFiles = fs.readdirSync(completedDir).filter(f => f.endsWith(".json"));
      
      // Read milestones to flag them
      const milestonesDir = path.join(EXPERIMENTS_DIR, "milestones");
      const milestonesFiles = new Set(
        fs.existsSync(milestonesDir) 
          ? fs.readdirSync(milestonesDir).filter(f => f.endsWith(".json"))
          : []
      );

      for (const file of completedFiles) {
        const filePath = path.join(completedDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        
        const isMilestone = milestonesFiles.has(file);
        
        // Try to find original experiment definition for frozen params
        let frozenParams = {};
        const archivePath = path.join(EXPERIMENTS_DIR, "archive", `${data.id}.json`);
        if (fs.existsSync(archivePath)) {
          const original = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
          frozenParams = original.params || {};
        }
        
        await ctx.runMutation(internal.experiments.syncExperiment, {
          tenantId: "default",
          experimentId: data.id,
          hypothesis: data.hypothesis,
          status: isMilestone ? "milestone" : "completed",
          completedAt: data.completed_at,
          durationSeconds: data.duration_seconds,
          frozenParams: frozenParams,
          bestTrial: data.best_trial,
          summary: data.summary,
          error: data.error,
        });
      }
    }

    // Read pending
    const pendingDir = path.join(EXPERIMENTS_DIR, "pending");
    if (fs.existsSync(pendingDir)) {
      const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith(".json"));
      for (const file of pendingFiles) {
        const filePath = path.join(pendingDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        
        await ctx.runMutation(internal.experiments.syncExperiment, {
          tenantId: "default",
          experimentId: data.id,
          hypothesis: data.hypothesis,
          status: "pending",
        });
      }
    }

    // We can store the compute loop status in a separate table or just as an experiment?
    // Actually the prompt says:
    // "The "Compute Loop" card reads the lock file mtime + last completed timestamp"
    // So the frontend needs this info. 
    // Maybe I should store it in a system state table?
    // Looking at the schema there is no such table.
    // I'll add a simple query or store it in a special experiment entry? 
    // Or just let the action return it? But crons don't use the return value.
    // I'll add a table for system status if needed, but for now I'll just use a special experimentId "system_compute_loop"
    
    await ctx.runMutation(internal.experiments.syncExperiment, {
      tenantId: "default",
      experimentId: "system_compute_loop",
      hypothesis: "Internal state for compute loop status",
      status: isRunning ? "active" : "idle",
      completedAt: new Date(lastHeartbeat).toISOString(),
    });
  },
});
