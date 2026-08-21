import Image from 'next/image';
import Link from 'next/link';

const footerLinkClass =
  'text-gray-300 visited:text-gray-300 transition-colors hover:text-brand-green-lighter active:text-brand-green-light';

export function Footer() {
  return (
    <footer className="bg-gray-900 py-16 text-white">
      <div className="container mx-auto px-6">
        <div className="mb-12 grid gap-12 md:grid-cols-4">
          <div>
            <div className="mb-6 flex items-center space-x-2">
              <div className="relative h-10 w-10 shrink-0">
                <Image
                  src="/alma_logo-dark.svg"
                  alt="NTG Alma Logo"
                  fill
                  className="object-contain brightness-0 invert"
                  sizes="40px"
                />
              </div>
              <span className="font-heading text-2xl">NTG Alma</span>
            </div>
            <p className="leading-relaxed text-gray-400">
              The complete School Management System for modern schools and trusts.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Product</h3>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link href="/features" id="footer-link-features" className={footerLinkClass}>
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" id="footer-link-pricing" className={footerLinkClass}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/home#case-studies" id="footer-link-case-studies" className={footerLinkClass}>
                  Case Studies
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Company</h3>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link href="/about" id="footer-link-about" className={footerLinkClass}>
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" id="footer-link-contact" className={footerLinkClass}>
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/terms" id="footer-link-terms" className={footerLinkClass}>
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Contact</h3>
            <ul className="space-y-3 text-gray-400">
              <li>
                <a href="mailto:alma@ntgclarity.com" id="footer-link-email" className={footerLinkClass}>
                  alma@ntgclarity.com
                </a>
              </li>
              <li>
                <a
                  href="https://alma.ntgapps.com"
                  id="footer-link-website"
                  className={footerLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  alma.ntgapps.com
                </a>
              </li>
              <li className="leading-relaxed">
                2820 Fourteenth Avenue, Suite 202
                <br />
                Markham, Ontario L3R 0S9
                <br />
                Canada
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
          <p>&copy; 2026 NTG Clarity Networks Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
