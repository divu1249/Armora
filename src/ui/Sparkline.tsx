import React from 'react';
import { sparklinePath } from '../lib/sparkline.ts';

export const Sparkline: React.FC<{ values: readonly number[]; width?: number; height?: number; label: string; className?: string }> = ({ values, width = 96, height = 28, label, className }) => (
  <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
    <path d={sparklinePath(values, width, height)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
