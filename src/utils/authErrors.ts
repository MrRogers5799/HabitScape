/**
 * Turn any Firebase Auth error into a short message a user can act on.
 * Never shows raw Firebase codes. Used by every auth flow so wording stays consistent.
 */
export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  const text = error instanceof Error ? error.message : String(error ?? '');
  const has = (c: string) => code === `auth/${c}` || text.includes(c);

  if (has('invalid-credential') || has('wrong-password') || has('user-not-found') || has('invalid-login-credentials')) {
    return 'Email or password is incorrect';
  }
  if (has('email-already-in-use')) return 'This email is already registered. Try logging in.';
  if (has('weak-password')) return 'Password must be at least 6 characters';
  if (has('invalid-email') || has('missing-email')) return 'Please enter a valid email address';
  if (has('missing-password')) return 'Please enter your password';
  if (has('user-disabled')) return 'This account has been disabled';
  if (has('too-many-requests')) return 'Too many attempts. Wait a few minutes and try again.';
  if (has('network-request-failed')) return 'No connection. Check your internet and try again.';
  if (has('requires-recent-login')) return 'Please log in again to do that';
  return 'Something went wrong. Please try again.';
}
