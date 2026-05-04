import type { Metadata } from 'next';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy | NTG Alma',
  description:
    'Read the NTG Alma Privacy Policy covering data collection, student protection, security, retention, and your rights.',
};

export default function PrivacyPage() {
  return (
    <>
      <Navigation />

      <main className="bg-gray-50 font-sans">
        <section className="bg-gradient-to-br from-brand-green-pale to-white py-20">
          <div className="container mx-auto px-6 text-center">
            <h1 className="mb-4 font-heading text-5xl text-gray-900 md:text-6xl">
              Privacy <span className="text-brand-green">Policy</span>
            </h1>
            <p className="text-lg text-gray-600">Last Updated: May 1, 2026</p>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-6">
            <article className="mx-auto max-w-4xl rounded-3xl bg-white p-12 shadow-lg">
              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Introduction</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  NTG Alma (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting the privacy of
                  schools, students, parents, and staff. This Privacy Policy explains how we collect, use, and protect
                  information when you use our school management system.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Information We Collect</h2>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">Information You Provide:</h3>
                <ul className="mb-8 list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Account information (name, email, phone number, school name)</li>
                  <li>Student data (names, enrollment information, academic records, attendance)</li>
                  <li>Staff data (names, roles, contact information)</li>
                  <li>Parent/guardian contact information</li>
                  <li>Academic and administrative records</li>
                </ul>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">Automatically Collected Information:</h3>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Device information (IP address, browser type, operating system)</li>
                  <li>Usage data (features accessed, time spent, actions taken)</li>
                  <li>Log data (error reports, performance data)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">How We Use Your Information</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">We use your information to:</p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Provide and maintain the NTG Alma service</li>
                  <li>Manage student records and academic data</li>
                  <li>Facilitate communication between schools and parents</li>
                  <li>Generate reports and analytics for school administration</li>
                  <li>Provide customer support</li>
                  <li>Improve our platform and develop new features</li>
                  <li>Ensure security and prevent fraud</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Student Data Protection</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">We take student privacy seriously:</p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>We comply with applicable education privacy laws (including FERPA where applicable)</li>
                  <li>Student data is used solely for educational purposes</li>
                  <li>We do not sell or share student data for marketing purposes</li>
                  <li>Parents have the right to access and correct student information</li>
                  <li>Schools control access to student data</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Data Sharing</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">
                  We do not sell your data. We may share information with:
                </p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Service Providers: Third-party vendors who help us operate (cloud hosting, analytics)</li>
                  <li>School Personnel: Authorized staff, teachers, and administrators</li>
                  <li>Parents/Guardians: Access to their own child&apos;s information</li>
                  <li>Legal Requirements: When required by law or to protect rights and safety</li>
                  <li>Business Transfers: In connection with a merger, sale, or acquisition</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Data Security</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">
                  We implement industry-standard security measures including:
                </p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security audits</li>
                  <li>Role-based access controls</li>
                  <li>Secure cloud infrastructure</li>
                  <li>Multi-factor authentication options</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Data Retention</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  We retain data for as long as your school&apos;s account is active or as needed to provide services.
                  Schools may request deletion of data upon account termination. We comply with legal requirements for
                  record retention.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Your Rights</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">Depending on your role:</p>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">Schools:</h3>
                <ul className="mb-8 list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Access and export all school data</li>
                  <li>Delete accounts and data</li>
                  <li>Control user access and permissions</li>
                </ul>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">Parents:</h3>
                <ul className="mb-8 list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Access your child&apos;s information</li>
                  <li>Request corrections to inaccurate data</li>
                  <li>Opt-out of non-essential communications</li>
                </ul>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">Staff:</h3>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Access your personal information</li>
                  <li>Request corrections to your data</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Cookies</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  We use cookies and similar technologies to improve your experience, analyze usage, and remember
                  preferences. You can control cookies through your browser settings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Children&apos;s Privacy</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  Our service is designed for use by schools serving students of all ages. We comply with applicable
                  children&apos;s privacy laws. Student data is collected and used only for educational purposes with
                  appropriate school authorization.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">International Data Transfers</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  Your data may be transferred to and processed in countries other than your own. We ensure
                  appropriate safeguards are in place.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Changes to This Policy</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  We may update this Privacy Policy from time to time. We will notify schools of significant changes
                  via email or through the platform.
                </p>
              </section>

              <section>
                <h2 className="mb-6 text-3xl font-bold text-gray-900">Contact Us</h2>
                <p className="mb-3 text-lg leading-relaxed text-gray-700">
                  For questions about this Privacy Policy, contact us at:
                </p>
                <p className="text-lg leading-relaxed text-gray-700">
                  Email:{' '}
                  <Link
                    href="mailto:alma@ntgclarity.com"
                    className="text-brand-green transition hover:text-brand-green-light hover:underline"
                  >
                    alma@ntgclarity.com
                  </Link>
                </p>
              </section>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
