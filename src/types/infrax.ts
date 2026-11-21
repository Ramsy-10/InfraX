export type CompetitionScope = 'Intra-School' | 'Inter-School' | 'Intra-School & Inter-School';

export type ParticipationType = 'Individual' | 'Team';

export type CompetitionStatus = 'Coming Soon' | 'Open' | 'Closed';

export type RegistrationProvider = 'Tally' | 'Google Forms' | 'External';

export type CompetitionFilter = 'All' | 'Intra-School' | 'Inter-School';

export interface CompetitionDetailField {
  label: string;
  value: string;
}

export interface Competition {
  id: string;
  slug: string;
  index: string;
  title: string;
  category: CompetitionScope;
  participationType: ParticipationType;
  status?: CompetitionStatus;
  eligibleGrades?: string;
  teamSize?: string;
  schoolLimit?: string;
  maxDuration?: string;
  shortDescription: string;
  fullDescription: string;
  registrationProvider?: RegistrationProvider;
  registrationFormUrl: string | null;
  guidelinesDocId?: string | null;
  guidelinesPdfUrl: string | null;
  registrationOpen: boolean;
  rules: string[];
  evaluationNotes: string[];
  submissionNotice: string;
  deadlineNotice: string;
  detailFields: CompetitionDetailField[];
}

export interface TimelineMilestone {
  id: string;
  step: string;
  title: string;
  date: string | null;
  phase: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
}

export interface FilmSubmission {
  id: string;
  slotNumber: string;
  isConfirmed: boolean;
  title: string;
  schoolName: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  tallyOptionValue: string;
  description: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface ContactLink {
  label: string;
  value: string | null;
  href: string | null;
}

export interface SocialLink {
  platform: string;
  handle: string | null;
  url: string | null;
}

export interface SiteContentData {
  eventDate: string | null;
  eventDateDisplay: string;
  venue: string;
  announcement: string;
  registrationDeadlineText: string;
  sponsorInfo: string;
  contactEmail: string | null;
  contactPhone: string | null;
  shortFilmVotingFormUrl: string | null;
  shortFilmVotingDeadline: string | null;
  timelineMilestones: TimelineMilestone[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  description: string;
  scope: 'competition' | 'general';
  competitionId: string;
  fileName: string;
  fileSize: number;
  mimeType: 'application/pdf';
  chunkCount: number;
}
