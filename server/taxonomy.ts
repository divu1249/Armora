import type { ToolTaxonomy } from './types.ts';

export const TOOL_TAXONOMY: Record<string, ToolTaxonomy> = {
  read_candidate_files: {
    readsPrivateData: true,
    writes: false,
    irreversible: false,
    sendsExternal: false,
    privilege: 'confidential',
  },
  send_email: {
    readsPrivateData: false,
    writes: true,
    irreversible: true,
    sendsExternal: true,
    privilege: 'high',
  },
  update_candidate_status: {
    readsPrivateData: false,
    writes: true,
    irreversible: false,
    sendsExternal: false,
    privilege: 'standard',
  },
  lookup_order: {
    readsPrivateData: true,
    writes: false,
    irreversible: false,
    sendsExternal: false,
    privilege: 'standard',
  },
  issue_refund: {
    readsPrivateData: false,
    writes: true,
    irreversible: true,
    sendsExternal: true,
    privilege: 'critical',
  },
};

/** Unknown tools are treated as the most dangerous kind (fail closed). */
export const UNKNOWN_TOOL_TAXONOMY: ToolTaxonomy = {
  readsPrivateData: false,
  writes: true,
  irreversible: true,
  sendsExternal: true,
  privilege: 'critical',
};
