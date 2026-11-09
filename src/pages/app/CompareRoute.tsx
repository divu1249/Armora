import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../app/AppData.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { SplitScreenPage } from '../../components/pages/SplitScreenPage.tsx';

export default function CompareRoute() {
  const { scenarios } = useAppData();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="With vs without Armora" description="Run the same attack twice: once with protection off (a simulation of the legacy pattern) and once enforced." badges={<StatusChip kind="SIMULATED" />} />
      <SplitScreenPage scenarios={scenarios} onSelectIncident={(id: string) => navigate(`/app/incidents/${id}`)} />
    </>
  );
}
