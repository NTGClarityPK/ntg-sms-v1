'use client';

import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';
import { HeroSection } from '@/components/marketing/sections/HeroSection';
import { ProblemSection } from '@/components/marketing/sections/ProblemSection';
import { SolutionSection } from '@/components/marketing/sections/SolutionSection';
import { HowItWorksSection } from '@/components/marketing/sections/HowItWorksSection';
import { KeyFeaturesSection } from '@/components/marketing/sections/KeyFeaturesSection';
import { TestimonialsSection } from '@/components/marketing/sections/TestimonialsSection';
import { PricingTeaserSection } from '@/components/marketing/sections/PricingTeaserSection';
import { FinalCTASection } from '@/components/marketing/sections/FinalCTASection';

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main style={{ paddingTop: '80px' }}>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <KeyFeaturesSection />
        <TestimonialsSection />
        <PricingTeaserSection />
        <FinalCTASection />
      </main>
      <MarketingFooter />
    </>
  );
}

