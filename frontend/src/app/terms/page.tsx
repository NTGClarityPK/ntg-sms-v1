import type { Metadata } from 'next';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service | NTG Alma',
  description:
    'Read the NTG Alma Terms of Service covering acceptable use, subscriptions, data ownership, liability, and legal terms.',
};

export default function TermsPage() {
  return (
    <>
      <Navigation />

      <main className="bg-gray-50 font-sans">
        <section className="bg-gradient-to-br from-brand-green-pale to-white py-20">
          <div className="container mx-auto px-6 text-center">
            <h1 className="mb-4 font-heading text-5xl text-gray-900 md:text-6xl">
              Terms of <span className="text-brand-green">Service</span>
            </h1>
            <p className="text-lg text-gray-600">Last Updated: May 1, 2026</p>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-6">
            <article className="mx-auto max-w-4xl rounded-3xl bg-white p-12 shadow-lg">
              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">1. Acceptance of Terms</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  By accessing or using NTG Alma, you agree to be bound by these Terms of Service. If you do not
                  agree, do not use the service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">2. Description of Service</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  NTG Alma is a cloud-based school management system that provides student records management,
                  timetabling, assessments, parent communication, attendance tracking, and related features for
                  educational institutions.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">3. Account Registration</h2>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Schools must provide accurate and complete information</li>
                  <li>Account administrators are responsible for managing user access</li>
                  <li>You must notify us immediately of any unauthorized access</li>
                  <li>
                    Account administrators must be authorized representatives of the educational institution
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">4. Acceptable Use</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">You agree NOT to:</p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Violate any laws or regulations</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Upload malicious code or viruses</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>
                    Use the service for any purpose other than legitimate educational administration
                  </li>
                  <li>Share login credentials with unauthorized persons</li>
                  <li>Access data you are not authorized to view</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">5. Student Data Responsibilities</h2>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">Schools agree to:</h3>
                <ul className="mb-8 list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Obtain necessary consents for student data collection</li>
                  <li>Comply with applicable education privacy laws</li>
                  <li>Use the system only for legitimate educational purposes</li>
                  <li>Ensure staff are trained on data privacy</li>
                  <li>Notify us of any data breaches</li>
                </ul>

                <h3 className="mb-4 text-2xl font-bold text-gray-900">We agree to:</h3>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Use student data only to provide the service</li>
                  <li>Not sell or share student data for non-educational purposes</li>
                  <li>Implement appropriate security measures</li>
                  <li>Delete student data upon request (subject to legal retention requirements)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">6. Subscription and Payment</h2>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Fees are charged per student per month based on your selected plan</li>
                  <li>Payment is due in advance on a monthly or annual basis</li>
                  <li>We may change pricing with 60 days&apos; notice</li>
                  <li>Fees paid are non-refundable</li>
                  <li>
                    If you downgrade your subscription, you retain access to your current plan until the end of your
                    paid period, after which the downgrade takes effect
                  </li>
                  <li>Schools are responsible for all applicable taxes</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">7. Data Ownership</h2>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Schools retain ownership of all data entered into the system</li>
                  <li>Schools grant us a license to use data to provide the service</li>
                  <li>We may use anonymized, aggregated data for analytics and improvements</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">8. Service Availability</h2>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>We strive for 99.9% uptime but do not guarantee uninterrupted service</li>
                  <li>We may perform maintenance with reasonable notice</li>
                  <li>We are not liable for service interruptions beyond our control</li>
                  <li>Critical educational periods (exams, enrollment) receive priority support</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">9. Parent and Student Access</h2>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Schools control what data is accessible to parents and students</li>
                  <li>Parents have the right to access their child&apos;s information</li>
                  <li>We provide portals for parent communication as configured by schools</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">10. Termination</h2>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Schools may cancel accounts at any time with 30 days&apos; notice</li>
                  <li>We may suspend or terminate accounts for violation of these terms</li>
                  <li>Fees paid are non-refundable</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">11. Limitation of Liability</h2>
                <p className="mb-4 text-lg font-bold uppercase leading-relaxed text-gray-900">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                </p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>NTG Alma is provided &quot;as is&quot; without warranties</li>
                  <li>We are not liable for indirect, incidental, or consequential damages</li>
                  <li>Our total liability is limited to fees paid in the 12 months prior to the claim</li>
                  <li>We are not responsible for decisions made based on data in the system</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">12. Indemnification</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">
                  Schools agree to indemnify NTG Clarity Networks Inc. from claims arising from:
                </p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Unauthorized use of the service</li>
                  <li>Violation of student privacy laws</li>
                  <li>Breach of these terms</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">13. Intellectual Property</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  All rights, title, and interest in NTG Alma remain with NTG Clarity Networks Inc. You may not copy,
                  modify, or reverse engineer our software.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">14. Compliance with Laws</h2>
                <p className="mb-4 text-lg leading-relaxed text-gray-700">
                  Schools are responsible for ensuring their use of NTG Alma complies with:
                </p>
                <ul className="list-disc space-y-3 pl-6 text-lg leading-relaxed text-gray-700">
                  <li>Local education privacy laws</li>
                  <li>Data protection regulations</li>
                  <li>Student record retention requirements</li>
                  <li>Accessibility standards</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">15. Modifications</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  We may modify these terms with 60 days&apos; notice. Continued use after changes constitutes
                  acceptance. Material changes will be communicated via email.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">16. Governing Law</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  These terms are governed by the laws of Ontario, Canada, without regard to conflict of law
                  principles, except where local education laws require otherwise.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">17. Dispute Resolution</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  Any disputes will be resolved through good faith negotiation, followed by mediation, and if
                  necessary, binding arbitration in Ontario, Canada, except where prohibited by law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">18. Severability</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  If any provision is found unenforceable, the remaining provisions remain in effect.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">19. Data Breach Notification</h2>
                <p className="text-lg leading-relaxed text-gray-700">
                  We will notify schools of any data breach affecting student data within 72 hours of discovery, or as
                  required by applicable law.
                </p>
              </section>

              <section>
                <h2 className="mb-6 text-3xl font-bold text-gray-900">20. Contact</h2>
                <p className="mb-3 text-lg leading-relaxed text-gray-700">
                  For questions about these Terms, contact us at:
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
