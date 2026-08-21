/**
 * SalinTayo Profanity Filter
 *
 * Lightweight profanity filter designed for:
 * - English
 * - Filipino / Tagalog
 * - Cebuano / Bisaya
 * - Hiligaynon / Ilonggo
 * - Ilocano
 * - Pangasinan
 * - Waray-Waray
 * - Bicolano
 * - Kapampangan
 * - Tausug
 *
 * Supports:
 * - Case-insensitive matching
 * - Basic leetspeak
 * - Repeated letters (fuuuck, shiiiit)
 * - Punctuation around words (fuck!, f@ck?, StuP!d?)
 * - Whole-word matching to reduce false positives
 * - Multi-word profanity phrases
 *
 * Examples:
 *   fuck      -> f**k
 *   fck       -> f*k
 *   f@ck      -> f**k
 *   f4ck      -> f**k
 *   f!ck      -> f**k
 *   fuuuck    -> f****k
 *   StuP!d?   -> S***d?
 */

const PROFANITY_WORDS = [
  // =========================================================
  // ENGLISH
  // =========================================================
  'fuck',
  'fack',
  'fuk',
  'fck',
  'fuq',
  'fukk',
  'fucked',
  'fucker',
  'fucking',
  'motherfucker',
  'motherfuck',

  'shit',
  'shitty',
  'bullshit',

  'bitch',
  'bastard',

  'asshole',
  'ass',

  'dick',
  'pussy',
  'cunt',
  'cock',

  'whore',
  'slut',

  'piss',
  'bollocks',

  'nigger',
  'nigga',

  'fag',
  'faggot',

  'retard',

  'douche',
  'douchebag',
  'twat',

  'damn',
  'goddamn',
  'hell',
  'crap',

  // Insults / offensive language
  'stupid',
  'idiot',
  'idiotic',
  'moron',
  'dumb',
  'dumbass',

  // Common disguised forms
  'phuck',
  'phuk',

  // =========================================================
  // FILIPINO / TAGALOG
  // =========================================================
  'putangina',
  'putang',
  'putang ina',
  'pukinangina',
  'pukingina',

  'puta',
  'pota',

  'gago',
  'gaga',

  'tanga',
  'bobo',
  'ulol',

  'lintik',
  'leche',

  'pakyu',

  'bwisit',
  'buwisit',

  'hayop',
  'hayop ka',

  'tarantado',
  'tarantada',

  'hinayupak',
  'inutil',

  // =========================================================
  // CEBUANO / BISAYA
  // =========================================================
  'yawa',
  'yawaa',

  'yati',
  'yatig',

  'pisti',
  'piste',
  'pisting',
  'pisteng',

  'giatay',
  'inatay',
  'atay',

  'buang',
  'boang',

  'bogo',
  'bogoa',

  'amaw',
  'hanggaw',
  'ahak',

  'gi ahak',

  'kayata',

  'kwanggol',
  'pahong',

  'bweset',
  'bwisit',

  'pakno',

  'puta',
  'putangina',
  'putang',

  'bilat',
  'iyot',
  'oten',
  'otin',

  // =========================================================
  // HILIGAYNON / ILONGGO
  // =========================================================
  'putangina',
  'puta',

  'gago',
  'gaga',

  'bogo',
  'buang',

  'ulol',
  'tonto',
  'tinonto',

  'yawa',

  'bwisit',
  'buwisit',

  'leche',
  'pisti',

  'animal',
  'hayop',

  'bilat',
  'iyot',

  // =========================================================
  // ILOCANO
  // =========================================================
  'ukininam',
  'ukinam',
  'pukinangina',
  'puki',
  'puking',

  'puta',
  'putangina',

  'gago',
  'gaga',

  'tanga',
  'ulol',

  'bogo',
  'buang',
  'inutil',

  'leche',
  'bwisit',
  'hayop',

  // =========================================================
  // PANGASINAN
  // =========================================================
  // Keep this section conservative.
  // Add locally verified Pangasinan terms later.
  'puta',
  'putangina',
  'gago',
  'gaga',
  'tanga',
  'bobo',
  'ulol',
  'inutil',
  'animal',
  'hayop',
  'leche',
  'bwisit',

  // =========================================================
  // WARAY-WARAY
  // =========================================================
  'yawa',
  'pisti',
  'peste',
  'buang',
  'boang',

  'gago',
  'gaga',

  'tanga',
  'bogo',
  'ulol',

  'hayop',
  'animal',

  'puta',
  'putangina',

  'bwisit',
  'lintik',

  // =========================================================
  // BIKOL / BICOLANO
  // =========================================================
  'masimot',
  'simton',
  'masinggan',
  'masiggan',

  'kado',
  'kaduan',
  'ado',

  'boto',
  'buday',
  'burat',

  'uyam',
  'surang',
  'mauyam',

  'etoks',
  'lilintian',
  'parakpatakan',

  // =========================================================
  // KAPAMPANGAN
  // =========================================================
  'bolang',
  'kabolangan',

  'murit',
  'muret',
  'moret',

  'bugok',

  'takneydamo',
  'taneydamo',
  'takneydo',
  'neydumo',

  'karat',
  'kantut',
  'butu',

  'alti',
  'taksiapu',

  // =========================================================
  // TAUSUG
  // =========================================================
  'miyatay',
];

/**
 * Basic leetspeak normalization.
 *
 * Examples:
 *   f@ck  -> fack
 *   f4ck  -> fack
 *   st!pid -> stipid
 *   sh1t -> shit
 */
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',

  '@': 'a',
  '$': 's',
  '!': 'i',
};

/**
 * Convert a token into a simplified form for matching.
 *
 * Punctuation is removed for matching purposes.
 */
function normalizeForMatch(token: string): string {
  return token
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

/**
 * Collapse repeated letters.
 *
 * Examples:
 *   fuuuck  -> fuk
 *   shiiiit -> shit
 *   stoopid -> stopid
 */
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/g, '$1');
}

/**
 * Check whether a normalized token is profane.
 */
function isProfaneToken(normalized: string): boolean {
  if (!normalized || normalized.length < 3) {
    return false;
  }

  const collapsed = collapseRepeats(normalized);

  return (
    PROFANITY_WORDS.includes(normalized) ||
    PROFANITY_WORDS.includes(collapsed)
  );
}

/**
 * Masks letters while preserving punctuation.
 *
 * Examples:
 *   fuck!   -> f**k!
 *   fck     -> f*k
 *   f@ck    -> f**k
 *   stupid? -> s****d?
 *
 * First and last alphabetic characters stay visible.
 */
function maskToken(token: string): string {
  const letterIndices: number[] = [];

  for (let i = 0; i < token.length; i++) {
    if (/[a-zA-Z]/.test(token[i])) {
      letterIndices.push(i);
    }
  }

  if (letterIndices.length === 0) {
    return token;
  }

  // One or two letters: mask the letters completely.
  if (letterIndices.length <= 2) {
    return token
      .split('')
      .map((ch, i) =>
        letterIndices.includes(i) ? '*' : ch
      )
      .join('');
  }

  const first = letterIndices[0];
  const last = letterIndices[letterIndices.length - 1];

  return token
    .split('')
    .map((ch, i) => {
      if (i === first || i === last) {
        return ch;
      }

      return letterIndices.includes(i) ? '*' : ch;
    })
    .join('');
}

/**
 * Escape text before using it inside a RegExp.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply profanity masking to multi-word phrases.
 *
 * Example:
 *   "putang ina" -> "p***g i**"
 */
function censorProfanityPhrases(text: string): string {
  let result = text;

  const phrases = PROFANITY_WORDS
    .filter((word) => word.includes(' '))
    .sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const escaped = escapeRegExp(phrase);

    const regex = new RegExp(
      `(^|\\s)(${escaped})(?=\\s|$)`,
      'gi'
    );

    result = result.replace(
      regex,
      (_, prefix: string, matched: string) => {
        return prefix + maskToken(matched);
      }
    );
  }

  return result;
}

/**
 * Returns true if the text contains profanity.
 */
export function containsProfanity(text: string): boolean {
  if (!text) {
    return false;
  }

  // Check multi-word profanity phrases first.
  const phraseResult = censorProfanityPhrases(text);

  if (phraseResult !== text) {
    return true;
  }

  // Check individual tokens.
  return text.split(/\s+/).some((part) => {
    if (!part) {
      return false;
    }

    return isProfaneToken(normalizeForMatch(part));
  });
}

/**
 * Returns the text with profanity masked.
 *
 * Examples:
 *   "fuck men"      -> "f**k men"
 *   "fck you"       -> "f*k you"
 *   "f@ck you"      -> "f**k you"
 *   "f4ck you"      -> "f**k you"
 *   "StuP!d?"       -> "S***d?"
 *   "yawa ka"       -> "y**a ka"
 */
export function censorProfanity(text: string): string {
  if (!text) {
    return text;
  }

  // Handle multi-word phrases first.
  let result = censorProfanityPhrases(text);

  // Then handle individual words while preserving whitespace exactly.
  result = result
    .split(/(\s+)/)
    .map((part) => {
      if (part === '' || /^\s+$/.test(part)) {
        return part;
      }

      const normalized = normalizeForMatch(part);

      return isProfaneToken(normalized)
        ? maskToken(part)
        : part;
    })
    .join('');

  return result;
}