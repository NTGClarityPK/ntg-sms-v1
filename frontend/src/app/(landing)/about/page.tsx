import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { AlmaMarketingCTA } from '@/components/AlmaMarketingCTA';

const blocks = [
  {
    title: 'Our mission',
    body: 'To empower schools and trusts with technology that simplifies day-to-day operations and puts learning first.',
  },
  {
    title: 'Our team',
    body: 'Developers, educators, and operations specialists working together to build the best School Management System.',
  },
  {
    title: 'Our values',
    body: 'Transparency, reliability, and putting schools and families first. Your success is our success.',
  },
  {
    title: 'Our vision',
    body: 'To become the leading school management platform globally, helping institutions of every size thrive.',
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <Navigation />
      <main className="bg-white font-sans">
        <section className="bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6 text-center">
            <h1 className="mb-8 bg-gradient-to-r from-brand-green to-brand-green-light bg-clip-text font-heading text-4xl text-transparent md:text-6xl">
              About NTG Alma
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              We&apos;re building the future of school management, one feature at a time — born from a deep understanding
              of how schools and trusts actually run.
            </p>
          </div>
        </section>

        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="grid gap-16 md:grid-cols-2">
              {blocks.map((b) => (
                <div key={b.title}>
                  <h2 className="mb-4 text-3xl font-bold text-gray-900">{b.title}</h2>
                  <p className="text-lg leading-relaxed text-gray-600">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-100 py-32">
          <div className="container mx-auto max-w-3xl px-6 text-center">
            <h2 className="mb-8 font-heading text-3xl text-gray-900 md:text-4xl">Our Story</h2>
            <p className="mb-6 text-lg leading-relaxed text-gray-600">
              NTG Alma was founded to make school operations effortless. After years alongside schools and trusts, we
              kept seeing the same problem: data scattered across spreadsheets, legacy systems, and inbox threads — with
              no single view for leadership or parents.
            </p>
            <p className="text-lg leading-relaxed text-gray-600">
              We set out to unify attendance, timetables, assessments, communication, and reporting in one cloud
              platform — with multi-language and multi-branch support built in. Today we support schools from single
              sites to large trusts, helping them save time and stay aligned.
            </p>
          </div>
        </section>

        <AlmaMarketingCTA
          title="Join Us on This Journey"
          description={"Let\u2019s work together to transform your school operations"}
          primaryLabel="Signup →"
          secondaryLabel="View Pricing"
          secondaryHref="/pricing"
        />
      </main>
      <Footer />
    </>
  );
}
