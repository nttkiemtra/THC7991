import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, query, collection, onSnapshot, where, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with settings optimized for sandboxed/proxy environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') 
   ? firebaseConfig.firestoreDatabaseId 
   : undefined);

export const googleProvider = new GoogleAuthProvider();

// Error Handling
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const user = auth.currentUser;
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo:
        user?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  
  // Custom event for global toast if needed
  if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-error', { 
        detail: { message: errorMsg, operationType } 
      }));
  }

  // Do NOT throw. Throwing causes React ErrorBoundary to trigger and shows a white screen of death.
  return errInfo;
}

// Firestore Status State
export let isFirestoreConnected = true;
const listeners: ((connected: boolean) => void)[] = [];

export function onFirestoreStatusChange(cb: (connected: boolean) => void) {
  listeners.push(cb);
  cb(isFirestoreConnected);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function updateStatus(status: boolean) {
  isFirestoreConnected = status;
  listeners.forEach(cb => cb(status));
}

// Validation Test
export async function testFirestoreConnection() {
  try {
    // Attempting a server-side fetch to verify connectivity
    await getDocFromServer(doc(db, 'test-connection', 'probe-' + Date.now()));
    updateStatus(true);
  } catch (error: any) {
    if (error.message && (error.message.includes('the client is offline') || error.code === 'unavailable')) {
      updateStatus(false);
      console.error("LỖI: Trình duyệt không thể kết nối với Firestore.");
    } else if (error.code === 'permission-denied') {
      updateStatus(true); // Permission denied means we ARE connected, just rejected
    } else {
      console.error("Lỗi Firestore khác:", error.message);
    }
  }
}

// Poke occasionally to check status
setInterval(testFirestoreConnection, 30000);
testFirestoreConnection();
