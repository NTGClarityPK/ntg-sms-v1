import Image from 'next/image';
import Link from 'next/link';

type Props = {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function AlmaMarketingCTA({
  title = 'Ready to Transform Your School?',
  description = 'Start unifying academics, attendance, and communication today',
  primaryHref = '/signup',
  primaryLabel = 'Signup →',
  secondaryHref = '/contact',
  secondaryLabel = 'Talk to Sales',
}: Props) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-green to-brand-green-light py-32">
      <div className="absolute inset-0 opacity-10">
        <Image
          src="https://images.pexels.com/photos/8535193/pexels-photo-8535193.jpeg"
          alt="School background"
          fill
          className="object-cover"
          sizes="100vw"
        />
      </div>

      <div className="container relative z-10 mx-auto px-6 text-center">
        <h2 className="mb-8 font-heading text-5xl leading-tight text-white md:text-6xl">{title}</h2>
        <p className="mx-auto mb-12 max-w-3xl text-2xl leading-relaxed text-white/95">{description}</p>

        <div className="flex flex-col justify-center gap-6 sm:flex-row">
          <Link
            href={primaryHref}
            className="rounded-full bg-white px-12 py-5 text-xl font-bold text-brand-green transition hover:scale-105 hover:shadow-2xl"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="rounded-full border-2 border-white bg-transparent px-12 py-5 text-xl font-bold text-white transition hover:bg-white hover:text-brand-green"
          >
            {secondaryLabel}
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 md:grid-cols-4">
          <div className="text-white">
            <p className="text-sm opacity-90">Bank-Level Security</p>
          </div>
          <div className="text-white">
            <p className="text-sm opacity-90">99.9% Uptime</p>
          </div>
          <div className="text-white">
            <p className="text-sm opacity-90">SOC 2 Certified</p>
          </div>
          <div className="text-white">
            <p className="text-sm opacity-90">24/7 Support</p>
          </div>
        </div>
      </div>
    </section>
  );
}
