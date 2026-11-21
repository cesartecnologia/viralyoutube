
import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function adminApp() {
  if (getApps().length) return getApp();

  const filePath = path.join(
    process.cwd(),
    'firebase-service-account.json'
  );

  const serviceAccount = JSON.parse(
    readFileSync(filePath, 'utf8')
  );

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
