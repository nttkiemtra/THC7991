import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, getDoc } from "firebase/firestore";
const firebaseConfig = {
  "projectId": "de-kiem-tra-3ac7d",
  "appId": "1:243803260122:web:48215a9c593c6e2eed91e3",
  "apiKey": "AIzaSyD7SS6HWVic6VseLnTrCC05wNRZVa0b548",
  "authDomain": "de-kiem-tra-3ac7d.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-9113152d-c823-4f09-823e-3b72ef99be97",
  "storageBucket": "de-kiem-tra-3ac7d.firebasestorage.app",
  "messagingSenderId": "243803260122",
  "measurementId": ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error("Login Error Details:", error);
    const domain = window.location.hostname;
    
    if (error.code === 'auth/popup-blocked') {
      alert("Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép popup cho trang web này để tiếp tục.");
    } else if (error.code === 'auth/unauthorized-domain') {
       alert(`Lỗi: Tên miền "${domain}" chưa được cấp phép trong Firebase Console. \n\nVui lòng vào Firebase Console -> Authentication -> Settings -> Authorized domains và thêm "${domain}" vào danh sách.`);
    } else if (error.code === 'auth/operation-not-allowed') {
      alert("Phương thức đăng nhập Google chưa được kích hoạt trong Firebase Console.");
    } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      // User closed the popup, usually no alert needed or a mild one
      console.log("User closed the login popup");
    } else if (error.code === 'auth/network-request-failed') {
       alert("Lỗi mạng hoặc trình duyệt đã chặn yêu cầu. Nếu bạn đang xem ở chế độ Xem trước, hãy thử mở ứng dụng trong tab mới (nút góc trên bên phải) để đăng nhập.");
    } else {
      alert(`Lỗi đăng nhập (${error.code}): ${error.message} \n\nMẹo: Hãy thử mở ứng dụng trong tab mới nếu bạn gặp khó khăn khi đăng nhập trong khung xem trước.`);
    }
    throw error;
  }
};

export const saveExamConfig = async (name: string, data: any) => {
  const user = auth.currentUser;
  return addDoc(collection(db, "examConfigurations"), {
    name,
    data,
    userId: user?.uid || "anonymous",
    userEmail: user?.email || "anonymous",
    createdAt: serverTimestamp(),
  });
};

export const getExamConfigs = async () => {
  const q = query(collection(db, "examConfigurations"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
