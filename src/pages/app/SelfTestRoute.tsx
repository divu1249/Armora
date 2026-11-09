import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { SelfTestRunner } from '../../components/SelfTestRunner.tsx';

export default function SelfTestRoute() {
  return (
    <>
      <PageHeader title="Self-test" description="Runs the built-in verification suite on the server: checksums, token rules, the audit log, the policy engine and the regression cases for every fixed defect." badges={<StatusChip kind="BUILT" />} />
      <SelfTestRunner />
    </>
  );
}
