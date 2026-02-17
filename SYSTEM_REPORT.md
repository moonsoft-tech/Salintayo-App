# SalinTayo — System Report  
**Backend & Frontend Overview**

---

## 1. System Overview

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | React, Ionic, Vite | `src/` |
| API | Firebase Cloud Functions (Node.js) | `functions/` |
| Logic | Python FastAPI | `logic/` |

Firebase Cloud Functions handle API, auth, and CORS; Python handles business logic.

---

## 2. Backend Architecture

### API Layer (Firebase Cloud Functions)

| Item | Description |
|------|-------------|
| Root folder | `functions/` |
| Main code | `functions/src/index.ts` |
| Role | Auth verification, CORS, routing; delegates logic to Python |

Endpoints:

- **getMe** — GET. Verifies Firebase ID token, calls Python logic, returns user info.
- **validateUserAction** — POST. Verifies token, calls Python logic for validation.

### Logic Layer (Python)

| Item | Description |
|------|-------------|
| Root folder | `logic/` |
| Main code | `logic/main.py` |
| Role | Business logic and validation |

Endpoints (called by Cloud Functions):

- **POST /logic/getMe** — Returns user info from context.
- **POST /logic/validateUserAction** — Validates action and returns result.

---

## 3. Frontend

Root folder: `src/`

| Folder / File | Role |
|---------------|------|
| `src/main.tsx` | App entry point |
| `src/App.tsx` | Root component and routing |
| `src/pages/` | Screens (Login, Register, Home, Chat, Quiz, etc.) |
| `src/components/` | Reusable UI (e.g. ProtectedRoute.tsx) |
| `src/contexts/AuthContext.tsx` | Login state and auth handling |
| `src/firebase.ts` | Firebase client setup |
| `src/utils/api.ts` | Backend calls (Cloud Functions) |

---

## 4. Request Flow

1. Frontend signs in via Firebase Auth.
2. Frontend calls Cloud Functions with `Authorization: Bearer <token>`.
3. Cloud Functions verify token.
4. Cloud Functions call Python logic service with user context.
5. Python returns result; Cloud Functions forward it to the frontend.

---

## 5. File Summary

| Type | Location | Main Files |
|------|----------|------------|
| API | `functions/` | `functions/src/index.ts` |
| Logic | `logic/` | `logic/main.py` |
| Frontend | `src/` | `main.tsx`, `App.tsx`, `pages/*.tsx`, `utils/api.ts`, `firebase.ts` |
| Config | Project root | `firebase.json`, `vite.config.ts`, `package.json` |
