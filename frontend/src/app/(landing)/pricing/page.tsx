'use client';

import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { AlmaMarketingCTA } from '@/components/AlmaMarketingCTA';
import { plans } from '@/lib/constants/plans';

export default function PricingPage() {
  return (
    <>
      <Navigation />
      <main className="bg-white font-sans">
        <section className="bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6 text-center">
            <h1 className="mb-8 bg-gradient-to-r from-brand-green to-brand-green-light bg-clip-text font-heading text-4xl text-transparent md:text-6xl">
              Simple, Transparent Pricing
            </h1>
            <p className="mx-auto max-w-3xl text-xl text-gray-600">
              Choose the plan that fits your school. All plans include core attendance, academics, and parent access.
            </p>
          </div>
        </section>

        <section className="pb-32 pt-8">
          <div className="container mx-auto px-6">
            <div className="grid items-stretch gap-12 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const isPro = plan.popular;
                return (
                  <div
                    key={plan.name}
                    className={
                      isPro
                        ? 'relative flex flex-col rounded-[2.5rem] border-4 border-brand-green bg-gradient-to-br from-brand-green-pale/40 to-white p-10 shadow-2xl md:scale-105'
                        : 'flex flex-col rounded-[2.5rem] border-2 border-gray-200 bg-white p-10 shadow-xl'
                    }
                  >
                    {isPro && (
                      <span className="absolute -right-2 -top-2 rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-4 py-1 text-xs font-bold text-white shadow-lg">
                        Most Popular
                      </span>
                    )}
                    <h2 className="text-3xl font-bold text-gray-900">{plan.name}</h2>
                    <div className="mt-4 flex flex-wrap items-baseline gap-1">
                      <span className="text-4xl font-black text-brand-green">{plan.price}</span>
                      {plan.priceNote ? <span className="text-gray-600">{plan.priceNote}</span> : null}
                    </div>
                    <p className="mt-4 text-gray-600">{plan.summary}</p>
                    <ul className="mt-8 flex-grow space-y-3">
                      {plan.highlights.map((h) => (
                        <li key={h.label} className="flex gap-2 text-sm text-gray-700">
                          <span className={h.included ? 'text-brand-green' : 'text-gray-400 line-through'}>
                            {h.included ? '✓' : '✗'}
                          </span>
                          <span className={h.included ? '' : 'text-gray-400 line-through'}>{h.label}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.name === 'Enterprise' ? '/contact' : '/login'}
                      className={
                        isPro
                          ? 'mt-auto block rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-8 py-4 text-center font-bold text-white transition hover:shadow-xl'
                          : 'mt-auto block rounded-full border-2 border-brand-green-lighter px-8 py-4 text-center font-bold text-brand-green transition hover:border-brand-green hover:shadow-lg'
                      }
                    >
                      {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <AlmaMarketingCTA
          title="Questions About Pricing?"
          description="We will help you pick the right plan for your school or trust"
          primaryLabel="Talk to Sales"
          primaryHref="/contact"
          secondaryLabel="View Features"
          secondaryHref="/features"
        />
      </main>
      <Footer />
    </>
  );
}
