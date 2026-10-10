# Aura v0.2 — startup product foundation

The Desktop project contains a working personal Windows application. It is not yet a multi-tenant business service, AGI, or a universal computer operator. A valuation cannot be inferred from a feature list; it depends on adoption, retention, unit economics, defensibility, and execution.

## Implemented intelligence stack

| Layer | Implementation | Practical boundary |
|---|---|---|
| Desktop product | Electron, React, Vite, accessible controls, animated UI | Windows portable executable; not code-signed |
| Reasoning | NVIDIA NIM, Sarvam, OpenRouter, Gemini adapters | Uses hosted models; credentials, quota, and model availability matter |
| Planning | Typed JSON action vocabulary, strict validation, one schema-repair attempt | Only registered capabilities can execute |
| Review | A different configured reasoning provider reviews proposed writes; optionally all tool plans | Agreement between models is not proof of correctness |
| Personality | Warm, professional, or direct style; stable honesty and permission rules | Designed behavior, not consciousness or autonomous desires |
| Retrieval | NVIDIA neural embeddings, cosine ranking, in-memory vector cache | Only user-authored memories; no background file indexing |
| Fallback | Local keyword retrieval, provider failover, short failure cooldown | Does not guarantee completion or bypass rate limits |
| Execution | Native filesystem/system tools, opaque plans, one-use steps | No arbitrary shell, visual desktop control, browser, email, or destructive tools |
| Verification | Real tool outputs, note read-back, visible evidence | Summary quality still depends on the model |
| Voice | ElevenLabs transcription; ElevenLabs/Sarvam/Fish speech | Push-to-talk, not continuous realtime conversation |
| Local protection | Windows DPAPI for credentials and preferences, isolated renderer, scoped files | Single Windows-user trust boundary |
| Observability | Provider response timing, local hash-linked metadata audit events | Not externally anchored, tenant-isolated, or compliance-certified |

## Latency and accuracy

Quick response mode reduces output limits and the number of candidate planning providers. Routine requests use one planner; an independent review is requested when the configured policy requires it. Each hosted reasoning request has a bounded timeout. Plans have a response budget, and the execution loop is bounded to four rounds.

These are operating limits, not promised response times. Model queues, network latency, transcription, synthesis, and task complexity remain significant. Do not describe the product as perfectly accurate or universally lightning-fast.

The local evaluation suite covers invalid tool schemas, approval boundaries, reviewer failure, revision, cancellation, provider fallback, memory retrieval fallback, audit failure, and log edits. Passing that suite does not measure general task accuracy. Live smoke checks exercise actual providers and native operations separately.

Before a customer pilot, measure at least:

- Verified task success and safe failure rate by workflow.
- First useful response and end-to-end p50/p95 latency.
- Manual interventions per task.
- Wrong or unsupported claims about completed work.
- Provider cost per successfully completed task.
- Approval violations and accidental data exposure.
- Retention and repeated successful use over several weeks.

Keep evaluation tasks separate from training examples. Include ambiguous goals, changing file state, network failures, prompt-injection documents, revoked credentials, cancelled writes, and session restarts. Publish the sample size and failure categories with any performance claims.

## Product path toward business deployment

1. **A dependable personal assistant:** finish durable task checkpoints, safe retries, onboarding, adjustable accessibility, backup/recovery, crash reporting with consent, signed builds, and secure updates. Expand one capability at a time with a verifier and undo design.
2. **Connected work:** add calendar, email, browser DOM, accessibility, documents, and file transformation adapters using least-privilege OAuth or OS grants. Give each adapter a capability schema, idempotency key, risk policy, executor, verifier, and rollback strategy. Authentication and legal consent stay with the user.
3. **An organization control plane:** authenticated users, organization membership, RBAC, tenant-isolated storage and queues, per-tenant encryption, centrally enforced permissions, retention/deletion controls, external audit anchoring, usage budgets, billing, and incident response. Enforce these server-side, not in the desktop renderer.
4. **A measured pilot:** choose a small set of high-value, repeatable cross-application workflows and users with different levels of computer experience. Preserve the profession-independent core while adding domain skills. Expand only when task evidence supports the new scope.

For the control plane, a reasonable future deployment is a stateless API service, an identity provider, PostgreSQL with tenant boundaries, a durable job queue, encrypted object storage, and an authorized capability broker. The desktop agent should receive scoped, short-lived work authorizations. Personal provider keys from this machine must not become shared service credentials.

## Data and trust

The intelligence panel explains which services receive context. Provider failover can send a request to another configured reasoning provider. Independent review shares the goal and proposed plan with the reviewer. Neural memory retrieval sends the query and approved memories to NVIDIA. Disable those options when that routing is unsuitable.

The audit log excludes prompts, file contents, credentials, and paths. Hash linking detects edits relative to the chain that remains; an attacker with local access can replace an entire unanchored log. Do not market it as tamper-proof or sufficient for regulated compliance.

No new domain skill should silently grant itself more permissions. Personality, retrieved memory, model agreement, and user convenience must never bypass the native capability boundary.
