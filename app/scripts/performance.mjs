import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";
import pidusage from "pidusage";

const mode = process.argv[2] ?? "all";
assert.ok(
  ["smoke", "load", "soak", "all"].includes(mode),
  "Use smoke, load, soak, or all",
);
const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: appDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "performance-test-public-placeholder",
      NEXT_PUBLIC_SITE_URL: origin,
      SUPABASE_SERVICE_ROLE_KEY: "",
      CRON_SECRET: "",
      RESEND_API_KEY: "",
      DIGEST_FROM: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const limits = {
  p975Ms: 500,
  p99Ms: 1000,
  minimumRateFraction: 0.9,
  maxRssGrowthMiB: 128,
  maxLateP975IncreaseMs: 100,
};
const report = {
  startedAt: new Date().toISOString(),
  mode,
  environment: {
    node: process.version,
    platform: process.platform,
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    totalMemoryGiB: os.totalmem() / 1024 ** 3,
  },
  scope:
    "Loopback production Next.js HTTP only; client and server share the host. No authenticated records, email, job feeds, or remote Supabase. Not browser rendering or multi-hour endurance certification.",
  limits,
  phases: [],
};
let activeRun;
let sampleTimer;
let serverFailure = false;
child.on("exit", () => {
  serverFailure = true;
  activeRun?.stop();
});
const stopOnInterrupt = () => {
  activeRun?.stop();
  child.kill();
  process.exitCode = 130;
};
process.once("SIGINT", stopOnInterrupt);

function percentile(values, fraction) {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;
}

async function phase(name, path, expectedStatus, duration, connections, rate) {
  console.log(
    `Starting ${name}: ${path}, ${duration}s, ${connections} connections, ${rate} requests/s`,
  );
  const started = Date.now();
  const samples = [];
  const windows = new Map();
  let sampling = false;
  const sample = async () => {
    if (sampling) return;
    sampling = true;
    try {
      const stats = await pidusage(child.pid);
      samples.push({
        seconds: (Date.now() - started) / 1000,
        rssMiB: stats.memory / 1024 ** 2,
        cpuPercent: stats.cpu,
      });
    } catch {
      serverFailure = true;
    } finally {
      sampling = false;
    }
  };
  await sample();
  sampleTimer = setInterval(() => {
    void sample();
    console.log(
      `${name}: ${Math.round((Date.now() - started) / 1000)}s elapsed`,
    );
  }, 30000);
  const result = await new Promise((resolve, reject) => {
    activeRun = autocannon(
      {
        url: origin + path,
        duration,
        connections,
        overallRate: rate,
        pipelining: 1,
        timeout: 5,
      },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
    activeRun.on("response", (_client, _status, _bytes, responseTime) => {
      const bucket = Math.floor((Date.now() - started) / 60000);
      if (!windows.has(bucket)) windows.set(bucket, []);
      windows.get(bucket).push(responseTime);
    });
  });
  clearInterval(sampleTimer);
  await sample();
  const statusCounts = result.statusCodeStats;
  const unexpectedStatuses = Object.entries(statusCounts)
    .filter(([status]) => Number(status) !== expectedStatus)
    .reduce((total, [, value]) => total + value.count, 0);
  const passed =
    !serverFailure &&
    result.errors === 0 &&
    result.timeouts === 0 &&
    unexpectedStatuses === 0 &&
    result.requests.total > 0 &&
    result.requests.average >= rate * limits.minimumRateFraction &&
    result.latency.p97_5 < limits.p975Ms &&
    result.latency.p99 < limits.p99Ms;
  const summary = {
    name,
    path,
    expectedStatus,
    seconds: result.duration,
    connections,
    targetRequestsPerSecond: rate,
    requests: result.requests.total,
    requestsPerSecond: result.requests.average,
    latencyMs: result.latency,
    throughputBytesPerSecond: result.throughput.average,
    errors: result.errors,
    timeouts: result.timeouts,
    unexpectedStatuses,
    statusCounts,
    memorySamples: samples,
    minuteWindows: [...windows].map(([minute, values]) => ({
      minute,
      requests: values.length,
      p975Ms: percentile(values, 0.975),
    })),
    passed,
  };
  if (name === "soak") {
    const settled = samples.filter((value) => value.seconds >= 60);
    const baseline = percentile(
      settled.slice(0, 3).map((value) => value.rssMiB),
      0.5,
    );
    const ending = percentile(
      settled.slice(-3).map((value) => value.rssMiB),
      0.5,
    );
    const firstWindow = summary.minuteWindows.find(
      (value) => value.minute === 1,
    );
    const lastWindow = summary.minuteWindows.find(
      (value) => value.minute === 8,
    );
    summary.soak = {
      baselineRssMiB: baseline,
      endingRssMiB: ending,
      rssGrowthMiB: ending - baseline,
      firstSettledP975Ms: firstWindow?.p975Ms,
      lateP975Ms: lastWindow?.p975Ms,
    };
    summary.passed &&=
      settled.length >= 10 &&
      baseline !== null &&
      ending !== null &&
      ending - baseline <= limits.maxRssGrowthMiB &&
      Boolean(
        firstWindow &&
        lastWindow &&
        lastWindow.p975Ms <= firstWindow.p975Ms + limits.maxLateP975IncreaseMs,
      );
  }
  report.phases.push(summary);
  console.log(
    JSON.stringify({
      name,
      passed: summary.passed,
      requests: summary.requests,
      requestsPerSecond: summary.requestsPerSecond,
      p975Ms: result.latency.p97_5,
      p99Ms: result.latency.p99,
      errors: summary.errors,
      soak: summary.soak,
    }),
  );
}

try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error("Local server startup timed out")),
      30000,
    );
    child.once("error", reject);
    child.once("exit", () =>
      reject(new Error("Local server exited before readiness")),
    );
    child.stdout.on("data", (data) => {
      if (data.toString().includes("Ready")) {
        clearTimeout(deadline);
        resolve();
      }
    });
    child.stderr.on("data", (data) => process.stderr.write(data));
  });
  const routes = [
    ["demo", "/demo", 200, "Morrow Studio"],
    ["login", "/login", 200, "Welcome back."],
    ["unauthorized-cron", "/api/cron/daily", 401, "Unauthorized"],
  ];
  for (const [, path, status, marker] of routes) {
    const response = await fetch(origin + path, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, status);
    assert.ok(
      (await response.text()).includes(marker),
      `Unexpected response body for ${path}`,
    );
  }
  await phase("warmup", "/login", 200, 5, 2, 10);
  if (mode === "smoke") await phase("smoke", "/login", 200, 5, 2, 10);
  if (mode === "all" || mode === "load") {
    for (const [connections, rate] of [
      [5, 20],
      [25, 100],
    ]) {
      for (const [name, path, status] of routes)
        await phase(`${name}-${rate}rps`, path, status, 20, connections, rate);
    }
  }
  if (mode === "all" || mode === "soak")
    await phase("soak", "/login", 200, 600, 10, 50);
  report.passed = report.phases
    .filter((value) => value.name !== "warmup")
    .every((value) => value.passed);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  clearInterval(sampleTimer);
  activeRun?.stop();
  pidusage.clear();
  child.kill();
  report.finishedAt = new Date().toISOString();
  const directory = new URL("../test-results/performance/", import.meta.url);
  await mkdir(directory, { recursive: true });
  const output = new URL(`${mode}.json`, directory);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report: ${fileURLToPath(output)}; passed=${report.passed}`);
}
