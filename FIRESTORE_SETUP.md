# Firestore Database Setup for SalinTayo

This project uses Firestore only from **Cloud Functions** (Admin SDK). The client app does not access Firestore directly.

## 1. Create the database

1. Open [Firebase Console](https://console.firebase.google.com/) → your project.
2. Go to **Build** → **Firestore Database**.
3. Click **Create database**.
4. Choose a location (e.g. `us-central1` to match your functions region).
5. Start in **production mode** (rules will be set below).

## 2. Collections used

| Collection           | Purpose                                      | Document ID        | Fields                                      |
|----------------------|----------------------------------------------|--------------------|---------------------------------------------|
| `passwordResetCodes` | Temporary 6-digit codes for password reset   | `email` (`.` → `_`) | `email`, `code`, `expiresAt` (Timestamp)     |

Documents are created and deleted by Cloud Functions. No client reads or writes.

## 3. Security rules

Because only Cloud Functions access Firestore, deny all client access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // All access is via Cloud Functions (Admin SDK). Deny client access.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

To deploy these rules (the project already includes `firestore.rules` and `firebase.json`):

```bash
firebase deploy --only firestore:rules
```

## 4. Indexes

No composite indexes are required. The code only uses:

- `db.collection('passwordResetCodes').doc(docId).set(...)`
- `db.collection('passwordResetCodes').doc(docId).get()`

Single-document operations do not need indexes.

## 5. Summary

| Step | Action |
|------|--------|
| 1 | Create Firestore database in Firebase Console (production mode) |
| 2 | Deploy rules: `firebase deploy --only firestore:rules` |

After this, the password reset Cloud Functions will be able to read and write the `passwordResetCodes` collection.
