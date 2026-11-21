import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function adminApp() {
  if (getApps().length) return getApp();

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  // Apenas desenvolvimento local: nunca inclua esse JSON no Git.
  if (process.env.NODE_ENV !== 'production') {
    const filePath = path.join(process.cwd(), 'firebase-service-account.json');
    if (existsSync(filePath)) {
      const account = JSON.parse(readFileSync(filePath, 'utf8'));
      return initializeApp({ credential: cert(account) });
    }
  }

  throw new Error(
    'Firebase Admin nao configurado. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no servidor.'
  );
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
