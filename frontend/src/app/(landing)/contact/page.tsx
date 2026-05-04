'use client';

import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { AlmaMarketingCTA } from '@/components/AlmaMarketingCTA';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (!/^\S+@\S+$/.test(email)) {
      setError('Invalid email');
      return;
    }
    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setMessage('');
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navigation />
      <main className="bg-white font-sans">
        <section className="bg-gradient-to-br from-gray-50 to-white py-32">
          <div className="container mx-auto px-6 text-center">
            <h1 className="mb-8 bg-gradient-to-r from-brand-green to-brand-green-light bg-clip-text font-heading text-4xl text-transparent md:text-6xl">
              Get in Touch
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as
              possible.
            </p>
          </div>
        </section>

        <section className="pb-32 pt-8">
          <div className="container mx-auto max-w-2xl px-6">
            <form onSubmit={handleSubmit} className="space-y-6 rounded-[2.5rem] border-2 border-gray-100 bg-white p-10 shadow-xl">
              {submitted && (
                <div className="rounded-xl border-2 border-brand-green-pale bg-brand-green-pale/30 p-4 text-brand-green">
                  Thank you for your message. We&apos;ll get back to you soon!
                </div>
              )}
              {error && <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-gray-800">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition focus:border-brand-green"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-gray-800">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition focus:border-brand-green"
                  placeholder="you@school.edu"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-gray-800">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition focus:border-brand-green"
                  placeholder="+1 …"
                />
              </div>

              <div>
                <label htmlFor="company" className="mb-2 block text-sm font-semibold text-gray-800">
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition focus:border-brand-green"
                  placeholder="School or trust name"
                />
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-semibold text-gray-800">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  className="w-full resize-y rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition focus:border-brand-green"
                  placeholder="How can we help?"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-10 py-5 text-lg font-bold text-white transition hover:shadow-2xl disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>
        </section>

        <AlmaMarketingCTA />
      </main>
      <Footer />
    </>
  );
}
