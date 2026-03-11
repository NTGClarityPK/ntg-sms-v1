/**
 * Marketing pricing plans — School Management System context.
 * Display labels: Branches, Staff users, Student cap, Records/month.
 */
export const plans = [
  {
    name: 'Free',
    price: '$0',
    priceNote: '',
    locations: '1',
    users: '2',
    studentCap: '50',
    monthlyRecords: '1,000',
    features: [
      'Student & class records',
      'Attendance basics',
      'Parent portal (limited)',
      'Announcements',
      'Dashboard',
      'Multi-language interface (Arabic, English)',
    ],
    popular: false,
  },
  {
    name: 'Starter',
    price: '$30',
    priceNote: '/month',
    locations: '1',
    users: '10',
    studentCap: '500',
    monthlyRecords: '25,000',
    features: ['All Free features', 'Timetable & scheduling', 'Reports & analytics'],
    popular: false,
  },
  {
    name: 'Pro',
    price: '$100',
    priceNote: '/month',
    locations: '5',
    users: '50',
    studentCap: 'Unlimited',
    monthlyRecords: '100,000',
    features: [
      'All Starter features',
      'Multi-branch',
      'Assessments & grades',
      'Inventory & events',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceNote: '',
    locations: 'Unlimited',
    users: 'Unlimited',
    studentCap: 'Unlimited',
    monthlyRecords: 'Unlimited',
    features: [
      'All Pro features',
      'White-label',
      'SLA',
      'API integrations',
      'Dedicated support',
    ],
    popular: false,
  },
];
