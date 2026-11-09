import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { RealVsSimulatedPage } from '../../components/pages/RealVsSimulatedPage.tsx';

export default function RealVsSimulatedRoute() {
  return (
    <>
      <PageHeader title="Real vs simulated" description="What runs as real code in this product, what is a stand-in, and what is only planned. This page is the source for the status chips used everywhere." />
      <RealVsSimulatedPage />
    </>
  );
}
