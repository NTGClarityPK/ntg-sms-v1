/**
 * Marketing pricing plans — School Management System context.
 * Home teaser cards.
 */
export const plans = [
  {
    name: 'Free',
    price: '$0',
    priceNote: '/student/month',
    summary: 'Student profiles, daily attendance, grade entry, parent access, class schedules, simple reports',
    highlights: [
      { label: '1 branch', included: true },
      { label: 'Upto 50 students', included: true },
      { label: '3 staff users', included: true },
      { label: 'Advanced analytics & bulk operations', included: false },
      { label: 'Email support', included: false },
    ],
    popular: false,
  },
  {
    name: 'Starter',
    price: '$3',
    priceNote: '/student/month',
    summary: 'All features in Free, advanced reports & analytics, bulk imports',
    highlights: [
      { label: '1 branch', included: true },
      { label: 'Upto 300 students', included: true },
      { label: '20 staff users', included: true },
      { label: 'Full featured', included: true },
      { label: 'Email support', included: false },
    ],
    popular: false,
  },
  {
    name: 'Pro',
    price: '$2',
    priceNote: '/student/month',
    summary: 'All Starter features, multi-location, uniform inventory management',
    highlights: [
      { label: 'Unlimited branches (+$150 per branch per month)', included: true },
      { label: '500 students', included: true },
      { label: 'Unlimited staff', included: true },
      { label: 'Full featured', included: true },
      { label: 'Email support', included: true },
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Contact sales',
    priceNote: '',
    summary: 'All Pro features, white label, SLAs, API integrations, compliance',
    highlights: [
      { label: 'Unlimited locations', included: true },
      { label: 'Unlimited users', included: true },
      { label: 'Unlimited menu items', included: true },
      { label: 'Unlimited orders / month', included: true },
      { label: 'Email & Phone support', included: true },
    ],
    popular: false,
  },
];
