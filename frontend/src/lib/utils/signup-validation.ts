/**
 * Shared password strength rules for signup / registration.
 */

export type PasswordRuleId = 'minLength' | 'uppercase' | 'lowercase' | 'number' | 'special';

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    test: (password) => /\d/.test(password),
  },
  {
    id: 'special',
    label: 'One special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordRuleResults(password: string): Array<PasswordRule & { passed: boolean }> {
  return PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));
}

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function getPasswordValidationMessage(password: string): string | null {
  if (!password) return 'Password is required';
  if (isStrongPassword(password)) return null;
  return 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character';
}

export function slugifySchoolDomainBase(schoolName: string): string {
  return (
    schoolName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .substring(0, 40) || 'school'
  );
}

export function suggestDomainFromSchoolName(schoolName: string): string {
  return `${slugifySchoolDomainBase(schoolName)}.edu`;
}

export function suggestSchoolCodeFromSchoolName(schoolName: string): string {
  const base = schoolName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 16);
  return base || 'SCHOOL';
}

export const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** Letters, numbers, optional internal hyphens; 2–32 chars after normalisation. */
export const SCHOOL_CODE_PATTERN = /^[A-Z0-9]([A-Z0-9-]*[A-Z0-9])?$/;
