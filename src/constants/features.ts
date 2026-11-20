/**
 * Feature visibility.
 *
 * The game layer (Adventure) stays hidden from players until it launches whole
 * (PROD-020). It is visible only in development builds, or on an account whose
 * profile has `adventureAccess: true` (set by hand in the Firebase console for the
 * owner's own account, so they can play it for real before launch).
 */
import { User } from '../types';

const isDevBuild = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__;

/** The player may see the Adventure (beta) section and join it. */
export function adventureVisible(user: Pick<User, 'adventureAccess'> | null | undefined): boolean {
  return isDevBuild() || user?.adventureAccess === true;
}

/** The player can see the game and has joined it: show the tab and earn adventure time. */
export function adventureActive(user: Pick<User, 'adventureAccess' | 'adventureBeta'> | null | undefined): boolean {
  return adventureVisible(user) && user?.adventureBeta === true;
}
