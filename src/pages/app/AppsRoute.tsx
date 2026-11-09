import React from 'react';
import { useAppData } from '../../app/AppData.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { AppsPage } from '../../components/pages/AppsPage.tsx';

export default function AppsRoute() {
  const { apps, taxonomy, setApps } = useAppData();
  return (
    <>
      <PageHeader title="Apps" description="The apps Armora protects and which tools each may use. Changes apply to new runs." badges={<StatusChip kind="BUILT" />} />
      <AppsPage apps={apps} taxonomy={taxonomy} onAppUpdated={(u) => setApps((prev) => prev.map((a) => (a.id === u.id ? u : a)))} />
    </>
  );
}
