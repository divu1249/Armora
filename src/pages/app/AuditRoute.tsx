import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { Term } from '../../ui/Tooltip.tsx';
import { AuditPage } from '../../components/pages/AuditPage.tsx';

export default function AuditRoute() {
  return (
    <>
      <PageHeader title="Audit" description={<>A tamper-evident <Term term="Hash chain">log</Term> of every decision, token and tool call, with proofs per entry.</>} badges={<StatusChip kind="BUILT" />} />
      <AuditPage />
    </>
  );
}
