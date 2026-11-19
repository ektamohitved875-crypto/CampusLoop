import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import type { AdminRecord, CustomerProfile, UserRecord } from '../types/campusloop';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userRecord: UserRecord | null;
  customerProfile: CustomerProfile | null;
  adminRecord: AdminRecord | null;
  isAdmin: boolean;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInAsCustomer: () => Promise<boolean>;
  signInAsAdmin: () => Promise<{ ok: boolean; denied?: boolean; message?: string }>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function verifyOrProvisionAdminRecord(user: FirebaseUser): Promise<AdminRecord | null> {
  const adminRef = doc(db, 'admins', user.uid);
  try {
    const snap = await getDoc(adminRef);
    if (snap.exists()) {
      return snap.data() as AdminRecord;
    }
  } catch {
    // Non-admin users will get permission-denied on admins/{uid} if not owner/admin
    return null;
  }

  // Only the server-bootstrapped project owner can create their initial admin record;
  // firestore.rules enforces email_verified == true and verified owner email.
  try {
    const candidate: Omit<AdminRecord, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || 'CampusLoop Administrator',
      grantedBy: 'initial_bootstrap',
      createdAt: serverTimestamp(),
    };
    await setDoc(adminRef, candidate);
    const created = await getDoc(adminRef);
    return created.exists() ? (created.data() as AdminRecord) : null;
  } catch {
    // Expected PERMISSION_DENIED for all non-authorized users
    return null;
  }
}

async function provisionOrSyncCustomerAccount(user: FirebaseUser): Promise<'active' | 'suspended'> {
  const userRef = doc(db, 'users', user.uid);
  const profileRef = doc(db, 'users', user.uid, 'profile', 'details');

  let existingStatus: 'active' | 'suspended' = 'active';

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: (user.displayName || 'CampusLoop Student').slice(0, 120),
        email: (user.email || '').slice(0, 200),
        photoURL: (user.photoURL || '').slice(0, 1000),
        role: 'customer',
        status: 'active',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      const existingData = userSnap.data() as UserRecord;
      existingStatus = existingData.status || 'active';
      if (existingStatus === 'active') {
        await updateDoc(userRef, {
          name: (user.displayName || existingData.name || 'CampusLoop Student').slice(0, 120),
          photoURL: (user.photoURL || existingData.photoURL || '').slice(0, 1000),
          lastLoginAt: serverTimestamp(),
        });
      }
    }

    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        fullName: (user.displayName || 'CampusLoop Student').slice(0, 120),
        photoURL: (user.photoURL || '').slice(0, 1000),
        email: (user.email || '').slice(0, 200),
        college: '',
        course: '',
        academicYear: '',
        campus: '',
        contactNumber: '',
        studentIdNumber: '',
        verificationStatus: 'unverified',
        savedListingIds: [],
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  return existingStatus;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [adminRecord, setAdminRecord] = useState<AdminRecord | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setUserRecord(null);
        setCustomerProfile(null);
        setAdminRecord(null);
        setAuthReady(true);
        return;
      }

      // Verify admin record strictly from Firestore admins/{uid}
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        setAdminRecord(adminSnap.exists() ? (adminSnap.data() as AdminRecord) : null);
      } catch {
        setAdminRecord(null);
      }

      unsubUser = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          setUserRecord(snap.exists() ? (snap.data() as UserRecord) : null);
        },
        (error) => {
          console.warn('User snapshot error:', error.message);
        },
      );

      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid, 'profile', 'details'),
        (snap) => {
          setCustomerProfile(snap.exists() ? (snap.data() as CustomerProfile) : null);
        },
        (error) => {
          console.warn('Profile snapshot error:', error.message);
        },
      );

      setAuthReady(true);
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInAsCustomer = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const status = await provisionOrSyncCustomerAccount(user);
      if (status === 'suspended') {
        await signOut(auth);
        setAuthError('Your account has been suspended by a CampusLoop administrator.');
        return false;
      }
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in popup was closed before completing authentication.');
      } else {
        setAuthError(msg);
      }
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signInAsAdmin = useCallback(async (): Promise<{
    ok: boolean;
    denied?: boolean;
    message?: string;
  }> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const verifiedAdmin = await verifyOrProvisionAdminRecord(user);
      if (!verifiedAdmin) {
        // Provision customer profile if needed so redirect to customer portal works cleanly
        await provisionOrSyncCustomerAccount(user);
        const deniedMsg = 'Access Denied. You are not authorized to access the Admin Portal.';
        setAdminRecord(null);
        setAuthError(deniedMsg);
        return { ok: false, denied: true, message: deniedMsg };
      }
      setAdminRecord(verifiedAdmin);
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Admin authentication failed.';
      setAuthError(msg);
      return { ok: false, message: msg };
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setAdminRecord(null);
      setUserRecord(null);
      setCustomerProfile(null);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userRecord,
        customerProfile,
        adminRecord,
        isAdmin: Boolean(adminRecord),
        authReady,
        authBusy,
        authError,
        clearAuthError,
        signInAsCustomer,
        signInAsAdmin,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
