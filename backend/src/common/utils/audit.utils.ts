/**
 * Utility functions for audit trail
 */

/**
 * Extracts username from email address (removes @domain.com)
 * Example: "john.doe@example.com" -> "john.doe"
 * Example: "admin@school.edu" -> "admin"
 */
export function extractUsernameFromEmail(email: string): string {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;
  return email.substring(0, atIndex);
}
