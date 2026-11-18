import { friendlyAuthError } from '../authErrors';

const fbError = (code: string) =>
  Object.assign(new Error(`Firebase: Error (${code}).`), { code });

describe('friendlyAuthError', () => {
  it.each([
    ['auth/wrong-password', 'Email or password is incorrect'],
    ['auth/invalid-credential', 'Email or password is incorrect'],
    ['auth/user-not-found', 'Email or password is incorrect'],
    ['auth/email-already-in-use', 'This email is already registered. Try logging in.'],
    ['auth/weak-password', 'Password must be at least 6 characters'],
    ['auth/invalid-email', 'Please enter a valid email address'],
    ['auth/too-many-requests', 'Too many attempts. Wait a few minutes and try again.'],
    ['auth/network-request-failed', 'No connection. Check your internet and try again.'],
  ])('maps %s', (code, expected) => {
    expect(friendlyAuthError(fbError(code))).toBe(expected);
  });

  it('never leaks raw Firebase text for unknown codes', () => {
    const msg = friendlyAuthError(fbError('auth/some-new-code'));
    expect(msg).toBe('Something went wrong. Please try again.');
    expect(msg).not.toMatch(/firebase|auth\//i);
  });

  it('handles non-Error values', () => {
    expect(friendlyAuthError(undefined)).toBe('Something went wrong. Please try again.');
    expect(friendlyAuthError('weak-password')).toBe('Password must be at least 6 characters');
  });
});
