# Rolevia Search Worker

Private query-only Flask service for LinkedIn, Indeed and Google Jobs (JobSpy), plus Xing public listings. StepStone runs in the Next app's Node runtime. It does not receive CVs, account identifiers, profile text or candidate skills.

Use Python **3.12**, install `requirements.txt`, then run `python -m unittest discover -s tests`. `python app.py --probe` runs a small real search and prints only source status/counts. Live results depend on provider access and are not a deterministic test. `python app.py` serves locally on port 5321.

Deploy this directory as a separate free-tier Vercel Flask project (`rolevia-search-worker`, scope `sparc1`). Set a random 256-bit `SEARCH_WORKER_SECRET` through secure hosting input. Set the identical secret and the worker production URL as `SEARCH_WORKER_URL` in Rolevia's server environment, then redeploy both. Never print or commit secrets. This service does not use paid proxies or bypass sign-in, CAPTCHA or provider blocks.

`GET /health` returns service/source names. `POST /search` requires `Authorization: Bearer <secret>` and JSON containing `term`, `location`, `country` and `limit` (1-100). Term/location are capped at 100 characters; country supports germany, switzerland, netherlands, india, usa, uk and canada. Each source runs in an isolated subprocess with a 65-second limit. The response contains per-source jobs and status, not a promise of exhaustive results. JobSpy can return an empty frame for both no results and parser/block failures, reported as `empty_or_blocked`.

The app controls user authentication, query budgets, ranking, deduplication and storage. The shared secret must remain private to avoid unauthorized worker usage. Python unit tests run in GitHub CI. Until this separate Vercel project is connected to Git, deploy worker changes explicitly from this directory; the app's automatic Git deployment does not deploy the worker.