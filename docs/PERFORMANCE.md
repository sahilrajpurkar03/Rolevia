# Load and Soak Results

Measured on 2026-09-11, 17:40:05-17:52:31 UTC. All declared gates passed for this bounded local HTTP workload.

## Environment and Scope

- Production Next.js build, Node 24.19.0, Windows, Intel Core i7-13850HX, 28 logical CPUs, 31.7 GiB RAM.
- Autocannon 8.0.0 generates HTTP requests; pidusage 4.0.1 samples the server process. Client and server share this machine, so results include local contention and are not Vercel capacity estimates.
- Loopback-only server on an automatically allocated port, with runtime Supabase URL pointed at an unused local endpoint and email/cron secrets disabled. No credentials, cookies, recovery emails, authenticated writes, job feeds, or live database traffic are part of the workload.
- Preflight checks response bodies and statuses. Timed phases check status counts, transport errors, timeouts, latency, and achieved rate. Expected 401 responses are successful authorization rejections, not failed jobs.
- No browser JavaScript execution, Core Web Vitals, CV parsing, account persistence, database queries, successful login/reset, or scheduled matching is exercised by these tests.
- Patched transitive `uuid` 11.1.1 is pinned under `hyperid`; the tooling audit reported zero vulnerabilities. Windows pidusage emits a shell deprecation warning; its input here is the numeric PID of the server spawned by the runner, not user input.

## Declared Gates

Before the measured run: zero transport errors, timeouts, or unexpected statuses; reported average request rate at least 90% of target; p97.5 below 500 ms; p99 below 1,000 ms. The soak additionally requires at least ten post-warmup memory samples, median RSS growth no more than 128 MiB, and late p97.5 no more than 100 ms above the first settled minute.

RSS growth compares medians of the first and last three samples after the first 60 seconds. Latency drift compares minute buckets 1 and 8. This is a heuristic gate, not a heap-leak proof. Short load phases have only start/end process samples; the soak samples approximately every 30 seconds.

## Load Results

Each phase ran approximately 20 seconds after route preflight and a five-second login warmup. HTTP pipelining was 1. Rates below are completed requests divided by wall-clock phase duration, including start/stop overhead.

| Route | Connections | Target req/s | Achieved req/s | Requests | p97.5 ms | p99 ms | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/demo` | 5 | 20 | 19.82 | 400 | 14 | 17 | 200 |
| `/login` | 5 | 20 | 19.82 | 400 | 45 | 54 | 200 |
| `/api/cron/daily` | 5 | 20 | 19.83 | 400 | 13 | 17 | 401 |
| `/demo` | 25 | 100 | 98.38 | 2,000 | 34 | 38 | 200 |
| `/login` | 25 | 100 | 99.36 | 2,003 | 123 | 135 | 200 |
| `/api/cron/daily` | 25 | 100 | 99.40 | 2,001 | 37 | 43 | 401 |

All six phases had zero transport errors, timeouts, and unexpected statuses. This was a bounded load test, not a saturation or maximum-capacity test. Connections do not represent complete concurrent user journeys.

## Short Soak Results

- Workload: `/login`, 10 connections, target 50 requests/second, 600.4 seconds.
- Completed: 29,800 requests, 49.63 requests/second including overhead; all HTTP 200.
- Errors, timeouts, unexpected statuses: zero.
- p97.5: 54 ms; p99: 61 ms.
- Settled baseline RSS: 406.7 MiB; ending RSS: 440.6 MiB; growth: 33.8 MiB; sampled peak: 444.8 MiB.
- First settled minute p97.5: 51.3 ms; late minute p97.5: 53.5 ms.

The ten-minute soak passed the declared stability gates. Memory grew within the threshold; a multi-hour run with authenticated workloads and heap analysis is still needed to assess long-term leaks. This is not full endurance certification.

## Reproduce

From `app/`:

```powershell
npm ci
npm run build
npm run test:performance -- smoke
npm run test:performance -- all
```

Use `load` or `soak` instead of `all` to run just that part. Each run starts and stops its own local server, takes no external target URL, and writes raw results under `app/test-results/performance/`. A failed gate exits nonzero. The full run takes about 12.5 minutes and is intentionally not part of routine CI.

The measured report is preserved in [performance-20260911.json](performance-20260911.json). Rebuilding with different configuration, changing hardware, or using cloud/database-backed workloads can materially change these results.

## Remaining Validation

Multi-hour endurance, realistic signed-in multi-user workflows, database/RLS contention, PDF/DOCX uploads, matching jobs, browser responsiveness, and Vercel-specific latency/cold starts remain untested under load. Those need an isolated staging database, synthetic accounts, provider budget limits, and agreed duration/concurrency before running.