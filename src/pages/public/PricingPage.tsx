import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import { ButtonLink } from '../../ui/Button.tsx';
import { Card, CardBody } from '../../ui/Card.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { FAQ, PLANS, PRICING_NOTE } from '../../lib/pricing.ts';
import { BRAND } from '../../brand.ts';

export const PricingSection: React.FC<{ standalone?: boolean }> = ({ standalone }) => {
  const H = standalone ? 'h1' : 'h2';
  return (
    <section aria-labelledby="pricing" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <H id="pricing" className="text-center text-2xl font-semibold tracking-tight text-fg">Pricing</H>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted">{PRICING_NOTE}</p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card as="article" key={p.id} tone={p.highlighted ? 'ok' : 'default'} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-fg">{p.name}</h3>
                <Badge tone="warn">Illustrative</Badge>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-fg">{p.price}</p>
              <p className="text-xs text-muted">{p.unit}</p>
              <p className="mt-3 text-sm text-fg2">{p.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-fg2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <ButtonLink to="/app/overview" variant={p.highlighted ? 'primary' : 'secondary'} className="mt-6">
                {p.id === 'developer' ? 'Open the live demo' : p.cta}
              </ButtonLink>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default function PricingPage() {
  useEffect(() => {
    document.title = `Pricing · ${BRAND.name}`;
  }, []);
  return (
    <>
      <PricingSection standalone />
      <section aria-labelledby="pricing-faq" className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
        <h2 id="pricing-faq" className="text-xl font-semibold text-fg">Questions</h2>
        <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
          {FAQ.slice(-3).map((f) => (
            <details key={f.q} className="p-4">
              <summary className="cursor-pointer text-sm font-medium text-fg">{f.q}</summary>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
