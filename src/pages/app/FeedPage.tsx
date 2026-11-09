import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../app/AppData.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { LiveFeedPage } from '../../components/pages/LiveFeedPage.tsx';

export default function FeedPage() {
  const { incidents, apps, setRunnerOpen } = useAppData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  return (
    <>
      <PageHeader title="Live feed" description="Events appear here as agents run. New runs stream in without a refresh." badges={<StatusChip kind="BUILT" />} />
      <LiveFeedPage incidents={incidents} apps={apps} onSelectIncident={(id: string) => navigate(`/app/incidents/${id}`)} selectedAppFilter={filter} onAppFilterChange={setFilter} onTriggerScenario={() => setRunnerOpen(true)} />
    </>
  );
}
