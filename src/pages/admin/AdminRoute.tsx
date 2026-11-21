import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminLoginPage } from './AdminLoginPage';

const BOOTSTRAP_ADMIN_EMAIL = 'wijnelum@gmail.com';

export function AdminRoute() {
  const [checking, setChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setChecking(true);
      setAuthError(null);
      setCurrentUser(user);

      if (!user) {
        setIsAuthorized(false);
        setChecking(false);
        return;
      }

      if (!user.emailVerified) {
        setIsAuthorized(false);
        setAuthError(
          'Your administrator account email must be verified before accessing the InfraX Admin Panel.'
        );
        setChecking(false);
        return;
      }

      if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
        setIsAuthorized(true);
        setChecking(false);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists()) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          setAuthError('This account is not authorized to access the InfraX Admin Panel.');
        }
      } catch {
        setIsAuthorized(false);
        setAuthError('Unable to verify administrator privileges. Please try another account.');
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#A0A0A0]">
          Verifying Session...
        </p>
      </div>
    );
  }

  if (!currentUser || !isAuthorized) {
    return <AdminLoginPage currentUser={currentUser} authError={authError} />;
  }

  return <AdminDashboardPage currentUser={currentUser} />;
}
