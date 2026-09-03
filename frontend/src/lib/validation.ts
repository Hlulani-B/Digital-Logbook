/**
 * Email validation helpers used before sending credentials to Supabase Auth.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common disposable / temporary email domains. Sign-ups with these addresses
// are rejected because they bypass real inbox verification.
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'fakeemail.com',
  'throwaway.com',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'spam4.me',
  'trashmail.com',
  'trash-mail.com',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  '10minutemail.com',
  '10minutemail.net',
  'mailnesia.com',
  'tempinbox.com',
  'dispostable.com',
  'mohmal.com',
  'getairmail.com',
  'burnermail.io',
  'tempail.com',
  'tmpmail.org',
  'emailondeck.com',
  'tempm.com',
  'throwawaymail.com',
  'tempmailaddress.com',
  'mailcatch.com',
  'fakeinbox.com',
  'getnada.com',
  'inboxkitten.com',
]);

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function isDisposableEmailDomain(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const domain = lower.split('@')[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Validates an email address for sign-up / sign-in forms.
 * Returns `null` if valid, otherwise a user-facing error message.
 */
export function validateEmailForAuth(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Please enter your email address.';
  }

  if (!isValidEmail(trimmed)) {
    return 'Please enter a valid email address (e.g. name@example.com).';
  }

  if (isDisposableEmailDomain(trimmed)) {
    return 'Please use a permanent email address. Temporary or disposable email domains are not allowed.';
  }

  return null;
}
