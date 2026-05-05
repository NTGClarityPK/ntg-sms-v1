'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { FloatingIcons } from '@/components/FloatingIcons';
import { AlmaFrame } from '@/components/AlmaFrame';
import { AlmaMarketingCTA } from '@/components/AlmaMarketingCTA';

const MODERN_BIG =
  'https://hpqpdeysaoxtfouksvcw.supabase.co/storage/v1/object/public/welcomescreenimages/assessment%20laptop.png';
const MODERN_SMALL: { src: string; alt: string }[] = [
  {
    src: 'https://hpqpdeysaoxtfouksvcw.supabase.co/storage/v1/object/public/welcomescreenimages/timetable%20tablet.png',
    alt: 'Timetable on tablet',
  },
  {
    src: 'https://hpqpdeysaoxtfouksvcw.supabase.co/storage/v1/object/public/welcomescreenimages/dashboard%20laptop.png',
    alt: 'Dashboard on laptop',
  },
  {
    src: 'https://hpqpdeysaoxtfouksvcw.supabase.co/storage/v1/object/public/welcomescreenimages/timetable%20phone.png',
    alt: 'Timetable on phone',
  },
];

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main className="bg-white font-sans">
        <section className="relative flex min-h-screen items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.pexels.com/photos/18145430/pexels-photo-18145430.jpeg"
              alt="School classroom"
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-green-pale/80 via-white/90 to-gray-50/50" />
          </div>

          <FloatingIcons />

          <div className="container relative z-10 mx-auto px-6 text-center">
            <h1 className="mx-auto mb-6 max-w-4xl font-heading text-5xl leading-tight text-gray-900 md:text-7xl">
              Run Your School From One <span className="text-brand-green">Cloud Platform</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-xl leading-relaxed text-gray-600">
              Complete cloud-based school management: attendance, timetables, assessments, parent communication, and
              multi-branch reporting.
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-8 py-4 text-center text-lg font-bold text-white transition hover:scale-105 hover:shadow-2xl"
              >
                Start Free Trial →
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border-2 border-brand-green-lighter bg-white px-8 py-4 text-center text-lg font-bold text-brand-green transition hover:border-brand-green hover:shadow-lg"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white py-32">
          <div className="container mx-auto px-6">
            <h2 className="mb-32 text-center font-heading text-4xl text-gray-900 md:text-6xl">
              Running a School Shouldn&apos;t Be <span className="text-brand-green">This Hard</span>
            </h2>

            <div className="mb-32 grid items-center gap-16 md:grid-cols-2">
              <AlmaFrame variant="green">
                <Image
                  src="https://images.pexels.com/photos/7054757/pexels-photo-7054757.jpeg"
                  alt="Fragmented spreadsheets"
                  width={1200}
                  height={800}
                  className="h-auto w-full"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </AlmaFrame>
              <div>
                <h3 className="mb-6 text-4xl font-bold leading-tight text-gray-900 md:text-5xl">Fragmented Data</h3>
                <p className="text-xl leading-relaxed text-gray-600">
                  Spreadsheets and paper registers everywhere. Attendance tracked in silos. Parents calling for basic
                  updates. Staff waste hours every week hunting for information across disconnected systems.
                </p>
              </div>
            </div>

            <div className="mb-32 grid items-center gap-16 md:grid-cols-2">
              <div className="order-2 md:order-1">
                <h3 className="mb-6 text-4xl font-bold leading-tight text-gray-900 md:text-5xl">No Single View</h3>
                <p className="text-xl leading-relaxed text-gray-600">
                  Can&apos;t see whole-school trends. Reports pulled manually from multiple sources. Branch data
                  inconsistent. Leadership making critical decisions without real evidence or insights.
                </p>
              </div>
              <div className="relative order-1 md:order-2">
                <AlmaFrame variant="burgundy">
                  <Image
                    src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200"
                    alt="Manual reports"
                    width={1200}
                    height={800}
                    className="h-auto w-full"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </AlmaFrame>
              </div>
            </div>

            <div className="grid items-center gap-16 md:grid-cols-2">
              <AlmaFrame variant="gray">
                <Image
                  src="https://images.pexels.com/photos/3861972/pexels-photo-3861972.jpeg"
                  alt="Complex systems"
                  width={1200}
                  height={800}
                  className="h-auto w-full"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </AlmaFrame>
              <div>
                <h3 className="mb-6 text-4xl font-bold leading-tight text-gray-900 md:text-5xl">Complex Tools</h3>
                <p className="text-xl leading-relaxed text-gray-600">
                  Multiple disconnected systems requiring separate logins. High licence costs and overlapping features.
                  Steep training curve for new staff members. Technology adoption stalls before it even begins.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="relative bg-white py-32">
          <div className="container mx-auto px-6">
            <h2 className="mb-6 text-center font-heading text-5xl text-gray-900 md:text-6xl">
              Everything You Need in <span className="text-brand-green">One Platform</span>
            </h2>
            <p className="mx-auto mb-20 max-w-3xl text-center text-xl text-gray-600">
              From student records to parent communication, manage every aspect of your school in one unified system
            </p>

            <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[
                { emoji: '👥', title: 'Student & class records', body: 'Central pupil profiles, class sections, and academic structure in one place' },
                { emoji: '📅', title: 'Timetables & events', body: 'Schedules, exams, and school events visible to staff and parents' },
                { emoji: '📊', title: 'Assessments & grades', body: 'Continuous assessment, grade books, and progress reporting' },
                { emoji: '🔐', title: 'Staff & roles', body: 'Role-based access, secure logins, and delegated permissions' },
                { emoji: '📢', title: 'Parent communication', body: 'Announcements, notifications, and portal access for guardians' },
                { emoji: '📈', title: 'Reports & analytics', body: 'Attendance, performance, and branch-level dashboards' },
              ].map((card) => (
                <div key={card.title} className="flex items-start space-x-4 rounded-2xl p-6 transition hover:bg-brand-green-pale/60">
                  <div className="text-4xl">{card.emoji}</div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold text-gray-900">{card.title}</h3>
                    <p className="text-gray-600">{card.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <Link
                href="/features"
                className="inline-block rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-10 py-5 text-xl font-bold text-white transition hover:scale-105 hover:shadow-2xl"
              >
                Explore All Features →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white py-32">
          <div className="container mx-auto px-6">
            <h2 className="mb-20 text-center font-heading text-4xl text-gray-900 md:text-6xl">
              Get Your School Running in <span className="text-brand-green">3 Simple Steps</span>
            </h2>

            <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
              {[
                {
                  n: '1',
                  title: 'Quick setup',
                  items: ['Create your organisation', 'Import or add students & classes', 'Configure branches and roles'],
                },
                {
                  n: '2',
                  title: 'Train your team',
                  items: ['Walk through timetables and attendance', 'Practice with test data', 'Invite parents to the portal'],
                },
                {
                  n: '3',
                  title: 'Go live',
                  items: ['Mark attendance and events daily', 'Publish reports and announcements', 'Scale to more branches when ready'],
                },
              ].map((step) => (
                <div key={step.n} className="text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-green to-brand-green-light">
                    <span className="font-heading text-4xl text-white">{step.n}</span>
                  </div>
                  <h3 className="mb-4 text-2xl font-bold text-gray-900">{step.title}</h3>
                  <ul className="space-y-2 text-gray-600">
                    {step.items.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/contact"
                className="inline-block rounded-full border-2 border-brand-green bg-white px-8 py-4 text-lg font-bold text-brand-green transition hover:shadow-lg"
              >
                Book a Free Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="relative bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6">
            <div className="mb-20 text-center">
              <h2 className="mb-6 font-heading text-5xl text-gray-900 md:text-6xl">Modern Interface</h2>
              <p className="mx-auto max-w-3xl text-xl text-gray-600">
                Beautiful, intuitive design that your team will love
              </p>
            </div>

            <div className="relative mx-auto max-w-6xl">
              <div className="relative mb-12">
                <div className="absolute -inset-8 rounded-[4rem] bg-brand-glow-light opacity-20 blur-3xl" />
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-lg">
                  <Image
                    src={MODERN_BIG}
                    alt="Assessments and grading on laptop"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, 72rem"
                  />
                </div>
              </div>

              <div className="grid gap-8 md:grid-cols-3">
                {MODERN_SMALL.map(({ src, alt }) => (
                  <div
                    key={src}
                    className="relative h-56 overflow-hidden rounded-2xl shadow-xl transition hover:scale-105"
                  >
                    <Image src={src} alt={alt} fill className="object-cover object-center" sizes="(max-width: 768px) 100vw, 33vw" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-16 text-center">
              <Link
                href="/features"
                className="inline-block rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-10 py-5 text-xl font-bold text-white transition hover:scale-105 hover:shadow-2xl"
              >
                See All Features →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6">
            <h2 className="mb-8 text-center font-heading text-4xl text-gray-900 md:text-6xl">
              One Platform. <span className="text-brand-green">Complete Control.</span>
            </h2>
            <p className="mx-auto mb-20 max-w-3xl text-center text-xl text-gray-600">
              Built for modern schools worldwide with the features you need to scale
            </p>

            <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
              {[
                { emoji: '🌍', title: 'Multi-Language', body: 'Full RTL support, add new languages in a day' },
                { emoji: '🔒', title: 'Role-Based Access', body: 'Granular permissions for staff and parents' },
                { emoji: '🏫', title: 'Multi-Branch', body: 'Manage unlimited campuses, centralized reporting' },
                { emoji: '☁️', title: 'Works Anywhere', body: 'Cloud-based, any device, no special hardware' },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-green to-brand-green-light shadow-lg">
                    <span className="text-5xl text-white">{item.emoji}</span>
                  </div>
                  <h3 className="mb-4 text-2xl font-bold text-gray-900">{item.title}</h3>
                  <p className="text-base leading-relaxed text-gray-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-32">
          <div className="container mx-auto px-6">
            <h2 className="mb-8 text-center font-heading text-4xl text-gray-900 md:text-6xl">
              Trusted by <span className="text-brand-green">Schools Worldwide</span>
            </h2>
            <p className="mx-auto mb-20 max-w-3xl text-center text-xl text-gray-600">
              See what school leaders are saying about NTG Alma
            </p>

            <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
              {[
                {
                  initial: 'A',
                  name: 'Ahmed',
                  role: 'Principal',
                  org: 'Multi-branch school group',
                  quote:
                    '"Before NTG Alma, attendance and reports lived in spreadsheets. Now everything is in one place. We\'ve cut admin time dramatically."',
                },
                {
                  initial: 'S',
                  name: 'Sara',
                  role: 'Head of Administration',
                  org: 'International curriculum school',
                  quote:
                    '"Announcements and timetables are visible on the portal — fewer phone calls and clearer expectations. Parents finally see the full picture."',
                },
                {
                  initial: 'O',
                  name: 'Omar',
                  role: 'IT Lead',
                  org: 'Trust with 8 schools',
                  quote:
                    '"We roll out updates once and every branch benefits. Reporting at trust level is finally practical. One system across all campuses."',
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="rounded-[2.5rem] border-2 border-brand-green-pale bg-gradient-to-br from-brand-green-pale/30 to-white p-10 shadow-lg"
                >
                  <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-green to-brand-green-light text-3xl font-bold text-white">
                      {t.initial}
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900">{t.name}</p>
                      <p className="text-sm text-gray-600">{t.role}</p>
                      <p className="text-xs text-gray-500">{t.org}</p>
                    </div>
                  </div>
                  <p className="text-lg italic leading-relaxed text-gray-700">{t.quote}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="case-studies" className="bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6">
            <h2 className="mb-20 text-center font-heading text-4xl text-gray-900 md:text-6xl">
              Real Impact, <span className="text-brand-green">Real Results</span>
            </h2>

            <div className="mx-auto max-w-5xl overflow-hidden rounded-[3rem] bg-white shadow-2xl">
              <div className="grid md:grid-cols-2">
                <div className="bg-gray-100 p-12">
                  <h3 className="mb-6 text-3xl font-bold text-gray-900">Before NTG Alma</h3>
                  <ul className="space-y-4 text-gray-700">
                    {[
                      '5+ disconnected systems for different tasks',
                      '15 hours/week on manual attendance reports',
                      'Parent complaints about lack of visibility',
                      'Inconsistent data across 3 branches',
                      'No real-time insights for leadership',
                    ].map((text) => (
                      <li key={text} className="flex items-start gap-3">
                        <span className="flex-shrink-0 text-xl text-red-500">✗</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-brand-green to-brand-green-light p-12 text-white">
                  <h3 className="mb-6 text-3xl font-bold">After NTG Alma</h3>
                  <ul className="space-y-4">
                    {[
                      'Single unified platform for everything',
                      'Reports generated in seconds, not hours',
                      'Parents access portal 24/7 for updates',
                      'Centralized reporting across all branches',
                      'Live dashboards for data-driven decisions',
                    ].map((text) => (
                      <li key={text} className="flex items-start gap-3">
                        <span className="flex-shrink-0 text-xl text-white">✓</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AlmaMarketingCTA />
      </main>
      <Footer />
    </>
  );
}
