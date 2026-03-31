# ETCH x402 Current Blockers (as of 2026-03-30)

## What's working
- `/api/v1/notarize` returns proper 402 challenge on production
- `/openapi.json` is live and discoverable
- `/.well-known/x402` is live
- Notarize route is x402-gated and compiles/deploys cleanly

## Current blocker
- End-to-end paid call using AgentCash CLI / current x402 client lane fails on Abstract network (`eip155:2741`) in this environment.
- Symptom observed: `Invalid network: eip155:2741` from client/tooling path.

## Why this matters
- We still need one clean paid proof (`402 -> paid -> 200`) before claiming full launch readiness.

## Mitigations in progress
1. Maintain stable Abstract-first endpoint behavior (done)
2. Add CI and discovery smoke checks (done)
3. Implement direct low-level payer script for Abstract to bypass flaky CLI path (next)
4. Capture first paid receipt + mint tx hash and store as launch proof (next)

## Explicit non-action
- Do **not** submit to x402scan until paid E2E proof is captured and approved.
