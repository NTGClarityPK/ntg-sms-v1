/**
 * Marketing pricing plans — School Management System context.
 * Display-only for /pricing and /billing UI.
 * Enforcement limits: backend `modules/subscription/plan-config.ts`.
 */
export const plans = [
  {
    name: 'Free',
    price: '$0',
    priceNote: '/student/month',
    summary:
      'Core school operations, report cards, timetable & substitution, In-App Messaging',
    highlights: [
      { label: '1 branch', included: true },
      { label: 'Up to 25 students', included: true },
      { label: 'Storage 500MB', included: true },
      { label: 'Report cards & advanced reports', included: true },
      { label: 'Timetable & substitution', included: true },
      { label: 'Fee management', included: false },
    ],
    popular: false,
  },
  {
    name: 'Starter',
    price: '$3',
    priceNote: '/student/month',
    summary: 'Everything in Free, plus fees, certificates, ID cards and data export',
    highlights: [
      { label: '1 branch', included: true },
      { label: 'Up to 150 students', included: true },
      { label: 'Storage 3GB', included: true },
      { label: 'Fee management', included: true },
      { label: 'Certificates / ID cards', included: true },
      { label: 'Data export', included: true },
    ],
    popular: false,
  },
  {
    name: 'Pro',
    price: '$2',
    priceNote: '/student/month',
    summary: 'Everything in Starter, plus library, behavioural, inventory and multi-branch',
    highlights: [
      { label: 'Unlimited branches', included: true },
      { label: 'Up to 500 students', included: true },
      { label: 'Storage 10GB', included: true },
      { label: 'Library', included: true },
      { label: 'Behavioural tracking', included: true },
      { label: 'Inventory / uniforms', included: true },
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceNote: '',
    summary:
      'Negotiated limits and paid add-ons (fees, library, behavioural, inventory, white label, Google Classroom)',
    highlights: [
      { label: 'Custom branches / students / storage', included: true },
      { label: 'Ops Alma offer — accept in Billing', included: true },
      { label: 'Paid add-ons configurable per school', included: true },
      { label: 'White label (add-on)', included: true },
      { label: 'Google Classroom (add-on)', included: true },
      { label: 'Dedicated success path', included: true },
    ],
    popular: false,
  },
];
