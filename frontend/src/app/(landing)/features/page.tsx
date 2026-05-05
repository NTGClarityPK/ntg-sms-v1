'use client';

import Image from 'next/image';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { AlmaFrame } from '@/components/AlmaFrame';
import type { AlmaFrameVariant } from '@/components/AlmaFrame';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { AlmaMarketingCTA } from '@/components/AlmaMarketingCTA';

const BASE = 'https://hpqpdeysaoxtfouksvcw.supabase.co/storage/v1/object/public/welcomescreenimages';

const FEATURE_ROWS: {
  title: string;
  description: string;
  image: string;
  variant: AlmaFrameVariant;
}[] = [
  {
    title: 'Student records',
    description:
      'Central pupil profiles, class sections, and academic structure. Keep enrolment and placement accurate without duplicate spreadsheets.',
    image: `${BASE}/alma-student-records-full.png`,
    variant: 'green',
  },
  {
    title: 'Timetables',
    description:
      'Timetables, exams, and room usage in one place. Staff see what matters; conflicts surface before they hit the classroom.',
    image: `${BASE}/alma-timetable-full.png`,
    variant: 'burgundy',
  },
  {
    title: 'Assessments',
    description:
      'Continuous assessment, grade books, and reporting. Share progress with parents through the portal when you choose.',
    image: `${BASE}/alma-assessments-full.png`,
    variant: 'gray',
  },
  {
    title: 'Staff permissions',
    description:
      'Role-based access and secure logins. Delegate safely so teachers and admin see only what they need.',
    image: `${BASE}/alma-roles-full.png`,
    variant: 'green',
  },
  {
    title: 'Parent communication',
    description:
      'Announcements, notifications, and portal access. Reduce back-and-forth email and give guardians a single place to look.',
    image: `${BASE}/alma-comms-full.png`,
    variant: 'burgundy',
  },
  {
    title: 'Reports',
    description:
      'Attendance, performance, and branch-level dashboards. Export and share with leadership without manual merges.',
    image: `${BASE}/alma-analytics-full.png`,
    variant: 'gray',
  },
  {
    title: 'Multi-language',
    description:
      'Arabic, English, and more with full RTL where needed. Localise the interface and key data for your community.',
    image: `${BASE}/alma-multi-lang-full.png`,
    variant: 'green',
  },
  {
    title: 'Multi-branch',
    description:
      'Run multiple campuses with centralised reporting. Align policy once and roll out everywhere.',
    image: `${BASE}/alma-multi-branches-full.png`,
    variant: 'burgundy',
  },
  {
    title: 'Works anywhere',
    description:
      'Cloud-based — staff and parents on laptop, tablet, or phone. No special hardware; focus on teaching, not servers.',
    image: `${BASE}/alma-cloud-full.png`,
    variant: 'gray',
  },
];

function FeatureBlock({
  title,
  description,
  image,
  variant,
  imageLeft,
}: (typeof FEATURE_ROWS)[number] & { imageLeft: boolean }) {
  const frame = (
    <ImageLightbox src={image} alt={title}>
      <AlmaFrame variant={variant}>
        <div className="cursor-pointer transition hover:shadow-2xl">
          <Image src={image} alt={title} width={1200} height={675} className="h-auto w-full" sizes="(max-width: 768px) 100vw, 50vw" />
        </div>
      </AlmaFrame>
    </ImageLightbox>
  );

  const copy = (
    <div>
      <h2 className="mb-6 text-4xl font-bold leading-tight text-gray-900 md:text-5xl">{title}</h2>
      <p className="text-xl leading-relaxed text-gray-600">{description}</p>
    </div>
  );

  return (
    <div className="mb-32 grid items-center gap-16 last:mb-0 md:grid-cols-2">
      {imageLeft ? (
        <>
          {frame}
          {copy}
        </>
      ) : (
        <>
          <div className="order-2 md:order-1">{copy}</div>
          <div className="order-1 md:order-2">{frame}</div>
        </>
      )}
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <Navigation />
      <main className="bg-white font-sans">
        <section className="bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6 text-center">
            <h1 className="mb-8 font-heading text-4xl text-brand-green md:text-6xl">All Features</h1>
            <p className="mx-auto max-w-3xl text-xl text-gray-600">
              Everything your school needs to run smoothly, all in one powerful system
            </p>
          </div>
        </section>

        <section className="py-32">
          <div className="container mx-auto px-6">
            {FEATURE_ROWS.map((row, index) => (
              <FeatureBlock key={row.title} {...row} imageLeft={index % 2 === 0} />
            ))}
          </div>
        </section>

        <AlmaMarketingCTA
          title="Ready to Get Started?"
          description="See how NTG Alma can transform your school operations"
          primaryLabel="Signup →"
          secondaryLabel="View Pricing"
          secondaryHref="/pricing"
        />
      </main>
      <Footer />
    </>
  );
}
