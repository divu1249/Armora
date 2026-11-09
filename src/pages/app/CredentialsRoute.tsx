import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { Term } from '../../ui/Tooltip.tsx';
import { CredentialsPage } from '../../components/pages/CredentialsPage.tsx';

export default function CredentialsRoute() {
  return (
    <>
      <PageHeader title="Credentials" description={<>Agents hold <Term term="Standing credential">no standing credentials</Term>. Each allowed call gets a <Term term="One-time token" />. This page shows every token and the inventory per agent.</>} badges={<StatusChip kind="BUILT" />} />
      <CredentialsPage />
    </>
  );
}
