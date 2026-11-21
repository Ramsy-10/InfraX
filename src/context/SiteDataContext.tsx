import { collection, doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  COMPETITIONS,
  EVENT_CONFIG,
  SHORT_FILM_VOTING_DEADLINE,
  SHORT_FILM_VOTING_FORM_URL,
  TIMELINE_MILESTONES,
} from '../config/infraxConfig';
import { db } from '../lib/firebase';
import type {
  Competition,
  CompetitionStatus,
  DocumentRecord,
  RegistrationProvider,
  SiteContentData,
} from '../types/infrax';

interface SiteDataContextValue {
  siteContent: SiteContentData;
  competitions: Competition[];
  documents: DocumentRecord[];
  generalDocuments: DocumentRecord[];
  isLoadedFromCloud: boolean;
}

const DEFAULT_SITE_CONTENT: SiteContentData = {
  eventDate: EVENT_CONFIG.eventDate,
  eventDateDisplay: EVENT_CONFIG.eventDateDisplay,
  venue: EVENT_CONFIG.venue,
  announcement: '',
  registrationDeadlineText: '',
  sponsorInfo: '',
  contactEmail: null,
  contactPhone: null,
  shortFilmVotingFormUrl: SHORT_FILM_VOTING_FORM_URL,
  shortFilmVotingDeadline: SHORT_FILM_VOTING_DEADLINE,
  timelineMilestones: TIMELINE_MILESTONES,
};

const DEFAULT_COMPETITIONS: Competition[] = COMPETITIONS.map((comp) => ({
  ...comp,
  status: comp.registrationFormUrl ? 'Open' : 'Coming Soon',
  registrationProvider: 'Tally',
  guidelinesDocId: null,
}));

const SiteDataContext = createContext<SiteDataContextValue>({
  siteContent: DEFAULT_SITE_CONTENT,
  competitions: DEFAULT_COMPETITIONS,
  documents: [],
  generalDocuments: [],
  isLoadedFromCloud: false,
});

export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [cloudSiteContent, setCloudSiteContent] = useState<Partial<SiteContentData> | null>(null);
  const [cloudCompetitions, setCloudCompetitions] = useState<Record<string, Partial<Competition>>>({});
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoadedFromCloud, setIsLoadedFromCloud] = useState(false);

  useEffect(() => {
    const unsubSite = onSnapshot(
      doc(db, 'site_content', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setCloudSiteContent({
            eventDate: typeof data.eventDate === 'string' && data.eventDate ? data.eventDate : null,
            eventDateDisplay:
              typeof data.eventDateDisplay === 'string' && data.eventDateDisplay
                ? data.eventDateDisplay
                : DEFAULT_SITE_CONTENT.eventDateDisplay,
            venue:
              typeof data.venue === 'string' && data.venue ? data.venue : DEFAULT_SITE_CONTENT.venue,
            announcement: typeof data.announcement === 'string' ? data.announcement : '',
            registrationDeadlineText:
              typeof data.registrationDeadlineText === 'string' ? data.registrationDeadlineText : '',
            sponsorInfo: typeof data.sponsorInfo === 'string' ? data.sponsorInfo : '',
            contactEmail:
              typeof data.contactEmail === 'string' && data.contactEmail ? data.contactEmail : null,
            contactPhone:
              typeof data.contactPhone === 'string' && data.contactPhone ? data.contactPhone : null,
            shortFilmVotingFormUrl:
              typeof data.shortFilmVotingFormUrl === 'string' && data.shortFilmVotingFormUrl
                ? data.shortFilmVotingFormUrl
                : null,
            shortFilmVotingDeadline:
              typeof data.shortFilmVotingDeadline === 'string' && data.shortFilmVotingDeadline
                ? data.shortFilmVotingDeadline
                : null,
            timelineMilestones: Array.isArray(data.timelineMilestones)
              ? (data.timelineMilestones as SiteContentData['timelineMilestones'])
              : DEFAULT_SITE_CONTENT.timelineMilestones,
          });
        }
        setIsLoadedFromCloud(true);
      },
      (error) => {
        console.warn('Site content subscription notice:', error.message);
      }
    );

    const unsubCompetitions = onSnapshot(
      collection(db, 'competitions'),
      (snap) => {
        const nextMap: Record<string, Partial<Competition>> = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          nextMap[docSnap.id] = {
            id: docSnap.id,
            slug: typeof data.slug === 'string' ? data.slug : docSnap.id,
            index: typeof data.index === 'string' ? data.index : undefined,
            title: typeof data.title === 'string' ? data.title : undefined,
            category: data.category as Competition['category'],
            participationType: data.participationType as Competition['participationType'],
            status: data.status as CompetitionStatus,
            eligibleGrades: typeof data.eligibleGrades === 'string' ? data.eligibleGrades : '',
            teamSize: typeof data.teamSize === 'string' ? data.teamSize : '',
            schoolLimit: typeof data.schoolLimit === 'string' ? data.schoolLimit : '',
            maxDuration: typeof data.maxDuration === 'string' ? data.maxDuration : '',
            shortDescription:
              typeof data.shortDescription === 'string' ? data.shortDescription : undefined,
            fullDescription:
              typeof data.fullDescription === 'string' ? data.fullDescription : undefined,
            registrationProvider:
              (data.registrationProvider as RegistrationProvider) || 'Tally',
            registrationFormUrl:
              typeof data.registrationFormUrl === 'string' && data.registrationFormUrl
                ? data.registrationFormUrl
                : null,
            guidelinesDocId:
              typeof data.guidelinesDocId === 'string' && data.guidelinesDocId
                ? data.guidelinesDocId
                : null,
            guidelinesPdfUrl:
              typeof data.guidelinesPdfUrl === 'string' && data.guidelinesPdfUrl
                ? data.guidelinesPdfUrl
                : null,
            rules: Array.isArray(data.rules) ? (data.rules as string[]) : undefined,
            evaluationNotes: Array.isArray(data.evaluationNotes)
              ? (data.evaluationNotes as string[])
              : undefined,
            submissionNotice:
              typeof data.submissionNotice === 'string' ? data.submissionNotice : undefined,
            deadlineNotice:
              typeof data.deadlineNotice === 'string' ? data.deadlineNotice : undefined,
          };
        });
        setCloudCompetitions(nextMap);
      },
      (error) => {
        console.warn('Competitions subscription notice:', error.message);
      }
    );

    const unsubDocuments = onSnapshot(
      collection(db, 'documents'),
      (snap) => {
        const list: DocumentRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentRecord;
          list.push({ ...data, id: docSnap.id });
        });
        setDocuments(list);
      },
      (error) => {
        console.warn('Documents subscription notice:', error.message);
      }
    );

    return () => {
      unsubSite();
      unsubCompetitions();
      unsubDocuments();
    };
  }, []);

  const value = useMemo<SiteDataContextValue>(() => {
    const siteContent: SiteContentData = {
      ...DEFAULT_SITE_CONTENT,
      ...(cloudSiteContent ?? {}),
    };

    const competitions: Competition[] = DEFAULT_COMPETITIONS.map((baseComp) => {
      const override = cloudCompetitions[baseComp.id];
      const merged: Competition = override
        ? {
            ...baseComp,
            ...override,
            eligibleGrades: override.eligibleGrades ?? baseComp.eligibleGrades,
            teamSize: override.teamSize ?? baseComp.teamSize,
            schoolLimit: override.schoolLimit ?? baseComp.schoolLimit,
            maxDuration: override.maxDuration ?? baseComp.maxDuration,
          }
        : baseComp;

      // Resolve any uploaded document assigned to this competition
      const assignedDoc =
        documents.find((d) => d.id === merged.guidelinesDocId) ||
        documents.find((d) => d.scope === 'competition' && d.competitionId === merged.id) ||
        null;

      const resolvedStatus: CompetitionStatus =
        merged.status ?? (merged.registrationFormUrl ? 'Open' : 'Coming Soon');

      const registrationOpen =
        resolvedStatus === 'Open' && Boolean(merged.registrationFormUrl);

      return {
        ...merged,
        status: resolvedStatus,
        guidelinesDocId: assignedDoc ? assignedDoc.id : merged.guidelinesDocId ?? null,
        registrationOpen,
      };
    });

    const generalDocuments = documents.filter((d) => d.scope === 'general');

    return {
      siteContent,
      competitions,
      documents,
      generalDocuments,
      isLoadedFromCloud,
    };
  }, [cloudSiteContent, cloudCompetitions, documents, isLoadedFromCloud]);

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  return useContext(SiteDataContext);
}
