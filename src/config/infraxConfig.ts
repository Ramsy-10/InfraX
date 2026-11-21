import type {
  Competition,
  ContactLink,
  FAQItem,
  FilmSubmission,
  SocialLink,
  TimelineMilestone,
} from '../types/infrax';

/**
 * ============================================================================
 * INFRAX CENTRALIZED CONFIGURATION
 * ============================================================================
 * Organizers can update event dates, Tally registration URLs, guidelines PDFs,
 * Short Film voting settings, and contact/social placeholders from this single file.
 */

// ----------------------------------------------------------------------------
// 1. EVENT CORE METADATA & COUNTDOWN DATE
// ----------------------------------------------------------------------------
export const EVENT_CONFIG = {
  eventName: 'InfraX',
  organizer: 'ICT Club — Bandaranayaka College, Kegalle',
  organizerShort: 'ICT Club, Bandaranayaka College – Kegalle',
  theme: 'The Future Is in Our Hands',
  brandPhrase: 'Beyond Infrastructure, Into The Future',
  heroLabel: 'ICT DAY 2027 · BANDARANAYAKA COLLEGE',
  heroDescription:
    'A platform where creativity, technology, innovation, and young minds come together to explore the future.',
  venue: 'Bandaranayaka College Main Hall',
  location: 'Kegalle, Sri Lanka',
  targetGrades: 'Grades 8–13',
  /**
   * Official InfraX Event Date & Time in Sri Lanka Standard Time (Asia/Colombo, UTC+05:30).
   */
  eventDate: '2027-01-25T08:30:00+05:30' as string | null,
  eventDateDisplay: 'JANUARY 25, 2027',
};

// ----------------------------------------------------------------------------
// 2. TALLY REGISTRATION FORM URLS
// Replace null with the official Tally form URL (e.g., 'https://tally.so/r/xxxxxx')
// ----------------------------------------------------------------------------
export const GRAPHIC_DESIGN_FORM_URL: string | null = null;
export const SHORT_FILM_FORM_URL: string | null = null;
export const PRESENTATION_DESIGN_FORM_URL: string | null = null;
export const WEB_DESIGN_FORM_URL: string | null = null;
export const ICT_QUIZ_FORM_URL: string | null = null;
export const DEBATE_FORM_URL: string | null = null;

// ----------------------------------------------------------------------------
// 3. COMPETITION GUIDELINES PDF URLS
// Replace null with the hosted PDF path or URL (e.g., '/guidelines/graphic-design.pdf')
// ----------------------------------------------------------------------------
export const GRAPHIC_DESIGN_GUIDELINES_URL: string | null = null;
export const SHORT_FILM_GUIDELINES_URL: string | null = null;
export const PRESENTATION_GUIDELINES_URL: string | null = null;
export const WEB_DESIGN_GUIDELINES_URL: string | null = null;
export const ICT_QUIZ_GUIDELINES_URL: string | null = null;
export const DEBATE_GUIDELINES_URL: string | null = null;

// ----------------------------------------------------------------------------
// 4. SHORT FILM VOTING CONFIGURATION
// Email verification must be enabled in the external Tally voting form.
// ----------------------------------------------------------------------------
export const SHORT_FILM_VOTING_FORM_URL: string | null = null;
/**
 * Set to true only when email verification is actively configured
 * inside the external Tally voting form provider.
 */
export const SHORT_FILM_VOTING_VERIFICATION_ENABLED = false;
/**
 * Optional ISO-8601 voting deadline (e.g., '2027-01-20T23:59:59+05:30').
 * Keep as null until confirmed.
 */
export const SHORT_FILM_VOTING_DEADLINE: string | null = null;

export const FILM_SUBMISSIONS: FilmSubmission[] = [
  {
    id: 'school-a',
    slotNumber: '01',
    isConfirmed: false,
    schoolName: 'Participating School A (To Be Confirmed)',
    title: 'Short Film Title — School A',
    thumbnailUrl: null,
    videoUrl: null,
    tallyOptionValue: 'Participating School A',
    description:
      'Official film details, thumbnail, and screening link will be updated upon confirmation.',
  },
  {
    id: 'school-b',
    slotNumber: '02',
    isConfirmed: false,
    schoolName: 'Participating School B (To Be Confirmed)',
    title: 'Short Film Title — School B',
    thumbnailUrl: null,
    videoUrl: null,
    tallyOptionValue: 'Participating School B',
    description:
      'Official film details, thumbnail, and screening link will be updated upon confirmation.',
  },
  {
    id: 'school-c',
    slotNumber: '03',
    isConfirmed: false,
    schoolName: 'Participating School C (To Be Confirmed)',
    title: 'Short Film Title — School C',
    thumbnailUrl: null,
    videoUrl: null,
    tallyOptionValue: 'Participating School C',
    description:
      'Official film details, thumbnail, and screening link will be updated upon confirmation.',
  },
];

// ----------------------------------------------------------------------------
// 5. COMPETITIONS DIRECTORY (ALL 6 OFFICIAL COMPETITIONS)
// ----------------------------------------------------------------------------
export const COMPETITIONS: Competition[] = [
  {
    id: 'graphic-design',
    slug: 'graphic-design',
    index: '01',
    title: 'Graphic Design',
    category: 'Intra-School & Inter-School',
    participationType: 'Individual',
    eligibleGrades: 'Grades 9–13',
    shortDescription:
      'Communicate ideas through visual design, creativity, composition, and digital graphics.',
    fullDescription:
      'A creative design competition challenging students to communicate ideas through visual design, creativity, composition, and digital graphics.',
    registrationFormUrl: GRAPHIC_DESIGN_FORM_URL,
    guidelinesPdfUrl: GRAPHIC_DESIGN_GUIDELINES_URL,
    registrationOpen: Boolean(GRAPHIC_DESIGN_FORM_URL),
    detailFields: [
      { label: 'Category', value: 'Intra-School & Inter-School' },
      { label: 'Participation', value: 'Individual' },
      { label: 'Eligible Grades', value: 'Grades 9–13' },
      { label: 'Registration', value: 'Tally Registration Form' },
      { label: 'Guidelines', value: 'Downloadable PDF' },
    ],
    rules: [
      'Open to individual participants in Grades 9–13 across both Intra-School and Inter-School categories.',
      'All registration details must be submitted through the official Graphic Design Tally form.',
      'Detailed technical specifications, canvas requirements, and design briefs will be provided in the official guidelines PDF.',
    ],
    evaluationNotes: [
      'Entries are assessed on visual communication, creativity, composition, and execution quality.',
    ],
    submissionNotice:
      'Official submission instructions and brief release details will be published in the guidelines PDF.',
    deadlineNotice: 'Registration and submission deadlines will be announced soon.',
  },
  {
    id: 'short-film',
    slug: 'short-film',
    index: '02',
    title: 'Short Film',
    category: 'Inter-School',
    participationType: 'Team',
    teamSize: '1–5 members',
    schoolLimit: 'One team per participating school',
    maxDuration: '2 minutes',
    shortDescription:
      'Communicate creative ideas through storytelling, filmmaking, editing, and technology.',
    fullDescription:
      'A short-film competition encouraging students to communicate creative ideas through storytelling, filmmaking, editing, and technology.',
    registrationFormUrl: SHORT_FILM_FORM_URL,
    guidelinesPdfUrl: SHORT_FILM_GUIDELINES_URL,
    registrationOpen: Boolean(SHORT_FILM_FORM_URL),
    detailFields: [
      { label: 'Category', value: 'Inter-School' },
      { label: 'Participation', value: 'Team Competition' },
      { label: 'Team Size', value: '1–5 members' },
      { label: 'School Limit', value: 'One team per participating school' },
      { label: 'Maximum Duration', value: '2 minutes' },
      { label: 'Final Scoring', value: '70% Judges · 30% Public Voting' },
      { label: 'Certificates', value: 'Every participant receives a certificate' },
    ],
    rules: [
      'Inter-School team competition with 1–5 members per team.',
      'Strictly limited to one team per participating school.',
      'Maximum video duration is 2 minutes.',
      'Every participant will receive an official certificate of participation.',
      'Public voting takes place exclusively through the dedicated InfraX Short Film Voting portal.',
    ],
    evaluationNotes: [
      'Judges evaluation accounts for 70% of the final competition score.',
      'Public voting through the verified InfraX voting system accounts for 30% of the final score.',
    ],
    submissionNotice:
      'Detailed film format, resolution, and delivery instructions will be provided in the official Short Film guidelines PDF.',
    deadlineNotice: 'Submission and public voting dates will be announced soon.',
  },
  {
    id: 'presentation-design',
    slug: 'presentation-design',
    index: '03',
    title: 'Presentation Design',
    category: 'Intra-School',
    participationType: 'Individual',
    eligibleGrades: 'Grades 8–13',
    shortDescription:
      'Demonstrate creativity, communication, visual storytelling, and presentation craft.',
    fullDescription:
      'A presentation design competition where students demonstrate creativity, communication, visual storytelling, and presentation skills.',
    registrationFormUrl: PRESENTATION_DESIGN_FORM_URL,
    guidelinesPdfUrl: PRESENTATION_GUIDELINES_URL,
    registrationOpen: Boolean(PRESENTATION_DESIGN_FORM_URL),
    detailFields: [
      { label: 'Category', value: 'Intra-School' },
      { label: 'Participation', value: 'Individual' },
      { label: 'Eligible Grades', value: 'Grades 8–13' },
      { label: 'Registration', value: 'Tally Registration Form' },
      { label: 'Guidelines', value: 'Downloadable PDF' },
    ],
    rules: [
      'Open to individual Bandaranayaka College students in Grades 8–13.',
      'Participants must register using the dedicated Presentation Design Tally form.',
      'Topic briefs, slide limits, and presentation formats will be detailed in the guidelines PDF.',
    ],
    evaluationNotes: [
      'Participants are evaluated on visual storytelling, clarity of communication, slide design, and presentation delivery.',
    ],
    submissionNotice:
      'Further submission and round instructions will be published in the official guidelines PDF.',
    deadlineNotice: 'Competition dates and deadlines will be announced soon.',
  },
  {
    id: 'web-design',
    slug: 'web-design',
    index: '04',
    title: 'Web Design',
    category: 'Intra-School',
    participationType: 'Individual',
    eligibleGrades: 'Grades 8–13',
    shortDescription:
      'Build responsive, functional websites showcasing technical skill and creative design.',
    fullDescription:
      'Students demonstrate their creativity, technical knowledge, and web development skills by designing and developing a website according to the competition requirements.',
    registrationFormUrl: WEB_DESIGN_FORM_URL,
    guidelinesPdfUrl: WEB_DESIGN_GUIDELINES_URL,
    registrationOpen: Boolean(WEB_DESIGN_FORM_URL),
    detailFields: [
      { label: 'Category', value: 'Intra-School' },
      { label: 'Participation', value: 'Individual' },
      { label: 'Eligible Grades', value: 'Grades 8–13' },
      { label: 'Registration', value: 'Tally Registration Form' },
      { label: 'Guidelines', value: 'Downloadable PDF' },
    ],
    rules: [
      'Open to individual Bandaranayaka College students in Grades 8–13.',
      'Websites must be designed and developed in accordance with the official competition brief.',
      'Allowed technologies, asset rules, and hosting/packaging requirements will be specified in the guidelines PDF.',
    ],
    evaluationNotes: [
      'Evaluated on layout quality, technical execution, responsiveness, and adherence to competition requirements.',
    ],
    submissionNotice:
      'Competition brief and submission guidelines will be made available via the downloadable PDF.',
    deadlineNotice: 'Competition dates and submission deadlines will be announced soon.',
  },
  {
    id: 'ict-quiz',
    slug: 'ict-quiz',
    index: '05',
    title: 'ICT Quiz',
    category: 'Inter-School',
    participationType: 'Team',
    teamSize: 'Exactly 5 students',
    schoolLimit: 'One team per school',
    shortDescription:
      'Test knowledge of information technology, ICT concepts, and logical problem solving.',
    fullDescription:
      "An ICT knowledge competition testing participants' knowledge of information technology, ICT concepts, logical thinking, and related subjects.",
    registrationFormUrl: ICT_QUIZ_FORM_URL,
    guidelinesPdfUrl: ICT_QUIZ_GUIDELINES_URL,
    registrationOpen: Boolean(ICT_QUIZ_FORM_URL),
    detailFields: [
      { label: 'Category', value: 'Inter-School' },
      { label: 'Participation', value: 'Team Competition' },
      { label: 'Team Size', value: 'Exactly 5 students' },
      { label: 'Maximum Teams', value: 'One team per school' },
      { label: 'Registration', value: 'Tally Registration Form' },
    ],
    rules: [
      'Inter-School team competition requiring exactly 5 students per team.',
      'Strictly limited to one team per participating school.',
      'Team registration requires school details, teacher-in-charge details, team leader, and details of all five participants via Tally.',
    ],
    evaluationNotes: [
      'Quiz rounds, scoring rules, and syllabus scope will be published in the official ICT Quiz guidelines PDF.',
    ],
    submissionNotice:
      'Preliminary and main stage round schedules will be shared with registered teams.',
    deadlineNotice: 'Registration closing dates and quiz schedule will be announced soon.',
  },
  {
    id: 'debate',
    slug: 'debate',
    index: '06',
    title: 'Debate',
    category: 'Inter-School',
    participationType: 'Team',
    teamSize: 'Exactly 5 students',
    schoolLimit: 'One team per school',
    shortDescription:
      'Sharpen critical thinking, reasoned argument, and articulate stage communication.',
    fullDescription:
      'A debate competition encouraging critical thinking, communication, reasoning, argument development, and confidence.',
    registrationFormUrl: DEBATE_FORM_URL,
    guidelinesPdfUrl: DEBATE_GUIDELINES_URL,
    registrationOpen: Boolean(DEBATE_FORM_URL),
    detailFields: [
      { label: 'Category', value: 'Inter-School' },
      { label: 'Participation', value: 'Team Competition' },
      { label: 'Team Size', value: 'Exactly 5 students' },
      { label: 'Maximum Teams', value: 'One team per school' },
      { label: 'Registration', value: 'Tally Registration Form' },
    ],
    rules: [
      'Inter-School team competition requiring exactly 5 students per team.',
      'Strictly limited to one team per participating school.',
      'Team registration requires school details, teacher-in-charge details, team leader, and all five participant details via Tally.',
    ],
    evaluationNotes: [
      'Debate motions, round structure, and judging rubrics will be released in the official guidelines PDF.',
    ],
    submissionNotice:
      'Matchups and round logistics will be communicated after registration closes.',
    deadlineNotice: 'Registration and competition dates will be announced soon.',
  },
];

// ----------------------------------------------------------------------------
// 6. EVENT TIMELINE MILESTONES
// Set `date` to a formatted string once confirmed; null displays DATE TO BE ANNOUNCED.
// ----------------------------------------------------------------------------
export const TIMELINE_MILESTONES: TimelineMilestone[] = [
  {
    id: 'announcement',
    step: '01',
    title: 'InfraX Announcement',
    date: null,
    phase: 'Launch',
    description:
      'Official unveiling of InfraX by the ICT Club of Bandaranayaka College – Kegalle and release of the competition portfolio.',
  },
  {
    id: 'registration-opens',
    step: '02',
    title: 'Registration Opens',
    date: null,
    phase: 'Registration',
    description:
      'Official Tally registration portals open for all six Intra-School and Inter-School competitions.',
    actionLabel: 'Explore Competitions',
    actionPath: '/competitions',
  },
  {
    id: 'registration-closes',
    step: '03',
    title: 'Registration Closes',
    date: null,
    phase: 'Registration',
    description:
      'Final deadline for individual participants and school teams to submit official Tally registration forms.',
  },
  {
    id: 'briefs-released',
    step: '04',
    title: 'Competition Briefs Released',
    date: null,
    phase: 'Briefing',
    description:
      'Competition prompts, technical requirements, and downloadable guideline documents become active for registered entrants.',
  },
  {
    id: 'submission-period',
    step: '05',
    title: 'Submission Period',
    date: null,
    phase: 'Production',
    description:
      'Active creation and upload window for design, web, presentation, and short film competition entries.',
  },
  {
    id: 'submission-deadline',
    step: '06',
    title: 'Submission Deadline',
    date: null,
    phase: 'Production',
    description:
      'Cutoff for all competition deliverables prior to preliminary review and judging evaluation.',
  },
  {
    id: 'voting-opens',
    step: '07',
    title: 'Short Film Voting Opens',
    date: null,
    phase: 'Public Vote',
    description:
      'Verified public voting opens on The People’s Choice portal, contributing 30% toward the Short Film final score.',
    actionLabel: 'Visit Voting Portal',
    actionPath: '/vote',
  },
  {
    id: 'voting-closes',
    step: '08',
    title: 'Short Film Voting Closes',
    date: null,
    phase: 'Public Vote',
    description:
      'Public voting concludes and verified ballots are finalized alongside the 70% judges evaluation.',
  },
  {
    id: 'final-event',
    step: '09',
    title: 'Final Event — InfraX',
    date: null,
    phase: 'Main Day',
    description:
      'InfraX ICT Day hosted at Bandaranayaka College Main Hall featuring live finals, showcases, and awards.',
  },
];

// ----------------------------------------------------------------------------
// 7. FREQUENTLY ASKED QUESTIONS
// ----------------------------------------------------------------------------
export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'what-is-infrax',
    question: 'What is InfraX?',
    answer:
      'InfraX is the official ICT Day organized by the ICT Club of Bandaranayaka College – Kegalle, Sri Lanka. Guided by the theme "The Future Is in Our Hands" and the phrase "Beyond Infrastructure, Into The Future," it brings students together through six inter-school and intra-school ICT competitions and creative activities.',
  },
  {
    id: 'who-can-participate',
    question: 'Who can participate?',
    answer:
      'InfraX competitions are designed for school students in Grades 8–13. Intra-School competitions (Presentation Design and Web Design) are open to students of Bandaranayaka College in Grades 8–13. Graphic Design (Grades 9–13) is open to both Intra-School and Inter-School individual entrants, while Short Film, ICT Quiz, and Debate are Inter-School team competitions.',
  },
  {
    id: 'how-to-register',
    question: 'How can I register?',
    answer:
      'Each competition has its own dedicated external Tally registration form accessible from its competition detail page. Select your competition from the Competitions page to access the registration button once registration opens.',
  },
  {
    id: 'multiple-competitions',
    question: 'Can I participate in multiple competitions?',
    answer:
      'Further information will be announced soon. Please check the official guidelines PDF for each competition once published.',
  },
  {
    id: 'download-guidelines',
    question: 'Where can I download competition guidelines?',
    answer:
      'Every competition has an individual detail page containing a dedicated Download Guidelines button for its official PDF document. Guidelines will be available for download as soon as they are uploaded by the organizing committee.',
  },
  {
    id: 'inter-school-work',
    question: 'How do inter-school competitions work?',
    answer:
      'Inter-School competitions include Graphic Design (individual, Grades 9–13), Short Film (teams of 1–5 members, maximum one team per school), ICT Quiz (teams of exactly 5 students, maximum one team per school), and Debate (teams of exactly 5 students, maximum one team per school). Team registrations collect school, teacher-in-charge, team leader, and all participant details through Tally.',
  },
  {
    id: 'short-film-voting',
    question: 'How can I participate in Short Film voting?',
    answer:
      'Short Film public voting takes place on the dedicated Voting page ("The People’s Choice") through an official Tally voting form with email verification. Public voting contributes 30% of the final score alongside 70% from judges. One vote is permitted per verified email address.',
  },
  {
    id: 'event-date',
    question: 'When will the event take place?',
    answer:
      'The official event date and competition schedule are currently To Be Announced. Further information will be announced soon and reflected immediately in the website countdown and timeline.',
  },
  {
    id: 'event-venue',
    question: 'Where will InfraX be held?',
    answer:
      'InfraX will be held at the Bandaranayaka College Main Hall in Kegalle, Sri Lanka.',
  },
];

// ----------------------------------------------------------------------------
// 8. FOOTER CONTACT & SOCIAL PLACEHOLDERS
// Populate these fields once official channels are confirmed.
// ----------------------------------------------------------------------------
export const CONTACT_PLACEHOLDERS: ContactLink[] = [
  {
    label: 'General Inquiries',
    value: null, // e.g., 'infrax@example.edu.lk'
    href: null,
  },
  {
    label: 'Organizer Desk',
    value: null, // e.g., '+94 XX XXX XXXX'
    href: null,
  },
];

export const SOCIAL_PLACEHOLDERS: SocialLink[] = [
  { platform: 'Instagram', handle: null, url: null },
  { platform: 'Facebook', handle: null, url: null },
  { platform: 'YouTube', handle: null, url: null },
];
