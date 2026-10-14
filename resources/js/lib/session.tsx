import { createContext, useContext } from 'react';
import type { User } from '../types';

export type AuthMode = 'login' | 'register';

/**
 * The signed-in person and the account actions every page can reach: the navbar, the account page and the admin
 * dashboard all read this, so signing in or out works from anywhere.
 */
export interface Session {
  user: User | null;
  loading: boolean;
  /** Opens the sign-in window. From the navbar it then takes people to their account or the admin dashboard. */
  openAuth: (mode: AuthMode, options?: { redirect?: boolean }) => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const SessionContext = createContext<Session>({
  user: null,
  loading: true,
  openAuth: () => {},
  logout: async () => {},
  setUser: () => {},
});

export const useSession = () => useContext(SessionContext);

/** Where people land after signing in from the navbar: administrators on the dashboard, everyone else on their account. */
export const homeFor = (user: User) => (user.role === 'admin' ? 'admin' : 'account');
