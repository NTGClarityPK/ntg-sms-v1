import type { IdCard } from '@/types/id-cards';

/** Display roll / employee id only — never the full generated card number. */
export function displayIdCardRoll(card: Pick<IdCard, 'rollNumber' | 'cardNumber' | 'personType'>): string {
  if (card.rollNumber?.trim()) return card.rollNumber.trim();
  const num = card.cardNumber?.trim() ?? '';
  if (!num) return '—';
  const stu = num.match(/-STU-(\d+)$/i);
  if (stu) return stu[1]!;
  const tail = num.match(/-(\d+)$/);
  if (tail) return tail[1]!;
  return num;
}
