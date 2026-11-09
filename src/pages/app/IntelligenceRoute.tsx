import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { AttackIntel } from '../../components/AttackIntel.tsx';

export default function IntelligenceRoute() {
  return (
    <>
      <PageHeader title="Intelligence" description="Attack campaigns grouped by similarity, and the blocklist. Lookups are generated locally, not fetched from a real intelligence service." badges={<StatusChip kind="MOCK ENRICHMENT" />} />
      <AttackIntel />
    </>
  );
}
