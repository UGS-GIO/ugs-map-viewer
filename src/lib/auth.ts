import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  OAuthProvider,
  User
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAk9zQ6zDuLFAxhJCXCklNOiBVQQFo1CD8",
  authDomain: "ut-dnr-ugs-maps-prod.firebaseapp.com",
  projectId: "ut-dnr-ugs-maps-prod",
  storageBucket: "ut-dnr-ugs-maps-prod.firebasestorage.app",
  messagingSenderId: "328621131372",
  appId: "1:328621131372:web:be0e38a400bb831f79fa49",
  measurementId: "G-RXN0523RE5"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Get the auth instance
export const auth = getAuth(app);

// Configure OIDC provider
const oidcProvider = new OAuthProvider('oidc.entra-d');

// Request email + profile so the ID token carries the `email` claim — the review-api verifies the
// token server-side and keys comments/notifications on that email (must match the internal viewer).
oidcProvider.addScope('email');
oidcProvider.addScope('profile');

export const signInWithOIDC = () => {
  return signInWithPopup(auth, oidcProvider);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};