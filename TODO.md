# Refactoring & Improvement Plan

## Progress Tracker

- [ ] 1. Refactor `bootLogger.ts` - replace `any` types with proper interfaces
- [ ] 2. Extract OCR functions from Chat.tsx into `src/utils/imageOcr.ts`
- [ ] 3. Extract translation helpers from Chat.tsx into `src/utils/translationHelpers.ts`
- [ ] 4. Fix DRY violation - `stripUndefinedFields` duplicate in Chat.tsx
- [ ] 5. Fix QuickChatBubble.tsx anti-pattern (setState stored in refs)
- [ ] 6. Add proper TypeScript types across the app
- [ ] 7. Extract EmergencyPhrasesModal from QuickChatBubble.tsx into its own file
- [ ] 8. Fix image caption display in Chat.tsx
- [ ] 9. Add blob URL cleanup for voice/image flows
- [ ] 10. Add error boundaries for individual features
