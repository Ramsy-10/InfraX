import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf-8')
) as FirebaseAppletConfig;

const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });

const adminAuth = getAuth(adminApp);
const BOOTSTRAP_ADMIN_EMAIL = 'wijnelum@gmail.com';

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: {
    uid: string;
    email: string;
  };
}

async function isUidInAdminsCollection(uid: string, bearerToken: string): Promise<boolean> {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/admins/${encodeURIComponent(uid)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  return res.ok;
}

export async function requireAdminMiddleware(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Administrator authentication token is required.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Administrator authentication token is empty.' });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email || decoded.email_verified !== true) {
      res.status(403).json({ error: 'Administrator email must be verified.' });
      return;
    }

    const normalizedEmail = decoded.email.toLowerCase();
    let authorized = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL;

    if (!authorized) {
      authorized = await isUidInAdminsCollection(decoded.uid, token);
    }

    if (!authorized) {
      res.status(403).json({ error: 'Account is not authorized for InfraX Admin access.' });
      return;
    }

    req.adminUser = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch (err) {
    console.warn(
      'Admin auth verification failed:',
      err instanceof Error ? err.message : String(err)
    );
    res.status(401).json({ error: 'Invalid or expired administrator session.' });
  }
}
