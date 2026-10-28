// Records a run that was already broadcast, without broadcasting again. Use it when a run's verdict is on
// chain but the server refused to write the record (for example, a check that was wrong and is now fixed).
//   tsx record-run.ts <T1|T2> <pinnedBlock> <path-to-cre-result.json>
// It rebuilds the payload from the scenario file and passes it through the same persistence path as a live
// run: the server recomputes the evidence hash and reads the verdict back from EchtVerdicts before it writes.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRunPayload, type ScenarioFile } from "../apps/server/src/run-payload.ts";
import { makeRealPersistence } from "../apps/server/src/chain-record.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const [scenario, pinned, resultPath] = process.argv.slice(2);
if (!scenario || !pinned || !resultPath) throw new Error("usage: record-run.ts <T1|T2> <pinnedBlock> <cre-result.json>");
const FILES: Record<string, string> = { T1: "T1-coordinated.json", T2: "T2-unrelated.json" };
const file = FILES[scenario];
if (!file) throw new Error(`unknown scenario ${scenario}`);

const scenarioFile = JSON.parse(readFileSync(join(ROOT, "scenarios", file), "utf8").replace(/^﻿/, "")) as ScenarioFile;
const payload = buildRunPayload(scenarioFile, Number(pinned), Date.now());
const result = JSON.parse(readFileSync(resultPath, "utf8").replace(/^﻿/, "")) as Record<string, unknown>;
const outcome = await makeRealPersistence(ROOT).persist(scenario, payload, result);
console.log(outcome.written ? `record written: scenarios/runs/${scenario}.json` : `record not written: ${outcome.reason}`);
