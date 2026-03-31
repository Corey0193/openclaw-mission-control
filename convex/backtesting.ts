"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BACKTEST_DIR = "/home/cburroughs/hustle-research-soft/copytrade";

export const getResultsAction = action({
  args: { tenantId: v.string() },
  handler: async (_ctx, _args) => {
    const resultsPath = path.join(BACKTEST_DIR, "best_params.json");
    const trainEquityPath = path.join(BACKTEST_DIR, "train_equity.csv");
    const valEquityPath = path.join(BACKTEST_DIR, "val_equity.csv");
    const testEquityPath = path.join(BACKTEST_DIR, "test_equity.csv");

    let bestParams = null;
    try {
      if (fs.existsSync(resultsPath)) {
        bestParams = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
      }
    } catch (e) {
      console.error("Failed to read best_params.json", e);
    }

    const readCsv = (p: string) => {
      try {
        if (!fs.existsSync(p)) return [];
        const content = fs.readFileSync(p, "utf-8");
        const lines = content.trim().split("\n");
        if (lines.length < 2) return [];
        const headers = lines[0].split(",");
        return lines.slice(1).map(line => {
          const values = line.split(",");
          const obj: any = {};
          headers.forEach((header, i) => {
            const val = values[i];
            obj[header.trim()] = isNaN(Number(val)) ? val : Number(val);
          });
          return obj;
        });
      } catch (e) {
        console.error("Failed to read CSV", p, e);
        return [];
      }
    };

    return {
      bestParams,
      equity: {
        train: readCsv(trainEquityPath),
        val: readCsv(valEquityPath),
        test: readCsv(testEquityPath),
      }
    };
  },
});

export const runOptimizer = action({
  args: { tenantId: v.string() },
  handler: async (_ctx, _args) => {
    try {
      // Run the optimizer script - using 5 trials for quick feedback in testing
      const output = execSync(`cd ${BACKTEST_DIR} && python3 -m copytrade.run optimize --trials 5`, { encoding: "utf-8" });
      return { success: true, output };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message, 
        stderr: error.stderr?.toString(),
        stdout: error.stdout?.toString() 
      };
    }
  },
});
