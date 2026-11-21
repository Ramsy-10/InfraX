import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  EVENT_CONFIG,
  SOCIAL_PLACEHOLDERS,
} from '../config/infraxConfig';
import { useSiteData } from '../context/SiteDataContext';

export function Footer() {
  const { siteContent } = useSiteData();
  const currentYear = new Date().getFullYear();

  const contacts = [
    {
      label: 'General Inquiries',
      value: siteContent.contactEmail,
      href: siteContent.contactEmail ? `mailto:${siteContent.contactEmail}` : null,
    },
    {
      label: 'Organizer Desk',
      value: siteContent.contactPhone,
      href: siteContent.contactPhone ? `tel:${siteContent.contactPhone.replace(/\s+/g, '')}` : null,
    },
  ];

  return (
    <footer className="border-t border-white/10 bg-[#050505] pt-16 pb-10">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 pb-12 md:grid-cols-12">
          {/* Brand Column */}
          <div className="md:col-span-5">
            <Link to="/" className="inline-block">
              <img
                src="/assets/aistudio/InfraX_Logo_c4d52eba.jpg"
                alt="InfraX"
                className="h-9 w-24 object-cover object-center mix-blend-lighten"
              />
            </Link>
            <p className="mt-4 font-display text-base font-bold uppercase tracking-wider text-white">
              {EVENT_CONFIG.brandPhrase}
            </p>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              {EVENT_CONFIG.theme}
            </p>
            <p className="mt-4 text-xs leading-relaxed text-[#A0A0A0]">
              {EVENT_CONFIG.organizer}
              <br />
              {siteContent.venue} · {EVENT_CONFIG.location}
            </p>

            {siteContent.sponsorInfo.trim() && (
              <p className="mt-3 text-xs leading-relaxed text-[#A0A0A0]">
                {siteContent.sponsorInfo}
              </p>
            )}

            <div className="mt-6">
              <Link
                to="/competitions"
                className="inline-flex min-h-[44px] items-center gap-2 bg-[#AEDD00] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#c2f216] whitespace-nowrap shrink-0"
              >
                <span>Register Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="md:col-span-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#AEDD00]">
              Navigation
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/" className="text-[#A0A0A0] transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/competitions"
                  className="text-[#A0A0A0] transition-colors hover:text-white"
                >
                  Competitions
                </Link>
              </li>
              <li>
                <Link
                  to="/timeline"
                  className="text-[#A0A0A0] transition-colors hover:text-white"
                >
                  Event Timeline
                </Link>
              </li>
              <li>
                <Link
                  to="/vote"
                  className="text-[#A0A0A0] transition-colors hover:text-white"
                >
                  Short Film Voting
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Social Placeholders Column */}
          <div className="md:col-span-4">
            <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#AEDD00]">
              Official Channels
            </h3>

            <div className="mt-4 space-y-3 text-sm">
              {contacts.map((contact) => (
                <div key={contact.label}>
                  <span className="block text-xs text-[#A0A0A0]">{contact.label}</span>
                  {contact.value && contact.href ? (
                    <a
                      href={contact.href}
                      className="font-medium text-white transition-colors hover:text-[#AEDD00]"
                    >
                      {contact.value}
                    </a>
                  ) : (
                    <span className="text-xs italic text-white/50">
                      To be announced by organizing committee
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <span className="block text-xs text-[#A0A0A0]">Social Media</span>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                {SOCIAL_PLACEHOLDERS.map((social) =>
                  social.url ? (
                    <a
                      key={social.platform}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white transition-colors hover:text-[#AEDD00]"
                    >
                      {social.platform}
                    </a>
                  ) : (
                    <span
                      key={social.platform}
                      className="text-white/45"
                      title={`${social.platform} link pending`}
                    >
                      {social.platform} (Pending)
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs text-[#A0A0A0] sm:flex-row sm:items-center">
          <p>
            &copy; {currentYear} InfraX · {EVENT_CONFIG.organizerShort}.
          </p>
          <p>All official registrations &amp; ballots managed via Tally.</p>
        </div>
      </div>
    </footer>
  );
}
