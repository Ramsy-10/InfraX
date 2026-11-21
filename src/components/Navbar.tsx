import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Competitions', to: '/competitions' },
  { label: 'Timeline', to: '/timeline' },
  { label: 'Voting', to: '/vote' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isHome = location.pathname === '/';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        scrolled || !isHome || mobileOpen
          ? 'bg-[#050505]/95 backdrop-blur-md border-b border-white/10'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <Link
          to="/"
          aria-label="InfraX Home"
          className="flex items-center whitespace-nowrap shrink-0 focus-visible:outline-[#AEDD00]"
        >
          <img
            src="/assets/aistudio/InfraX_Logo_c4d52eba.jpg"
            alt="InfraX"
            className="h-9 w-24 object-cover object-center mix-blend-lighten"
          />
        </Link>

        {/* Zone 2: Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-8"
        >
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                  isActive
                    ? 'text-[#AEDD00]'
                    : 'text-[#A0A0A0] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  <span
                    className={`absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[#AEDD00] transition-transform duration-150 origin-left ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Primary Action + Mobile Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/competitions"
            className="hidden md:inline-flex items-center justify-center bg-[#AEDD00] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors duration-150 hover:bg-[#c2f216] whitespace-nowrap shrink-0"
          >
            Register Now
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-11 w-11 items-center justify-center border border-white/15 bg-[#111111] text-white transition-colors hover:border-[#AEDD00] hover:text-[#AEDD00] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col justify-between bg-[#050505] px-6 py-8 md:hidden border-t border-white/10">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-[48px] items-center justify-between border-b border-white/10 px-1 text-lg font-display font-semibold transition-colors ${
                    isActive ? 'text-[#AEDD00]' : 'text-white hover:text-[#AEDD00]'
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="pt-6 border-t border-white/10">
            <Link
              to="/competitions"
              className="flex min-h-[48px] w-full items-center justify-center bg-[#AEDD00] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#c2f216]"
            >
              Register Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
