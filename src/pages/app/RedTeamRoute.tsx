import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { RedTeamRunner } from '../../components/RedTeamRunner.tsx';

export default function RedTeamRoute() {
  return (
    <>
      <PageHeader title="Red team" description="Run the seed attack set against an isolated copy of the gateway and see what actually executed. Results describe this small hand-written set only." badges={<StatusChip kind="SEEDED" />} />
      <RedTeamRunner />
    </>
  );
}
