import React from 'react';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusChip } from '../../ui/Badge.tsx';
import { Term } from '../../ui/Tooltip.tsx';
import { McpVetting } from '../../components/McpVetting.tsx';

export default function McpRoute() {
  return (
    <>
      <PageHeader title="MCP" description={<>Tool specifications are pinned by hash. A tool that changes after review is quarantined. <Term term="MCP" /> describes tools to AI models.</>} badges={<StatusChip kind="BUILT" />} />
      <McpVetting />
    </>
  );
}
