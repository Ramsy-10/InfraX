import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  EVENT_CONFIG,
  SHORT_FILM_VOTING_DEADLINE,
  SHORT_FILM_VOTING_FORM_URL,
  TIMELINE_MILESTONES,
} from '../config/infraxConfig';
import type {
  Competition,
  CompetitionStatus,
  RegistrationProvider,
  SiteContentData,
} from '../types/infrax';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

function buildCompetitionPayload(comp: Competition, uid: string) {
  return {
    id: comp.id,
    slug: comp.slug,
    index: comp.index,
    title: comp.title.trim().slice(0, 120),
    category: comp.category,
    participationType: comp.participationType,
    status: (comp.status ?? (comp.registrationFormUrl ? 'Open' : 'Coming Soon')) as CompetitionStatus,
    eligibleGrades: (comp.eligibleGrades ?? '').trim().slice(0, 80),
    teamSize: (comp.teamSize ?? '').trim().slice(0, 80),
    schoolLimit: (comp.schoolLimit ?? '').trim().slice(0, 120),
    maxDuration: (comp.maxDuration ?? '').trim().slice(0, 80),
    shortDescription: comp.shortDescription.trim().slice(0, 400),
    fullDescription: comp.fullDescription.trim().slice(0, 2000),
    registrationProvider: (comp.registrationProvider ?? 'Tally') as RegistrationProvider,
    registrationFormUrl: (comp.registrationFormUrl ?? '').trim().slice(0, 500),
    guidelinesDocId: (comp.guidelinesDocId ?? '').trim().slice(0, 128),
    guidelinesPdfUrl: (comp.guidelinesPdfUrl ?? '').trim().slice(0, 500),
    rules: comp.rules.map((r) => r.trim()).filter(Boolean).slice(0, 20),
    evaluationNotes: comp.evaluationNotes.map((n) => n.trim()).filter(Boolean).slice(0, 10),
    submissionNotice: comp.submissionNotice.trim().slice(0, 600),
    deadlineNotice: comp.deadlineNotice.trim().slice(0, 400),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
}

export async function saveCompetitionToFirestore(comp: Competition): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Administrator authentication required.');

  const path = `competitions/${comp.id}`;
  try {
    await setDoc(doc(db, 'competitions', comp.id), buildCompetitionPayload(comp, uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSiteContentToFirestore(content: SiteContentData): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Administrator authentication required.');

  const sanitizedMilestones = content.timelineMilestones.slice(0, 15).map((m) => ({
    id: m.id,
    step: m.step,
    title: m.title.trim(),
    date: m.date && m.date.trim() ? m.date.trim() : null,
    phase: m.phase.trim(),
    description: m.description.trim(),
    ...(m.actionLabel ? { actionLabel: m.actionLabel } : {}),
    ...(m.actionPath ? { actionPath: m.actionPath } : {}),
  }));

  const payload = {
    eventDate: (content.eventDate ?? '').trim().slice(0, 64),
    eventDateDisplay: content.eventDateDisplay.trim().slice(0, 80),
    venue: (content.venue.trim() || EVENT_CONFIG.venue).slice(0, 160),
    announcement: content.announcement.trim().slice(0, 600),
    registrationDeadlineText: content.registrationDeadlineText.trim().slice(0, 300),
    sponsorInfo: content.sponsorInfo.trim().slice(0, 600),
    contactEmail: (content.contactEmail ?? '').trim().slice(0, 160),
    contactPhone: (content.contactPhone ?? '').trim().slice(0, 60),
    shortFilmVotingFormUrl: (content.shortFilmVotingFormUrl ?? '').trim().slice(0, 500),
    shortFilmVotingDeadline: (content.shortFilmVotingDeadline ?? '').trim().slice(0, 64),
    timelineMilestones: sanitizedMilestones,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };

  try {
    await setDoc(doc(db, 'site_content', 'main'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'site_content/main');
  }
}

export async function seedBaselineToFirestore(
  competitions: Competition[],
  siteContent?: SiteContentData
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Administrator authentication required.');

  const batch = writeBatch(db);

  competitions.forEach((comp) => {
    batch.set(doc(db, 'competitions', comp.id), buildCompetitionPayload(comp, uid));
  });

  const baseSite: SiteContentData = siteContent ?? {
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

  batch.set(doc(db, 'site_content', 'main'), {
    eventDate: (baseSite.eventDate ?? '').trim().slice(0, 64),
    eventDateDisplay: baseSite.eventDateDisplay.trim().slice(0, 80),
    venue: baseSite.venue.trim().slice(0, 160),
    announcement: baseSite.announcement.trim().slice(0, 600),
    registrationDeadlineText: baseSite.registrationDeadlineText.trim().slice(0, 300),
    sponsorInfo: baseSite.sponsorInfo.trim().slice(0, 600),
    contactEmail: (baseSite.contactEmail ?? '').trim().slice(0, 160),
    contactPhone: (baseSite.contactPhone ?? '').trim().slice(0, 60),
    shortFilmVotingFormUrl: (baseSite.shortFilmVotingFormUrl ?? '').trim().slice(0, 500),
    shortFilmVotingDeadline: (baseSite.shortFilmVotingDeadline ?? '').trim().slice(0, 64),
    timelineMilestones: baseSite.timelineMilestones.slice(0, 15),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'competitions & site_content/main');
  }
}

export async function addAdminUid(targetUid: string, email: string): Promise<void> {
  const cleanUid = targetUid.trim();
  const cleanEmail = email.trim();
  if (!cleanUid || !cleanEmail) {
    throw new Error('Both User UID and verified email are required.');
  }
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      email: cleanEmail.slice(0, 160),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admins/${cleanUid}`);
  }
}

export async function removeAdminUid(targetUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${targetUid}`);
  }
}
