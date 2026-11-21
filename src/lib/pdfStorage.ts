import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentRecord } from '../types/infrax';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const MAX_PDF_BYTES = 3 * 1024 * 1024; // 3 MB strict upload limit
const CHUNK_CHAR_SIZE = 500_000; // Fits cleanly under Firestore 1 MB document limit

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const blockSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += blockSize) {
    const slice = bytes.subarray(i, i + blockSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function validatePdfFile(file: File): Promise<ArrayBuffer> {
  const isPdfType =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfType) {
    throw new Error('Only PDF files (.pdf) are allowed.');
  }
  if (file.size <= 0) {
    throw new Error('Selected PDF file is empty.');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF file exceeds the 3 MB maximum size limit.');
  }

  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer.slice(0, 5));
  const signature = String.fromCharCode(...header);
  if (signature !== '%PDF-') {
    throw new Error('Invalid PDF file signature. Please upload a valid PDF document.');
  }

  return buffer;
}

function splitBase64Chunks(base64: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHAR_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_CHAR_SIZE));
  }
  return chunks;
}

export function sanitizeDocumentId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 90);
}

export async function uploadPdfDocument(params: {
  id?: string;
  title: string;
  description: string;
  scope: 'competition' | 'general';
  competitionId: string;
  file: File;
  existingChunkCount?: number;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('You must be signed in as an administrator to upload PDFs.');
  }

  const buffer = await validatePdfFile(params.file);
  const base64 = arrayBufferToBase64(buffer);
  const chunks = splitBase64Chunks(base64);
  if (chunks.length > 10) {
    throw new Error('Encoded PDF exceeds maximum allowed chunk count.');
  }

  const docId =
    params.id ||
    sanitizeDocumentId(`doc_${Date.now()}_${params.file.name.replace(/\.pdf$/i, '')}`);

  const batch = writeBatch(db);
  const docRef = doc(db, 'documents', docId);

  if (params.id) {
    batch.update(docRef, {
      title: params.title.trim().slice(0, 140),
      description: params.description.trim().slice(0, 500),
      scope: params.scope,
      competitionId: params.scope === 'competition' ? params.competitionId : '',
      fileName: params.file.name.slice(0, 200),
      fileSize: params.file.size,
      mimeType: 'application/pdf',
      chunkCount: chunks.length,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } else {
    batch.set(docRef, {
      id: docId,
      title: params.title.trim().slice(0, 140),
      description: params.description.trim().slice(0, 500),
      scope: params.scope,
      competitionId: params.scope === 'competition' ? params.competitionId : '',
      fileName: params.file.name.slice(0, 200),
      fileSize: params.file.size,
      mimeType: 'application/pdf',
      chunkCount: chunks.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  }

  chunks.forEach((chunkData, idx) => {
    const chunkRef = doc(db, 'document_chunks', `${docId}_${idx}`);
    batch.set(chunkRef, {
      documentId: docId,
      index: idx,
      data: chunkData,
      updatedBy: uid,
    });
  });

  // Remove trailing chunks if replaced PDF is smaller
  if (params.existingChunkCount && params.existingChunkCount > chunks.length) {
    for (let i = chunks.length; i < params.existingChunkCount; i++) {
      batch.delete(doc(db, 'document_chunks', `${docId}_${i}`));
    }
  }

  try {
    await batch.commit();
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `documents/${docId}`);
  }
}

export async function updatePdfMetadata(params: {
  id: string;
  title: string;
  description: string;
  scope: 'competition' | 'general';
  competitionId: string;
  existing: DocumentRecord;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required.');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'documents', params.id), {
    title: params.title.trim().slice(0, 140),
    description: params.description.trim().slice(0, 500),
    scope: params.scope,
    competitionId: params.scope === 'competition' ? params.competitionId : '',
    fileName: params.existing.fileName,
    fileSize: params.existing.fileSize,
    mimeType: 'application/pdf',
    chunkCount: params.existing.chunkCount,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `documents/${params.id}`);
  }
}

export async function deletePdfDocument(docRecord: DocumentRecord): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'documents', docRecord.id));
  for (let i = 0; i < docRecord.chunkCount; i++) {
    batch.delete(doc(db, 'document_chunks', `${docRecord.id}_${i}`));
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `documents/${docRecord.id}`);
  }
}

export async function downloadStoredPdf(docId: string, fallbackFileName?: string): Promise<void> {
  let metaSnap;
  try {
    metaSnap = await getDoc(doc(db, 'documents', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `documents/${docId}`);
  }

  if (!metaSnap.exists()) {
    throw new Error('Requested PDF document could not be found.');
  }

  const meta = metaSnap.data() as DocumentRecord;
  const chunkPromises: Promise<string>[] = [];

  for (let i = 0; i < meta.chunkCount; i++) {
    chunkPromises.push(
      getDoc(doc(db, 'document_chunks', `${docId}_${i}`))
        .then((snap) => {
          if (!snap.exists()) {
            throw new Error(`Missing PDF chunk ${i}`);
          }
          return (snap.data() as { data: string }).data;
        })
        .catch((err) => handleFirestoreError(err, OperationType.GET, `document_chunks/${docId}_${i}`))
    );
  }

  const chunkStrings = await Promise.all(chunkPromises);
  const fullBase64 = chunkStrings.join('');
  const bytes = base64ToUint8Array(fullBase64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = meta.fileName || fallbackFileName || 'infrax-document.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
