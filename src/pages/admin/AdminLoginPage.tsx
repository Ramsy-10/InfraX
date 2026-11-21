import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { AlertCircle, Lock, LogIn } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { auth, googleProvider } from '../../lib/firebase';

interface AdminLoginPageProps {
  currentUser: User | null;
  authError: string | null;
}

export function AdminLoginPage({ currentUser, authError }: AdminLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Admin Login | InfraX';
  }, []);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your administrator email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Use Google Sign-In below or enable Email/Password in Firebase Console.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg('Invalid administrator email or password.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const displayedError = errorMsg || authError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-12 text-white">
      <div className="w-full max-w-md border border-white/15 bg-[#111111] p-7 sm:p-9">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <img
            src="/assets/aistudio/InfraX_Logo_c4d52eba.jpg"
            alt="InfraX"
            className="h-8 w-24 object-cover object-center mix-blend-lighten"
          />
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#AEDD00]">
            <Lock className="h-3.5 w-3.5" />
            <span>Admin</span>
          </span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold uppercase tracking-tight text-white">
          Administrator Sign In
        </h1>
        <p className="mt-1.5 text-sm text-[#A0A0A0]">
          Sign in with an authorized InfraX administrator account to manage content, links, and
          PDFs.
        </p>

        {displayedError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 border border-red-500/40 bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{displayedError}</span>
          </div>
        )}

        {currentUser && authError ? (
          <div className="mt-6 space-y-4">
            <div className="border border-white/10 bg-[#050505] p-4 text-xs text-[#A0A0A0]">
              Signed in as <strong className="text-white">{currentUser.email}</strong>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-[44px] w-full items-center justify-center border border-white/20 bg-[#050505] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00]"
            >
              Sign Out &amp; Switch Account
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]"
                >
                  Administrator Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 bg-[#AEDD00] px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#c2f216] disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#A0A0A0]">
                Or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleLogin}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 border border-white/20 bg-[#050505] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#AEDD00] hover:text-[#AEDD00] disabled:opacity-50"
            >
              <span>Continue with Google</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
