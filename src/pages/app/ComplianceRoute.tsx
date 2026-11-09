import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { CompliancePage } from '../../components/pages/CompliancePage.tsx';

export default function ComplianceRoute() {
  return (
    <>
      <PageHeader title="Compliance" description="How each OWASP Top 10 for LLM Applications risk maps to controls in this product, and where the gaps are." badges={<StatusChip kind="BUILT" />} />
      <CompliancePage />
    </>
  );
}
