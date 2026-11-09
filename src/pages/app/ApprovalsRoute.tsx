import React from 'react';
import { useAppData } from '../../app/AppData.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { ApprovalsPage } from '../../components/pages/ApprovalsPage.tsx';

export default function ApprovalsRoute() {
  const { refresh } = useAppData();
  return (
    <>
      <PageHeader title="Approvals" description="Tool calls the gate held for a person. A held call expires after 60 seconds; approving it creates a one-time token bound to that exact call." badges={<StatusChip kind="BUILT" />} />
      <ApprovalsPage onApprovalResolved={() => void refresh()} />
    </>
  );
}
