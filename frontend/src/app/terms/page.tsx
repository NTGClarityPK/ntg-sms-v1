import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service | NTG Alma',
  description:
    'NTG Alma Online Terms of Service covering subscriptions, data processing, fees, liability, and related legal terms.',
};

const TERMS_PUBLIC_URL = 'https://alma.ntgapps.com/terms';
const TERMS_VERSION_DATE = '24 July 2026';

function loadTermsBodyLines(): string[] {
  const filePath = path.join(process.cwd(), 'src', 'content', 'alma-online-terms.md');
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  // Skip title + version + website location lines; those are rendered in the page header.
  const startIndex = lines.findIndex(
    (line) => line.startsWith('These NTG Alma Online Terms of Service'),
  );
  return (startIndex >= 0 ? lines.slice(startIndex) : lines)
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => !(line.trim() === '' && arr[index - 1]?.trim() === ''));
}

function isMajorHeading(line: string): boolean {
  return (
    /^ANNEX [A-Z]/.test(line) ||
    line === 'DATA PROCESSING TERMS' ||
    line === 'ONLINE SUBSCRIPTION CONTRACT (PORTAL CUSTOMERS)' ||
    (/^\d+\.\s+\S/.test(line) && !/^\d+\.\d+/.test(line))
  );
}

function isSubHeading(line: string): boolean {
  return /^\d+\.\d+\b/.test(line);
}

function isBullet(line: string): boolean {
  return line.trimStart().startsWith('•') || line.trimStart().startsWith('- ');
}

export default function TermsPage() {
  const bodyLines = loadTermsBodyLines();

  return (
    <>
      <Navigation />

      <main className="min-h-screen bg-white font-sans">
        <div className="container mx-auto max-w-3xl px-6 pb-24 pt-10">
          <Link
            href="/home"
            id="terms-back-home"
            className="inline-flex items-center text-base font-medium text-brand-green transition hover:text-brand-green-light"
          >
            ← Back to Home
          </Link>

          <h1 className="mt-10 text-3xl font-bold uppercase tracking-tight text-gray-800 md:text-4xl">
            NTG ALMA ONLINE TERMS OF SERVICE
          </h1>

          <div className="mt-5 space-y-1 text-base text-gray-500">
            <p>Version date: {TERMS_VERSION_DATE}</p>
            <p>
              Website location:{' '}
              <a
                href={TERMS_PUBLIC_URL}
                id="terms-website-location"
                className="text-brand-green transition hover:text-brand-green-light hover:underline"
              >
                {TERMS_PUBLIC_URL}
              </a>
            </p>
          </div>

          <article className="mt-10 space-y-5 text-[15px] leading-relaxed text-gray-600 md:text-base">
            {bodyLines.map((line, index) => {
              const trimmed = line.trim();

              if (!trimmed) {
                return <div key={`gap-${index}`} className="h-2" aria-hidden />;
              }

              if (isMajorHeading(trimmed)) {
                return (
                  <h2
                    key={`h2-${index}`}
                    className="pt-6 text-lg font-bold text-gray-700 first:pt-0"
                  >
                    {trimmed}
                  </h2>
                );
              }

              if (isSubHeading(trimmed)) {
                return (
                  <p key={`sub-${index}`} className="font-semibold text-gray-600">
                    {trimmed}
                  </p>
                );
              }

              if (isBullet(trimmed)) {
                return (
                  <p key={`bullet-${index}`} className="pl-4 text-gray-600">
                    {trimmed}
                  </p>
                );
              }

              return (
                <p key={`p-${index}`} className="text-gray-600">
                  {trimmed}
                </p>
              );
            })}
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
