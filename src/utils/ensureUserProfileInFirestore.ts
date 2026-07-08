import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseDb } from '../firebase';
import { clearLegacyQuickChatEnabledKey } from './quickChatStorage';
import { clearLegacyWelcomeGlobalKey } from './welcomeStorage';

/**
 * After sign-in, ensure Firestore `users/{uid}` exists so the admin panel can list learners.
 * Uses merge so EditProfileModal and streak logic keep phone, bio, languageCode, etc.
 */
export async function ensureUserProfileInFirestore(user: User): Promise<void> {
  clearLegacyQuickChatEnabledKey();
  clearLegacyWelcomeGlobalKey();
  await setDoc(
    doc(firebaseDb, 'users', user.uid),
    {
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      lastActive: serverTimestamp(),
    },
    { merge: true }
  );
}
