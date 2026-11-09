import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { TrafficIntel } from '../../components/TrafficIntel.tsx';

export default function TrafficRoute() {
  return (
    <>
      <PageHeader title="Traffic" description="Request volume against an expected baseline, and the accounts that stand out." badges={<StatusChip kind="PRECOMPUTED" />} />
      <TrafficIntel />
    </>
  );
}
