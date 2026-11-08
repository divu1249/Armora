# LLM Firewall — AI Agent Security Gateway & Action Gate

A full-stack security prototype demonstrating a runtime boundary for AI agents that enforces the thesis: **"Reading untrusted content should never authorize a sensitive action."** Detectors produce probabilistic risk signals, while the **Action Gate & Credential Broker** establish a **deterministic boundary for tool calls routed through the gate and verified by the tool server**.

***

### User Review & Critical Decisions

> [!IMPORTANT]
> The following refined decisions incorporate all feedback and guide the implementation:

- **Refined Decision 1 (Model Selection & Fallback)**: The Gemini model is configured via `process.env.GEMINI_MODEL` (defaulting to the recommended active model `gemini-3.8-flash`). If the Gemini API call fails (network error, rate limit, quota, missing key), the agent automatically falls back to the deterministic mock mode and displays a prominent warning notice in the UI.
- **Refined Decision 2 (Audit Log Cryptography & Anchoring)**: The audit log is strictly structured as an append-only **hash chain** (not a Merkle tree): `Hash_n = SHA-256(Hash_{n-1} + canonical_JSON)`. Any value derived from PII uses HMAC-SHA256 with a server secret (`AUDIT_SALT_SECRET`)—raw PII is never logged. A clear note is placed in both the UI and README: *Tail truncation (dropping recent entries) is not detectable without an external anchor / witness service (marked as ROADMAP).*
- **Refined Decision 3 (Action Gate & Honest Claims)**: Strictly avoids overclaiming total attacker identification or generic AI safety. Clearly stated as: *"A deterministic boundary for tool calls routed through the gate and verified by the tool server."*
- **Refined Decision 4 (Standing Master Key vs. Scoped Token Contrast)**:
  - **Firewall OFF**: Agent uses a standing master API key (`MASTER_KEY_SECRET`), simulating legacy agent setups where compromised prompts can invoke any tool with arbitrary arguments indefinitely.
  - **Firewall ON**: Agent has zero standing tool credentials. Allowed calls receive a single-use, 60-second HMAC-SHA256 signed token binding only security-relevant arguments (`tool`, `recipient`, `amount`, `upiId`). The tool server verifies the signature with `crypto.timingSafeEqual` and rejects replays or argument tampering.
- **Refined Decision 5 (Honesty, Labels & Offline Fonts)**:
  - Mock agent explicitly labeled: *"Simulated fooled agent"* (BUILT).
  - Trust labels include metadata footnote: *"Label source: app-marked"*.
  - Offline compatibility: Clean system font stack (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` and monospace `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) ensuring zero external web-font dependencies.
  - Comprehensive `README.md` with explicit *"What is real vs. simulated"* matrix.
- **Refined Decision 6 (Extensible Architecture & Telemetry)**:
  - Layout built with extensible tabs/routes ready for future expansion (Overview, Live Feed, Incident Detail).
  - Endpoint `GET /api/incidents/:id` for detailed historical investigation.
  - Granular pipeline latency telemetry captured for each phase (normalization, detection, policy evaluation, LLM execution, gate verification).

***

### 1. Overview & Core Concept

When an autonomous AI agent reads untrusted content (candidate resumes, customer tickets, database records, search results), hidden prompt injections or malicious instructions can direct the model to invoke sensitive tools (e.g. data exfiltration, unauthorized refunds).

The **LLM Firewall** demonstrates that relying solely on injection classifiers is insecure. Instead, it pairs probabilistic detectors with an architectural **Action Gate & Credential Broker**:
1. Untrusted inputs are tracked and flagged with trust provenance.
2. In-flight and outbound tool calls must pass the policy engine.
3. The Action Gate either permits, blocks, or sends the call to a human approval queue.
4. If permitted, the Credential Broker issues a scoped, single-use, 60-second micro-token.
5. The Protected Tool Server validates the token signature using constant-time comparison before execution.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              LLM FIREWALL ARCHITECTURE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [Input Content] ──> [Normalization (NFKC, zero-width strip, bounded base64)]
                              │
                              ▼
                     [Trust Classifier] (SYSTEM / USER vs. RETRIEVED_DOC / TOOL_OUTPUT)
                              │
                              ▼
                     [Detector Pipeline]
       ┌──────────────────────┼───────────────────────┐
       ▼                      ▼                       ▼
 [Injection Heuristics] [PII & Secrets]         [Canary / Pre-flight]
 (Safe regex, Hinglish) (Verhoeff Aadhaar,      (Canary token injected
                         Luhn cards, PAN, keys)  into system prompt)
       │                      │                       │
       └──────────────────────┼───────────────────────┘
                              ▼
                     [LLM Execution Engine]
              (Server-side Gemini 3.8 Flash OR
               Simulated Fooled Mock Agent)
                              │
                              ▼
                     [Output Inspection]
          (Markdown image/link exfiltration check,
           Canary token leak detection, PII redaction)
                              │
                              ▼
                   [Policy Engine (YAML)]
          (R1: Untrusted + SendsExternal | R2: Trifecta Guard
           R3: Domain allow-list | R4: Refund limit & UPI-ID
           R5: PII outbound redaction | R6: Risk-adaptive gating)
                              │
                              ▼
                [Audit Logging of Every Decision]
             (Append-only SHA-256 HMAC-masked Hash Chain)
                              │
          ┌───────────────────┴───────────────────┐
      [Allow]                               [Require Approval]
          │                                           │
          ▼                                           ▼
 [Credential Broker]                         [Live Approval Queue]
 (Issues 60s HMAC token;                  (Human review with 60s countdown;
  bound to tool, amount, upiId, recipient) auto-denies on timeout)
          │                                           │
          └───────────────────┬───────────────────────┘
                              ▼
                  [Protected Tool Server]
    (Timing-safe HMAC verify, replay rejection, or standing master key if OFF)
                              │
                              ▼
                 [Synthetic Tools & Outbox]
```

***

### 2. User Experience & Visual Design

#### Modern Enterprise Security Dashboard (Light Slate Theme)
- **Palette**: Slate-50 background (`#f8fafc`), pure white structural cards (`#ffffff`), hairline borders (`#e2e8f0`), deep slate typography (`#0f172a`, `#334155`, `#64748b`).
- **Accent Signals**:
  - Indigo (`#4f46e5`): Primary actions and gateway status.
  - Emerald (`#10b981` / `#ecfdf5`): Policy Allowed / Hash-chain verified.
  - Amber (`#f59e0b` / `#fffbeb`): Requires Human Approval / Shadow mode divergence.
  - Crimson (`#ef4444` / `#fef2f2`): Action Gate Blocked / Tamper detected / High Risk.
- **Top Navigation Bar**:
  - Brand Zone: `LLM Firewall` with subtitle: `Agent Security Gateway & Action Gate`.
  - Navigation Tabs:
    - `Scenario Runner` (Interactive attack simulator & live trace)
    - `Approval Queue` (Human-in-the-loop review with dynamic countdown badge)
    - `Audit Hash Chain` (Chronological ledger with live tamper simulator & verification)
    - `Policy Editor` (YAML rule engine & tool taxonomy)
    - `Self-Test Suite` (1-click verification of Verhoeff, Luhn, Token Replay, Audit Chain, and Policy Rules)
  - Global Controls: Mode toggle (`OFF`, `SHADOW`, `ENFORCE`) + `Reset State` button.
- **Top Honest Prototype Banner**:
  - *"Prototype. Synthetic data. Detectors provide risk signals; the Action Gate is the deterministic security boundary for tool calls routed through the gate and verified by the tool server."*

#### Key Interactive Panels
1. **Scenario Runner**:
   - Scenario Selector: S1 (HR Resume Exfiltration), S2 (Support Refund Hijack), S3 (Markdown Image Exfiltration), S4 (10 Benign Controls for false positive benchmarking), S5 (Hinglish Prompt Injection).
   - Agent Engine Switch: `Simulated Fooled Agent` (deterministic) vs. `Gemini 3.8 Flash` (live server-side with auto-fallback).
   - Side-by-side Trace View:
     - Input & Ingested Segments with trust chips (`[SYSTEM]`, `[USER]`, `[RETRIEVED_DOC]`, `[TOOL_OUTPUT]`) + `"Label source: app-marked"`.
     - Detector findings with confidence scores, category, and SHA-256 evidence hashes.
     - Agent thought & tool invocation.
     - Action Gate Decision badge with matched rule ID and latency telemetry (ms).
     - Protected Tool Execution & Outbox Monitor (verifying whether synthetic data leaked).
2. **Key Contrast Indicator**:
   - Compares the active credential mechanism in real time:
     - **Firewall OFF**: *"Standing Master Key active (`mk_live_...`) — unbounded privilege, replayable, zero argument constraints."*
     - **Firewall ON**: *"Single-use 60s Broker Token (`tok_hmac_...`) — bound to exact arguments via timingSafeEqual."*
3. **Audit Log & Tamper Demonstration**:
   - Visual hash chain with previous hash link and current hash.
   - PII values masked via server-secret HMAC-SHA256.
   - Interactive **Simulate Tamper** button modifying block #2 or #3.
   - **Verify Chain** button walking the chain and highlighting cryptographic breakage.
   - Prominent disclaimer: *"Tail truncation is not detectable without an external witness anchor (Roadmap)."*

***

### 3. Key Product Decisions & Trade-Offs

- **Deterministic Mock by Default**: The "Simulated fooled agent" gives 100% reliable attack execution to demonstrate the firewall's defensive capabilities without flakiness. The Gemini live model is supported with server-side SDK calls and automatic mock fallback on error.
- **Privacy-Preserving Audit Log**: Raw PII and untrusted payload strings are never written to audit entries or detector findings; all sensitive strings are represented by server-side HMAC hashes and safe token placeholders (`[REDACTED:AADHAAR]`).
- **Timing-Safe Token Claims**: Tokens bind only security-relevant arguments (`tool`, `recipient`, `amount`, `upiId`) and enforce nonces, expiration timestamps, and signature verification using Node.js `crypto.timingSafeEqual` to prevent timing attacks.

***

### 4. Technical Architecture & File Layout

#### Backend Modules (Pure Functions & Node/Express Services)
- `server/types.ts`: Stable TypeScript types for Segments, Findings, Policies, Decisions, AuditEntries, Incidents, and SSE Events.
- `server/normalization.ts`: NFKC normalization, zero-width / control character strip, bounded base64 decoding with offset preservation.
- `server/detectors/`:
  - `injection.ts`: Safe ReDoS-resistant weighted heuristics + Hinglish seed dictionary.
  - `pii.ts`: Verhoeff checksum algorithm (12-digit Aadhaar), Luhn algorithm (payment cards), PAN regex, +91 phone, email, API key formats, HMAC-SHA256 evidence hashing.
  - `canary.ts`: Canary token injection and output detection.
  - `exfiltration.ts`: Markdown image URLs, non-allowlisted domains, long query parameters, data URLs.
- `server/policyEngine.ts`: YAML parser (`js-yaml`), schema validation, evaluation of R1–R6, Trifecta Guard, and Risk-Adaptive Gating.
- `server/credentialBroker.ts`: HMAC-SHA256 token minting, claim binding, 60-second expiration, nonce store, and constant-time validation (`crypto.timingSafeEqual`).
- `server/protectedTools.ts`: Simulated internal tools (`read_candidate_files`, `send_email`, `update_candidate_status`, `lookup_order`, `issue_refund`) with Outbox and Ledger stores.
- `server/auditLog.ts`: Append-only hash chain with HMAC-PII hashing, chain walk verification, tamper injection, and reset.
- `server/scenarios.ts`: Seeded attack and benign control scenarios (S1–S5).
- `server/agentRunner.ts`: Orchestrates execution for both `mock` (simulated fooled) and `gemini` modes, records stage latencies, writes audit logs, creates incidents (`/api/incidents/:id`), and emits SSE events.
- `server/selfTest.ts`: Automated test vectors for Verhoeff, Luhn, Token Replay, Hash Chain tampering, and Policy evaluation.
- `server.ts`: Express application with helmet, rate-limiting, JSON parser, SSE endpoint, static file serving, and Vite middlewares.

#### Frontend Modules (React + TypeScript + Tailwind)
- `src/App.tsx`: Main layout, top navigation, honest prototype banner, and active view switching.
- `src/components/`:
  - `ScenarioRunner.tsx`: Scenario selection, execution trigger, pipeline trace, and outbox monitor.
  - `ApprovalQueue.tsx`: Pending human review tasks with 60s live countdown and approval handlers.
  - `AuditLogViewer.tsx`: Hash chain visualizer, chain verification, and tamper demo.
  - `PolicyViewer.tsx`: YAML policy display, rule taxonomy, and mode configuration.
  - `SelfTestRunner.tsx`: Interactive `/selftest` test runner with pass/fail badges and vector details.
  - `CredentialContrast.tsx`: UI visualizer contrasting standing master keys vs. scoped broker tokens.
- `src/services/api.ts`: API client for scenario execution, audit verification, self-tests, and SSE subscription.
- `README.md`: System documentation, run instructions, and real vs. simulated matrix.
