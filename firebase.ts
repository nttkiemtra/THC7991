import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, query, collection, onSnapshot, where, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with long polling to fix "offline" issues in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') 
   ? firebaseConfig.firestoreDatabaseId 
   : undefined);

export const googleProvider = new GoogleAuthProvider();

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo: user?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation Test
export async function testFirestoreConnection() {
  try {
    console.log("Testing Firestore connection for project:", firebaseConfig.projectId);
    // Attempting a server-side fetch to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection verified successfully.");
  } catch (error: any) {
    console.warn("Firestore Debug Info:", {
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      errorMessage: error.message
    });

    if (error.message && error.message.includes('the client is offline')) {
      console.error("LỖI: Trình duyệt không thể kết nối với Firestore.");
      console.error("MẸO 1: Hãy kiểm tra xem bạn đã nhấn 'Create Database' trong Firebase Console (phần Firestore Database) chưa.");
      console.error("MẸO 2: Đảm bảo bạn đã chọn đúng 'Cloud Firestore' chứ không phải 'Realtime Database'.");
    } else if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
      console.info("Firestore: Đã kết nối nhưng bị từ chối quyền truy cập. Điều này là bình thường nếu Rules đang bật và bạn chưa đăng nhập.");
    } else {
      console.error("Lỗi Firestore khác:", error.message);
    }
  }
}

testFirestoreConnection();
