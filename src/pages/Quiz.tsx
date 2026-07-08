import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import {
  closeOutline,
  checkmarkCircle,
  closeCircle,
  heart,
  heartOutline,
  flashOutline,
  sparklesOutline,
  refreshOutline,
  chatbubbleOutline,
  homeOutline,
  bookOutline,
  documentTextOutline,
  personOutline,
  alertCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import { LANGUAGES, type Language } from './LanguageModal';
import { getResolvedDialectLangCode } from '../utils/dialectPreference';
import { useIonContentScrollTopOnEnter } from '../utils/useIonContentScrollTopOnEnter';
import { chatWithDeepSeek, type DeepSeekMessage } from '../utils/api';
import { doc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebase';
import { QUIZ_PROGRESS_UPDATED_EVENT } from '../utils/learningLevel';
import './Quiz.css';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */
type QuestionType = 'translate_word' | 'multiple_choice' | 'match_pairs' | 'fill_blank';

interface BaseQuestion { type: QuestionType; id: string; }

interface TranslateWordQ extends BaseQuestion {
  type: 'translate_word';
  /** The word the user looked up, shown in source language */
  sourceWord: string;
  /** The correct translation */
  answer: string;
  /** Word bank: answer + distractors (shuffled) */
  wordBank: string[];
}

interface MultipleChoiceQ extends BaseQuestion {
  type: 'multiple_choice';
  /** e.g. "What does 'bahay' mean?" */
  prompt: string;
  choices: string[];
  answer: string;
}

interface MatchPairsQ extends BaseQuestion {
  type: 'match_pairs';
  pairs: { left: string; right: string }[];
}

interface FillBlankQ extends BaseQuestion {
  type: 'fill_blank';
  /** Sentence with ___ placeholder */
  sentence: string;
  choices: string[];
  answer: string;
  hint?: string;
}

type TestQuestion = TranslateWordQ | MultipleChoiceQ | MatchPairsQ | FillBlankQ;

/* ═══════════════════════════════════════════════════════════
   TRANSLATION HISTORY HELPERS
   ═══════════════════════════════════════════════════════════
   Quiz material is built from chat sessions (saved + current) keyed by user id.

   Expected shape per entry:
   {
     sourceText: string;      // what the user typed
     translatedText: string;  // what the AI returned
     dialect: string;         // dialect id  e.g. "ceb"
     timestamp: number;
   }
   ═══════════════════════════════════════════════════════════ */
const ACTIVE_DIALECT_KEY = 'salintayo_active_dialect';
const QUIZ_PROGRESS_KEY = 'salintayo_quiz_v2_progress';
const QUIZ_ATTEMPTS_KEY = 'salintayo_quiz_attempts';

interface QuizAttempt {
  quizId: string;
  dialectId: string;
  score: number;
  timestamp: number;
  questionCount: number;
}

function generateQuizId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadQuizAttempts(dialectId: string): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(`${QUIZ_ATTEMPTS_KEY}_${dialectId}`);
    const attempts: QuizAttempt[] = raw ? JSON.parse(raw) : [];
    return attempts.map((attempt) => ({
      quizId: attempt.quizId ?? generateQuizId(),
      dialectId: attempt.dialectId,
      score: attempt.score,
      timestamp: attempt.timestamp,
      questionCount: attempt.questionCount,
    }));
  } catch { return []; }
}

async function syncQuizAttemptToFirestore(attempt: QuizAttempt): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) return;

  try {
    await setDoc(doc(firebaseDb, 'users', user.uid, 'quizHistory', attempt.quizId), {
      quizId: attempt.quizId,
      dialectId: attempt.dialectId,
      score: attempt.score,
      timestamp: attempt.timestamp,
      questionCount: attempt.questionCount,
      source: 'app-quiz',
    }, { merge: true });
  } catch (error) {
    console.warn('Failed to sync quiz attempt to Firestore:', error);
  }
}

function saveQuizAttempt(dialectId: string, score: number, questionCount: number) {
  try {
    const attempts = loadQuizAttempts(dialectId);
    const newAttempt: QuizAttempt = {
      quizId: generateQuizId(),
      dialectId,
      score,
      timestamp: Date.now(),
      questionCount,
    };
    const updated = [newAttempt, ...attempts].slice(0, 20);
    localStorage.setItem(`${QUIZ_ATTEMPTS_KEY}_${dialectId}`, JSON.stringify(updated));
    void syncQuizAttemptToFirestore(newAttempt);
    try {
      window.dispatchEvent(new Event(QUIZ_PROGRESS_UPDATED_EVENT));
    } catch { /* ignore */ }
  } catch {}
}

function clearQuizAttempts(dialectId: string) {
  try {
    localStorage.removeItem(`${QUIZ_ATTEMPTS_KEY}_${dialectId}`);
  } catch {}
}

export interface TranslationEntry {
  sourceText: string;
  translatedText: string;
  dialect: string;
  timestamp: number;
}

function loadTranslationHistory(): TranslationEntry[] {
  try {
    const uid = firebaseAuth.currentUser?.uid || 'guest';
    const sessionsKey = `salintayo_chat_sessions:${uid}`;
    const currentSessionKey = `salintayo_chat_current_session:${uid}`;

    const rawSessions = localStorage.getItem(sessionsKey);
    const savedSessions: { messages: { role: string; content: string; timestamp?: string }[]; savedAt: number }[] = rawSessions ? JSON.parse(rawSessions) : [];

    const rawCurrent = sessionStorage.getItem(currentSessionKey);
    const currentMessages: { role: string; content: string; timestamp?: string }[] = rawCurrent ? JSON.parse(rawCurrent) : [];
    const sessions = [...savedSessions];

    if (currentMessages.length > 0) {
      sessions.unshift({
        messages: currentMessages,
        savedAt: Date.now(),
      } as { messages: { role: string; content: string; timestamp?: string }[]; savedAt: number });
    }

    const entries: TranslationEntry[] = [];
    const dialect = loadActiveDialect()?.id || 'ceb';

    sessions.forEach(session => {
      let userMessage = '';
      session.messages.forEach(msg => {
        if (msg.role === 'user') {
          userMessage = msg.content;
        } else if (msg.role === 'ai' && userMessage) {
          entries.push({
            sourceText: userMessage,
            translatedText: msg.content,
            dialect,
            timestamp: session.savedAt,
          });
          userMessage = '';
        }
      });
    });

    return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  } catch {
    return [];
  }
}

/* Accent colour — first hex stop from the language's gradient string */
function accentFromGradient(gradient: string): string {
  const m = gradient.match(/#[0-9a-fA-F]{3,6}/);
  return m ? m[0] : '#206BFF';
}

function loadActiveDialect(): { id: string; name: string; native: string; accentColor: string; gradient: string } | null {
  try {
    /* Primary: read the code saved by LanguageModal / Chat */
    const code = localStorage.getItem('salintayo_dialect_lang')?.trim().toLowerCase()
                ?? localStorage.getItem(ACTIVE_DIALECT_KEY);

    /* Try to match against the canonical LANGUAGES list first */
    let lang: Language | undefined;
    if (code) {
      lang = LANGUAGES.find((l: Language) => l.code === code);
      /* Fallback: maybe the full JSON object was stored */
      if (!lang) {
        try {
          const parsed = JSON.parse(code);
          if (parsed?.code) lang = LANGUAGES.find((l: Language) => l.code === parsed.code);
        } catch { /* not JSON */ }
      }
    }

    /* If still no match, try the richer stored object */
    if (!lang) {
      const raw = localStorage.getItem(ACTIVE_DIALECT_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { id?: string; code?: string };
        const id = stored?.id ?? stored?.code;
        if (id) lang = LANGUAGES.find((l: Language) => l.code === id);
      }
    }

    if (!lang) {
      const fb = getResolvedDialectLangCode();
      lang = LANGUAGES.find((l: Language) => l.code === fb);
    }

    if (!lang) return null;

    return {
      id:          lang.code,
      name:        lang.name,
      native:      lang.native,
      accentColor: accentFromGradient(lang.gradient),
      gradient:    lang.gradient,
    };
  } catch { return null; }
}

interface QuizProgress {
  totalTaken: number;
  bestScore: number;
  lastScore: number;
  lastDate: number;
}

function loadQuizProgress(dialectId: string): QuizProgress {
  try {
    const raw = localStorage.getItem(`${QUIZ_PROGRESS_KEY}_${dialectId}`);
    return raw ? JSON.parse(raw) : { totalTaken: 0, bestScore: 0, lastScore: 0, lastDate: 0 };
  } catch { return { totalTaken: 0, bestScore: 0, lastScore: 0, lastDate: 0 }; }
}

function saveQuizProgress(dialectId: string, score: number) {
  try {
    const prev = loadQuizProgress(dialectId);
    const next: QuizProgress = {
      totalTaken: prev.totalTaken + 1,
      bestScore: Math.max(prev.bestScore, score),
      lastScore: score,
      lastDate: Date.now(),
    };
    localStorage.setItem(`${QUIZ_PROGRESS_KEY}_${dialectId}`, JSON.stringify(next));
  } catch {}
}

/* ═══════════════════════════════════════════════════════════
   UTILITY
   ═══════════════════════════════════════════════════════════ */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDate(ts: number): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════
   AI QUIZ GENERATOR
   Calls the chat model to build a quiz from the user's
   chat history for the active dialect.
   ═══════════════════════════════════════════════════════════ */
async function generateQuizFromHistory(
  history: TranslationEntry[],
  dialectId: string,
  dialectName: string
): Promise<TestQuestion[]> {
  // Build a compact list of source→translation pairs for the prompt
  const pairs = history
    .filter(e => e.dialect === dialectId)
    .slice(-30) // use the 30 most recent entries
    .map(e => `"${e.sourceText.trim()}" → "${e.translatedText.trim()}"`)
    .join('\n');

  if (!pairs) return [];

  const systemPrompt = `You are a language quiz generator for a Filipino dialect learning app called SalinTayo.
You will receive a list of user messages and AI responses from chat conversations in ${dialectName} (${dialectId}).
Your job is to extract useful translation pairs from these conversations and create a quiz that helps the user RECALL and REVIEW translations they have encountered.

CRITICAL EXTRACTION RULES:
1. **EXTRACT TRANSLATION PAIRS**: Look for patterns where the user asks for translations or the AI provides translations.
   - User: "What is 'hello' in Cebuano?" AI: "kumusta"
   - User: "Translate 'thank you'" AI: "salamat"
   - User: "How do you say 'water'?" AI: "tubig"
   - Extract the English word/phrase and its ${dialectName} translation

2. **FILTER OUT GIBBERISH**: Do NOT include any pairs where the source or target text looks like gibberish/nonsense:
   - Random character combinations with no vowels (e.g., "bbbcccddff")
   - Only numbers or special characters (e.g., "123", "!!@@##")
   - More than 4 consonants in a row (gibberish indicator)
   - Mostly non-alphabetic characters
   - Fewer than 2 characters (too short to be valid)
   
3. **AUTO-CORRECT TYPOS**: Before generating questions, silently correct common misspellings in Filipino/Cebuano/Ilocano/Tagalog:
   - "kumsta" → "kumusta", "salamet" → "salamat"
   - "maganda" → "maganda", "pilipinas" → "pilipinas"
   - Common accidental duplications or transpositions
   - Use your knowledge of these languages to normalize spellings
   
4. **ONLY USE VALID PAIRS**: Only generate questions from pairs that pass the above filters.

IMPORTANT RULES:
- Only use words/phrases from the extracted and corrected pairs. Do NOT invent new words.
- Every question must be directly traceable to one of the valid pairs.
- Distractor choices in multiple choice or word bank must be real words from OTHER valid pairs in the list.
- If there are fewer than 4 valid pairs after filtering, generate only 'multiple_choice' and 'translate_word' questions.
- If there are 6+ unique valid pairs, include at least one 'match_pairs' question with up to 5 pairs.
- Keep questions clear, short, and useful for recall practice.
- Return ONLY valid JSON, no markdown fences, no extra text.

Return a JSON array of question objects. Each object must have this shape:

For translate_word:
{ "type": "translate_word", "id": "q1", "sourceWord": "hello", "answer": "kumusta", "wordBank": ["kumusta","salamat","oo","dili"] }

For multiple_choice:
{ "type": "multiple_choice", "id": "q2", "prompt": "What does 'salamat' mean in English?", "choices": ["Thank you","Hello","Water","Goodbye"], "answer": "Thank you" }

For match_pairs (use 3-5 pairs from the list):
{ "type": "match_pairs", "id": "q3", "pairs": [{"left":"oo","right":"yes"},{"left":"dili","right":"no"}] }

For fill_blank:
{ "type": "fill_blank", "id": "q4", "sentence": "___ means thank you in Cebuano.", "choices": ["Salamat","Tubig","Oo","Dili"], "answer": "Salamat", "hint": "You asked about this in chat" }

Generate 5 to 8 questions total (or fewer if fewer valid pairs exist after filtering). Vary the types.`;

  const userPrompt = `Here are recent chat conversations in ${dialectName}:\n${pairs}\n\nExtract translation pairs from these conversations and generate a quiz to help them recall the translations they have encountered.`;

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const rawText = await chatWithDeepSeek(messages);

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const questions: TestQuestion[] = JSON.parse(cleaned);
  return questions;
}

/* ═══════════════════════════════════════════════════════════
   TRANSLATE WORD COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface TranslateWordProps {
  q: TranslateWordQ;
  accentColor: string;
  onAnswer: (correct: boolean) => void;
}

const TranslateWordView: React.FC<TranslateWordProps> = ({ q, accentColor, onAnswer }) => {
  const [bank, setBank] = useState<string[]>(() => shuffle(q.wordBank));
  const [chosen, setChosen] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const addWord = (word: string, idx: number) => {
    if (checked) return;
    setChosen(prev => [...prev, word]);
    setBank(prev => prev.filter((_, i) => i !== idx));
  };

  const removeWord = (word: string, idx: number) => {
    if (checked) return;
    setBank(prev => [...prev, word]);
    setChosen(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCheck = () => {
    const correct = chosen.join(' ').trim().toLowerCase() === q.answer.trim().toLowerCase();
    setIsCorrect(correct);
    setChecked(true);
    onAnswer(correct);
  };

  return (
    <div className="qt-translate">
      <div className="qt-prompt-row">
        <span className="qt-prompt-text qt-prompt-text--word">
          {q.sourceWord}
        </span>
      </div>
      <p className="qt-prompt-sub">Tap the correct translation below</p>

      <div className={`qt-answer-area ${checked ? (isCorrect ? 'qt-answer-area--correct' : 'qt-answer-area--wrong') : ''}`}>
        {chosen.length === 0
          ? <span className="qt-answer-placeholder">Your answer will appear here</span>
          : chosen.map((w, i) => (
              <button key={i} className="qt-word qt-word--chosen" onClick={() => removeWord(w, i)}>{w}</button>
            ))
        }
      </div>

      <div className="qt-divider" />

      <div className="qt-word-bank">
        {bank.map((w, i) => (
          <button key={i} className="qt-word qt-word--bank" onClick={() => addWord(w, i)}>{w}</button>
        ))}
      </div>

      {checked && (
        <div className={`qt-feedback ${isCorrect ? 'qt-feedback--correct' : 'qt-feedback--wrong'}`}>
          {isCorrect
            ? <><span className="qt-feedback__icon">✅</span><span className="qt-feedback__msg">Correct! You remembered it.</span></>
            : <><span className="qt-feedback__icon">❌</span>
                <div>
                  <div className="qt-feedback__msg">Not quite!</div>
                  <div className="qt-feedback__answer">Correct answer: <strong>{q.answer}</strong></div>
                </div>
              </>
          }
        </div>
      )}

      {!checked && (
        <button
          className="qt-check-btn"
          style={{ background: chosen.length > 0 ? accentColor : '#e5e7eb', color: chosen.length > 0 ? '#fff' : '#9ca3af' }}
          onClick={handleCheck}
          disabled={chosen.length === 0}
        >
          Check Answer
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MULTIPLE CHOICE COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface MCProps { q: MultipleChoiceQ; accentColor: string; onAnswer: (correct: boolean) => void; }

const MultipleChoiceView: React.FC<MCProps> = ({ q, accentColor, onAnswer }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = selected === q.answer;

  const handleCheck = () => {
    if (!selected || checked) return;
    setChecked(true);
    onAnswer(selected === q.answer);
  };

  return (
    <div className="qt-mc">
      <div className="qt-prompt-row">
        <span className="qt-prompt-text">{q.prompt}</span>
      </div>

      <div className="qt-mc__choices">
        {q.choices.map(c => {
          let cls = 'qt-mc-choice';
          if (checked) {
            if (c === q.answer) cls += ' qt-mc-choice--correct';
            else if (c === selected) cls += ' qt-mc-choice--wrong';
          } else if (c === selected) {
            cls += ' qt-mc-choice--selected';
          }
          return (
            <button
              key={c}
              className={cls}
              style={c === selected && !checked ? { borderColor: accentColor } : undefined}
              onClick={() => !checked && setSelected(c)}
              disabled={checked}
            >
              {checked && c === q.answer && <IonIcon icon={checkmarkCircle} className="qt-mc-choice__icon qt-mc-choice__icon--ok" />}
              {checked && c === selected && c !== q.answer && <IonIcon icon={closeCircle} className="qt-mc-choice__icon qt-mc-choice__icon--ng" />}
              <span>{c}</span>
            </button>
          );
        })}
      </div>

      {checked && (
        <div className={`qt-feedback ${isCorrect ? 'qt-feedback--correct' : 'qt-feedback--wrong'}`}>
          {isCorrect
            ? <><span className="qt-feedback__icon">✅</span><span className="qt-feedback__msg">Correct!</span></>
            : <><span className="qt-feedback__icon">❌</span>
                <div>
                  <div className="qt-feedback__msg">Not quite!</div>
                  <div className="qt-feedback__answer">Correct answer: <strong>{q.answer}</strong></div>
                </div>
              </>
          }
        </div>
      )}

      {!checked && (
        <button
          className="qt-check-btn"
          style={{ background: selected ? accentColor : '#e5e7eb', color: selected ? '#fff' : '#9ca3af' }}
          onClick={handleCheck}
          disabled={!selected}
        >
          Check Answer
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MATCH PAIRS COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface MatchProps { q: MatchPairsQ; accentColor: string; onAnswer: (correct: boolean) => void; }

const MatchPairsView: React.FC<MatchProps> = ({ q, accentColor, onAnswer }) => {
  const [leftSel, setLeftSel] = useState<string | null>(null);
  const [rightSel, setRightSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const rightWords = useRef(shuffle(q.pairs.map(p => p.right))).current;
  const leftWords = q.pairs.map(p => p.left);

  useEffect(() => {
    if (leftSel && rightSel) {
      const pair = q.pairs.find(p => p.left === leftSel);
      if (pair && pair.right === rightSel) {
        const next = new Set(matched);
        next.add(leftSel); next.add(rightSel);
        setMatched(next);
        setLeftSel(null); setRightSel(null);
        if (next.size === q.pairs.length * 2) {
          setDone(true);
          onAnswer(true);
        }
      } else {
        setWrong(new Set([leftSel, rightSel]));
        setTimeout(() => { setWrong(new Set()); setLeftSel(null); setRightSel(null); }, 700);
      }
    }
  }, [leftSel, rightSel]);

  const btnClass = (word: string, isLeft: boolean) => {
    if (matched.has(word)) return 'qt-pair-btn qt-pair-btn--matched';
    if (wrong.has(word)) return 'qt-pair-btn qt-pair-btn--wrong';
    if (isLeft && leftSel === word) return 'qt-pair-btn qt-pair-btn--selected';
    if (!isLeft && rightSel === word) return 'qt-pair-btn qt-pair-btn--selected';
    return 'qt-pair-btn';
  };

  const selStyle = (word: string, sel: boolean) =>
    sel ? { borderColor: accentColor, background: `${accentColor}18` } : undefined;

  return (
    <div className="qt-match">
      <p className="qt-prompt-sub" style={{ marginBottom: 12 }}>Match each word to its translation</p>
      <div className="qt-match__grid">
        <div className="qt-match__col">
          {leftWords.map(w => (
            <button key={w} className={btnClass(w, true)}
              style={selStyle(w, leftSel === w)}
              onClick={() => !matched.has(w) && !done && setLeftSel(w)}
              disabled={matched.has(w) || done}
            >{w}</button>
          ))}
        </div>
        <div className="qt-match__col">
          {rightWords.map(w => (
            <button key={w} className={btnClass(w, false)}
              style={selStyle(w, rightSel === w)}
              onClick={() => !matched.has(w) && !done && setRightSel(w)}
              disabled={matched.has(w) || done}
            >{w}</button>
          ))}
        </div>
      </div>
      {done && (
        <div className="qt-feedback qt-feedback--correct">
          <span className="qt-feedback__icon">✅</span>
          <span className="qt-feedback__msg">All pairs matched!</span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   FILL IN THE BLANK COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface FillBlankProps { q: FillBlankQ; accentColor: string; onAnswer: (correct: boolean) => void; }

const FillBlankView: React.FC<FillBlankProps> = ({ q, accentColor, onAnswer }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = selected === q.answer;

  const handleCheck = () => {
    if (!selected || checked) return;
    setChecked(true);
    onAnswer(selected === q.answer);
  };

  // Render the sentence with the blank highlighted
  const parts = q.sentence.split('___');

  return (
    <div className="qt-mc">
      <div className="qt-fill-sentence">
        <span>{parts[0]}</span>
        <span
          className="qt-fill-blank"
          style={{ borderColor: accentColor, color: selected ? accentColor : undefined }}
        >
          {selected ?? '______'}
        </span>
        {parts[1] && <span>{parts[1]}</span>}
      </div>
      {q.hint && <p className="qt-fill-hint">💡 {q.hint}</p>}

      <div className="qt-mc__choices">
        {q.choices.map(c => {
          let cls = 'qt-mc-choice';
          if (checked) {
            if (c === q.answer) cls += ' qt-mc-choice--correct';
            else if (c === selected) cls += ' qt-mc-choice--wrong';
          } else if (c === selected) {
            cls += ' qt-mc-choice--selected';
          }
          return (
            <button
              key={c}
              className={cls}
              style={c === selected && !checked ? { borderColor: accentColor } : undefined}
              onClick={() => !checked && setSelected(c)}
              disabled={checked}
            >
              {checked && c === q.answer && <IonIcon icon={checkmarkCircle} className="qt-mc-choice__icon qt-mc-choice__icon--ok" />}
              {checked && c === selected && c !== q.answer && <IonIcon icon={closeCircle} className="qt-mc-choice__icon qt-mc-choice__icon--ng" />}
              <span>{c}</span>
            </button>
          );
        })}
      </div>

      {checked && (
        <div className={`qt-feedback ${isCorrect ? 'qt-feedback--correct' : 'qt-feedback--wrong'}`}>
          {isCorrect
            ? <><span className="qt-feedback__icon">✅</span><span className="qt-feedback__msg">Correct!</span></>
            : <><span className="qt-feedback__icon">❌</span>
                <div>
                  <div className="qt-feedback__msg">Not quite!</div>
                  <div className="qt-feedback__answer">Answer: <strong>{q.answer}</strong></div>
                </div>
              </>
          }
        </div>
      )}

      {!checked && (
        <button
          className="qt-check-btn"
          style={{ background: selected ? accentColor : '#e5e7eb', color: selected ? '#fff' : '#9ca3af' }}
          onClick={handleCheck}
          disabled={!selected}
        >
          Check Answer
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   RESULT SCREEN
   ═══════════════════════════════════════════════════════════ */
interface ResultProps {
  dialectName: string;
  correct: number;
  total: number;
  accentColor: string;
  xpEarned: number;
  timeSeconds: number;
  onBack: () => void;
  onRetry: () => void;
}

const ResultScreen: React.FC<ResultProps> = ({
  dialectName, correct, total, accentColor, xpEarned, timeSeconds, onBack, onRetry,
}) => {
  const safeTotal = total > 0 ? total : 0;
  const safeCorrect = safeTotal > 0 ? Math.min(Math.max(0, correct), safeTotal) : 0;
  const finalScore = safeTotal > 0 ? Math.round((safeCorrect / safeTotal) * 100) : 0;
  const incorrect = safeTotal > 0 ? Math.max(0, safeTotal - safeCorrect) : 0;
  const circumference = 2 * Math.PI * 34;
  const safeTime = Number.isFinite(timeSeconds) && timeSeconds >= 0 ? Math.floor(timeSeconds) : 0;
  const mins = Math.floor(safeTime / 60);
  const secs = safeTime % 60;
  const passed = finalScore >= 60;
  const timeLabel = `${mins}:${secs.toString().padStart(2, '0')}`;
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xpEarned) ? xpEarned : 0));

  return (
    <div className="qt-result" role="region" aria-label="Quiz results">
      <div className="qt-result__header">
        <div className="qt-result__emoji" aria-hidden>{finalScore === 100 ? '🏆' : passed ? '🎉' : '😅'}</div>
        <h2 className="qt-result__title">
          {safeTotal === 0
            ? 'Quiz finished'
            : finalScore === 100
              ? 'Perfect score!'
              : passed
                ? 'Quiz complete!'
                : 'Keep practicing!'}
        </h2>
        <p className="qt-result__subtitle">{dialectName || 'Your dialect'} · Vocabulary review</p>
      </div>

      <div className="qt-result__card">
        <div className="qt-result__score-block">
          <div className="qt-result__score-ring" aria-hidden>
            <svg viewBox="0 0 80 80" className="qt-result__score-svg">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="8" />
              <circle
                className="qt-result__score-arc"
                cx="40" cy="40" r="34" fill="none"
                stroke={accentColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - finalScore / 100)}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <span className="qt-result__score-num">{safeTotal > 0 ? `${finalScore}%` : '—'}</span>
          </div>
          <div className="qt-result__score-copy">
            <p className="qt-result__score-label">Your score</p>
            <p className="qt-result__fraction">
              {safeTotal > 0 ? (
                <>
                  <strong>{safeCorrect}</strong>
                  <span className="qt-result__fraction-sep">/</span>
                  <span>{safeTotal}</span>
                  <span className="qt-result__fraction-hint"> correct</span>
                </>
              ) : (
                <span className="qt-result__fraction-hint">No questions graded</span>
              )}
            </p>
            {safeTotal > 0 && (
              <p className="qt-result__incorrect-line">
                <IonIcon icon={closeCircle} className="qt-result__incorrect-icon" aria-hidden />
                <span>{incorrect} incorrect</span>
              </p>
            )}
          </div>
        </div>

        <div className="qt-result__metrics">
          <div className="qt-result__metric">
            <span className="qt-result__metric-icon qt-result__metric-icon--ok" aria-hidden>
              <IonIcon icon={checkmarkCircle} />
            </span>
            <span className="qt-result__metric-val">{safeTotal > 0 ? safeCorrect : '—'}</span>
            <span className="qt-result__metric-lbl">Correct</span>
          </div>
          <div className="qt-result__metric">
            <span className="qt-result__metric-icon qt-result__metric-icon--bad" aria-hidden>
              <IonIcon icon={closeCircle} />
            </span>
            <span className="qt-result__metric-val">{safeTotal > 0 ? incorrect : '—'}</span>
            <span className="qt-result__metric-lbl">Incorrect</span>
          </div>
          <div className="qt-result__metric">
            <span className="qt-result__metric-icon qt-result__metric-icon--time" aria-hidden>⏱</span>
            <span className="qt-result__metric-val">{timeLabel}</span>
            <span className="qt-result__metric-lbl">Time</span>
          </div>
          <div className="qt-result__metric">
            <span className="qt-result__metric-icon qt-result__metric-icon--xp" aria-hidden>
              <IonIcon icon={flashOutline} />
            </span>
            <span className="qt-result__metric-val">+{safeXp}</span>
            <span className="qt-result__metric-lbl">XP</span>
          </div>
        </div>

        <div className="qt-result__xp-strip" style={{ background: accentColor }}>
          <IonIcon icon={flashOutline} className="qt-result__xp-strip-icon" aria-hidden />
          <span className="qt-result__xp-strip-text">XP earned this round</span>
          <span className="qt-result__xp-strip-val">+{safeXp}</span>
        </div>
      </div>

      {passed && safeTotal > 0 && (
        <p className="qt-result__unlock">
          Great job reviewing your {dialectName || 'learning'} words!
        </p>
      )}

      <div className="qt-result__actions">
        <button
          type="button"
          className="qt-result__btn qt-result__btn--primary"
          style={{ background: accentColor }}
          onClick={onRetry}
        >
          <IonIcon icon={refreshOutline} className="qt-result__btn-icon" aria-hidden />
          Retry Quiz
        </button>
        <button type="button" className="qt-result__btn qt-result__btn--ghost" onClick={onBack}>
          <IonIcon icon={homeOutline} className="qt-result__btn-icon" aria-hidden />
          Go back
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   QUIZ SCREEN  (gameplay wrapper)
   ═══════════════════════════════════════════════════════════ */
interface QuizScreenProps {
  questions: TestQuestion[];
  dialectName: string;
  accentColor: string;
  onFinish: (score: number) => void;
  onBack: () => void;
}

const QuizScreen: React.FC<QuizScreenProps> = ({ questions, dialectName, accentColor, onFinish, onBack }) => {
  const [current, setCurrent] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [lives, setLives] = useState(3);
  const [startTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [finished, startTime]);

  const q = questions[current];
  const total = questions.length;
  const progress = (current / total) * 100;

  const handleAnswer = useCallback((wasCorrect: boolean) => {
    setAnswered(true);
    if (wasCorrect) setCorrect(c => c + 1);
    else setLives(l => Math.max(0, l - 1));
  }, []);

  const handleNext = () => {
    if (current + 1 >= total) {
      const finalScore = Math.round((correct / total) * 100);
      setFinished(true);
      onFinish(finalScore);
    } else {
      setCurrent(c => c + 1);
      setAnswered(false);
    }
  };

  const handleRetry = () => {
    setCurrent(0); setCorrect(0); setAnswered(false);
    setFinished(false); setLives(3); setRetryKey(k => k + 1);
  };

  const getTypeLabel = (): string => {
    if (!q) return '';
    if (q.type === 'translate_word')  return 'What is the translation?';
    if (q.type === 'multiple_choice') return 'Choose the correct answer';
    if (q.type === 'match_pairs')     return 'Tap the matching pairs';
    if (q.type === 'fill_blank')      return 'Fill in the blank';
    return '';
  };

  if (finished) {
    const finalScore = Math.round((correct / total) * 100);
    return (
      <ResultScreen
        dialectName={dialectName}
        correct={correct}
        total={total}
        accentColor={accentColor}
        xpEarned={correct * 8}
        timeSeconds={elapsedSeconds}
        onBack={onBack}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="qt-screen">
      {/* Top bar */}
      <div className="qt-screen__topbar">
        <button className="qt-screen__close" onClick={onBack} aria-label="Close">
          <IonIcon icon={closeOutline} />
        </button>
        <div className="qt-screen__progress-track">
          <div className="qt-screen__progress-fill" style={{ width: `${progress}%`, background: accentColor }} />
        </div>
        <div className="qt-screen__meta-right">
          <span className="qt-screen__counter">{current + 1}/{total}</span>
          <div className="qt-screen__hearts">
            {Array.from({ length: 3 }).map((_, i) => (
              <IonIcon
                key={i}
                icon={i < lives ? heart : heartOutline}
                style={{ color: i < lives ? '#ef4444' : '#d1d5db', fontSize: 20 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="qt-screen__body">
        <h2 className="qt-screen__type-label">{getTypeLabel()}</h2>

        <div key={`${current}-${retryKey}`} className="qt-screen__question-wrap">
          {q.type === 'translate_word' && (
            <TranslateWordView q={q as TranslateWordQ} accentColor={accentColor} onAnswer={handleAnswer} />
          )}
          {q.type === 'multiple_choice' && (
            <MultipleChoiceView q={q as MultipleChoiceQ} accentColor={accentColor} onAnswer={handleAnswer} />
          )}
          {q.type === 'match_pairs' && (
            <MatchPairsView q={q as MatchPairsQ} accentColor={accentColor} onAnswer={handleAnswer} />
          )}
          {q.type === 'fill_blank' && (
            <FillBlankView q={q as FillBlankQ} accentColor={accentColor} onAnswer={handleAnswer} />
          )}
        </div>
      </div>

      {/* Continue footer */}
      {answered && (
        <div className="qt-screen__footer">
          <button
            className="qt-screen__next"
            style={{ background: accentColor }}
            onClick={handleNext}
          >
            {current + 1 >= total ? 'See Results' : 'CONTINUE'}
          </button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   LOADING STATE
   ═══════════════════════════════════════════════════════════ */
const GeneratingLoader: React.FC<{ accentColor: string; dialectName: string }> = ({ accentColor, dialectName }) => (
  <div className="qz-generating">
    <div className="qz-generating__sparkle" style={{ color: accentColor }}>
      <IonIcon icon={sparklesOutline} />
    </div>
    <h3 className="qz-generating__title">Building your quiz…</h3>
    <p className="qz-generating__sub">
      The AI is reviewing your {dialectName} translation history and creating questions just for you.
    </p>
    <div className="qz-generating__dots">
      <span style={{ background: accentColor }} />
      <span style={{ background: accentColor }} />
      <span style={{ background: accentColor }} />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   QUIZ LANDING — shown before starting the quiz
   Displays the user's active dialect and their history stats
   ═══════════════════════════════════════════════════════════ */
interface QuizLandingProps {
  dialect: { id: string; name: string; native: string; accentColor: string; gradient: string };
  historyCount: number;
  progress: QuizProgress;
  onStart: () => void;
  generating: boolean;
  error: string | null;
  onGoToChat: () => void;
}

const QuizLanding: React.FC<QuizLandingProps> = ({
  dialect, historyCount, progress, onStart, generating, error, onGoToChat,
}) => {
  const hasEnoughHistory = historyCount >= 3;
  const accentColor = dialect.accentColor;

  return (
    <div className="qz-landing">
      {/* Dialect hero card */}
      <div className="qz-dialect-hero" style={{ background: dialect.gradient }}>
        <div className="qz-dialect-hero__badge">
          <IonIcon icon={checkmarkCircle} style={{ fontSize: 14, color: '#fff' }} />
          <span>Active Dialect</span>
        </div>
        <div className="qz-dialect-hero__name">{dialect.name}</div>
        <div className="qz-dialect-hero__native">{dialect.native}</div>
        <div className="qz-dialect-hero__ring">
          {dialect.name.charAt(0)}
        </div>
      </div>

      {/* Stats row */}
      <div className="qz-stats-row">
        <div className="qz-stat-card">
          <span className="qz-stat-card__icon">📚</span>
          <span className="qz-stat-card__val">{historyCount}</span>
          <span className="qz-stat-card__lbl">Words Looked Up</span>
        </div>
        <div className="qz-stat-card">
          <span className="qz-stat-card__icon">🏆</span>
          <span className="qz-stat-card__val">{progress.bestScore > 0 ? `${progress.bestScore}%` : '—'}</span>
          <span className="qz-stat-card__lbl">Best Score</span>
        </div>
        <div className="qz-stat-card">
          <span className="qz-stat-card__icon">🔄</span>
          <span className="qz-stat-card__val">{progress.totalTaken}</span>
          <span className="qz-stat-card__lbl">Quizzes Taken</span>
        </div>
      </div>

      {/* Last quiz info */}
      {progress.lastDate > 0 && (
        <div className="qz-last-quiz">
          <IonIcon icon={timeOutline} style={{ fontSize: 15, color: '#6b7280' }} />
          <span>Last quiz: {formatDate(progress.lastDate)} · {progress.lastScore}%</span>
        </div>
      )}

      {/* How it works */}
      <div className="qz-how-it-works">
        <div className="qz-how-it-works__title">
          <IonIcon icon={sparklesOutline} style={{ color: accentColor }} />
          How your quiz works
        </div>
        <div className="qz-how-it-works__steps">
          <div className="qz-step">
            <div className="qz-step__num" style={{ background: accentColor }}>1</div>
            <p className="qz-step__text">The AI reviews the words and phrases you've translated in the chat</p>
          </div>
          <div className="qz-step">
            <div className="qz-step__num" style={{ background: accentColor }}>2</div>
            <p className="qz-step__text">It builds a personalized quiz based only on <em>your</em> lookups</p>
          </div>
          <div className="qz-step">
            <div className="qz-step__num" style={{ background: accentColor }}>3</div>
            <p className="qz-step__text">Practice recall through matching, multiple choice, and fill-in-the-blank</p>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="qz-error">
          <IonIcon icon={alertCircleOutline} />
          <span>{error}</span>
        </div>
      )}

      {/* Not enough history warning */}
      {!hasEnoughHistory && !generating && (
        <div className="qz-no-history">
          <p className="qz-no-history__msg">
            You need at least <strong>3 translation lookups</strong> in {dialect.name} to generate a quiz.
          </p>
          <button className="qz-no-history__cta" style={{ background: accentColor }} onClick={onGoToChat}>
            <IonIcon icon={chatbubbleOutline} />
            Go to Chat & Translate
          </button>
        </div>
      )}

      {/* Start button */}
      {hasEnoughHistory && (
        <button
          className="qz-start-btn"
          style={{ background: generating ? '#9ca3af' : accentColor }}
          onClick={onStart}
          disabled={generating}
        >
          {generating
            ? <><IonIcon icon={refreshOutline} className="qz-start-btn__spin" /> Generating…</>
            : <><IonIcon icon={sparklesOutline} /> Start AI Quiz</>
          }
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   NO DIALECT SCREEN — user hasn't chosen a dialect yet
   ═══════════════════════════════════════════════════════════ */
const NoDialectScreen: React.FC = () => (
  <div className="qz-no-dialect">
    <div className="qz-no-dialect__icon">🗺️</div>
    <h2 className="qz-no-dialect__title">No dialect selected</h2>
    <p className="qz-no-dialect__sub">
      Go to the <strong>Home</strong> page and choose your dialect from the language selector to get started.
    </p>
    <Link to="/home" className="qz-no-dialect__btn">
      Go to Home
    </Link>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   MAIN QUIZ PAGE
   ═══════════════════════════════════════════════════════════ */
type PageState = 'landing' | 'generating' | 'quiz' | 'error';

const QuizPage: React.FC = () => {
  const location = useLocation();
  const routerHistory = useHistory();
  const isQuiz = location.pathname === '/quiz';
  const quizContentRef = useIonContentScrollTopOnEnter();

  const [pageState, setPageState] = useState<PageState>('landing');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dialect = loadActiveDialect();
  const translationHistory = loadTranslationHistory();
  const dialectHistory = dialect ? translationHistory.filter(e => e.dialect === dialect.id) : [];
  const [progress, setProgress] = useState<QuizProgress>(
    dialect ? loadQuizProgress(dialect.id) : { totalTaken: 0, bestScore: 0, lastScore: 0, lastDate: 0 }
  );

  const handleStart = async () => {
    if (!dialect) return;
    setError(null);
    setPageState('generating');
    try {
      const qs = await generateQuizFromHistory(translationHistory, dialect.id, dialect.native);
      if (!qs || qs.length === 0) throw new Error('No questions could be generated from your history.');
      setQuestions(qs);
      setPageState('quiz');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate quiz. Please try again.';
      setError(msg);
      setPageState('landing');
    }
  };

  const handleFinish = (score: number) => {
    if (!dialect) return;
    saveQuizProgress(dialect.id, score);
    saveQuizAttempt(dialect.id, score, questions.length);
    setProgress(loadQuizProgress(dialect.id));
  };

  const handleBack = () => {
    setPageState('landing');
    setQuestions([]);
  };

  // Quiz is active — render the quiz screen full-page
  if (pageState === 'quiz' && dialect) {
    return (
      <IonPage>
        <IonContent fullscreen className="quiz-content" ref={quizContentRef}>
          <QuizScreen
            questions={questions}
            dialectName={dialect.name}
            accentColor={dialect.accentColor}
            onFinish={handleFinish}
            onBack={handleBack}
          />
        </IonContent>
      </IonPage>
    );
  }

  // Generating — show loader
  if (pageState === 'generating' && dialect) {
    return (
      <IonPage>
        <IonContent fullscreen className="quiz-content" ref={quizContentRef}>
          <div className="quiz-page">
            <GeneratingLoader accentColor={dialect.accentColor} dialectName={dialect.name} />
          </div>
          <footer className="quiz-footer">
            <BottomNav isQuiz={isQuiz} />
          </footer>
        </IonContent>
      </IonPage>
    );
  }

  // Main landing
  return (
    <IonPage>
      <IonContent fullscreen className="quiz-content" ref={quizContentRef}>
        <div className="quiz-page">
          <header className="quiz-header">
            {/* Layer 0 — gradient background */}
            <div className="hero-banner"></div>

            {/* Layer 2 — wavy bottom edge */}
            <svg className="hero-wave" viewBox="0 0 430 40" preserveAspectRatio="none">
              <path d="M0,20 C80,40 180,0 280,20 C350,35 400,10 430,18 L430,40 L0,40 Z" fill="#f8f9fa"/>
            </svg>

            {/* Layer 3 — top-left brand strip: icon + page title */}
            <div className="quiz-header__brand">
              <span className="quiz-header__brand-icon" aria-hidden>🧠</span>
              <h1 className="quiz-header__brand-title">Quiz Time!</h1>
            </div>

            {/* Layer 3 — greeting block: main heading + subtitle */}
            <div className="quiz-header__greeting">
              <p className="quiz-header__sub">Review words you've learned from your AI chat sessions</p>
            </div>
          </header>

          {!dialect
            ? <NoDialectScreen />
            : <>
                <QuizLanding
                  dialect={dialect}
                  historyCount={dialectHistory.length}
                  progress={progress}
                  onStart={handleStart}
                  generating={pageState === 'generating'}
                  error={error}
                  onGoToChat={() => routerHistory.push('/chat')}
                />
                <QuizHistorySection
                  dialectId={dialect.id}
                  accentColor={dialect.accentColor}
                  onRetakeQuiz={() => handleStart()}
                />
              </>
          }

          <div className="quiz-spacer" aria-hidden />
        </div>

        <footer className="quiz-footer">
          <BottomNav isQuiz={isQuiz} />
        </footer>
      </IonContent>
    </IonPage>
  );
};

/* ═══════════════════════════════════════════════════════════
   QUIZ HISTORY SECTION
   ═══════════════════════════════════════════════════════════ */
function formatAttemptDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface QuizHistorySectionProps {
  dialectId: string;
  accentColor: string;
  onRetakeQuiz: () => void;
}

const QuizHistorySection: React.FC<QuizHistorySectionProps> = ({ dialectId, accentColor, onRetakeQuiz }) => {
  const [attempts, setAttempts] = React.useState<QuizAttempt[]>(() => loadQuizAttempts(dialectId));
  
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all quiz history for this dialect? This action cannot be undone.')) {
      clearQuizAttempts(dialectId);
      setAttempts([]);
    }
  };
  
  if (attempts.length === 0) return null;

  return (
    <section className="qz-history">
      <div className="qz-history__header">
        <h3 className="qz-history__title">📊 Your Quiz History</h3>
        <button
          className="qz-history__clear-btn"
          onClick={handleClearHistory}
          style={{ color: accentColor }}
          aria-label="Clear quiz history"
        >
          Clear All
        </button>
      </div>
      <div className="qz-history__list">
        {attempts.slice(0, 5).map((attempt) => {
          const isPassed = attempt.score >= 70;
          return (
            <div key={attempt.quizId} className="qz-history__item">
              <div className="qz-history__item-left">
                <div className={`qz-history__badge ${isPassed ? 'qz-history__badge--pass' : 'qz-history__badge--fail'}`}>
                  {attempt.score}%
                </div>
                <div className="qz-history__item-info">
                  <span className="qz-history__item-date">{formatAttemptDate(attempt.timestamp)}</span>
                  <span className="qz-history__item-questions">{attempt.questionCount} questions</span>
                </div>
              </div>
              <button
                className="qz-history__retake-btn"
                style={{ borderColor: accentColor, color: accentColor }}
                onClick={onRetakeQuiz}
                aria-label="Retake this quiz"
              >
                Retake
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════
   BOTTOM NAV
   ═══════════════════════════════════════════════════════════ */
const BottomNav: React.FC<{ isQuiz: boolean }> = ({ isQuiz }) => (
  <nav className="quiz-nav" aria-label="Main">
    <Link to="/learn" className="quiz-nav__item">
      <IonIcon icon={bookOutline} className="quiz-nav__icon" />
      <span className="quiz-nav__label">Learn</span>
    </Link>
    <Link to="/quiz" className={`quiz-nav__item ${isQuiz ? 'quiz-nav__item--active' : ''}`}>
      <IonIcon icon={documentTextOutline} className="quiz-nav__icon" />
      <span className="quiz-nav__label">Quiz</span>
    </Link>
    <Link to="/home" className="quiz-nav__item">
      <IonIcon icon={homeOutline} className="quiz-nav__icon" />
      <span className="quiz-nav__label">Home</span>
    </Link>
    <Link to="/chat" className="quiz-nav__item">
      <IonIcon icon={chatbubbleOutline} className="quiz-nav__icon" />
      <span className="quiz-nav__label">Chat</span>
    </Link>
    <Link to="/profile" className="quiz-nav__item">
      <IonIcon icon={personOutline} className="quiz-nav__icon" />
      <span className="quiz-nav__label">Profile</span>
    </Link>
  </nav>
);

export default QuizPage;