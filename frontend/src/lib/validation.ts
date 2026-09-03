/**
 * Email validation helpers used before sending credentials to Supabase Auth.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common typos for well-known email domains. If a user types one of these,
// we show a "Did you mean ...?" suggestion before submitting to Supabase.
const DOMAIN_TYPOS: Record<string, string> = {
  'gmail.comm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.com.com': 'gmail.com',
  'yahoo.comm': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.om': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.cm': 'outlook.com',
  'outlook.om': 'outlook.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  'live.con': 'live.com',
  'live.co': 'live.com',
  'icloud.con': 'icloud.com',
  'icloud.co': 'icloud.com',
  'me.con': 'me.com',
  'me.co': 'me.com',
  'mac.con': 'me.com',
  'mac.co': 'me.com',
  'protonmail.con': 'protonmail.com',
  'protonmail.co': 'protonmail.com',
};

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
 * Suggest a correction when a known email domain typo is detected.
 * Returns the corrected full email, or `null` when no typo is recognised.
 */
export function suggestEmailCorrection(email: string): string | null {
  const lower = email.trim().toLowerCase();
  const parts = lower.split('@');
  if (parts.length !== 2) return null;

  const [local, domain] = parts;
  const corrected = DOMAIN_TYPOS[domain];
  if (!corrected || corrected === domain) return null;

  return `${local}@${corrected}`;
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
