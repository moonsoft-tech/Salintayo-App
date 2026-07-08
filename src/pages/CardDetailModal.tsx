import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { LANGUAGES, type Language } from './LanguageModal';
import './CardDetailModal.css';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
export interface DialectFact {
  value: string;
  label: string;
}

export interface DialectExpression {
  phrase: string;
  literal: string;
  meaning: string;
}

export interface DialectDish {
  name: string;
  desc: string;
}

export interface DialectProverb {
  text: string;
  translation: string;
}

export interface DialectContent {
  languageFamily?: string;
  history?: string;
  geographicDist?: string;
  interestingFact?: string;
  wordOrder?: string;
  wordOrderExample?: { sentence: string; breakdown: string };
  pronunciationNotes?: string[];
  expressions?: DialectExpression[];
  traditions?: { name: string; desc: string }[];
  dishes?: DialectDish[];
  arts?: string[];
  values?: { name: string; desc: string }[];
  identityTitle?: string;
  coreTraits?: string[];
  historicalRoots?: string;
  modernInfluence?: string;
  proverbs?: DialectProverb[];
}

export interface CulturalCard {
  id: string;
  image: string;
  tag: string;
  tagColor: string;
  title: string;
  nativeName: string;
  region: string;
  speakers: string;
  desc: string;
  highlights: string[];
  facts: DialectFact[];
  dialectCode: string;
  content?: DialectContent;
}

export interface CardDetailModalProps {
  card: CulturalCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectDialect: (lang: Language) => void;
  currentLanguageCode: string;
}

/* ─────────────────────────────────────────────
   All dialect rich content — add other dialects
   here as their content packs are ready.
───────────────────────────────────────────── */
const DIALECT_CONTENT: Record<string, DialectContent> = {

  /* ── CEBUANO ── */
  ceb: {
    languageFamily:
      'Austronesian › Malayo-Polynesian › Philippine › Greater Central Philippine › Central Philippine › Cebuano',

    history:
      'Cebuano traces its roots to the pre-colonial Sugbo (the old name for Cebu), a thriving trading center. The language spread across the Visayas and Mindanao through migration, trade, and later Spanish colonization. Unlike Tagalog, which became the basis for Filipino, Cebuano retained a strong regional identity. It has a rich literary tradition that includes the balitaw — a lyrical debate in song — and thriving modern poetry.',

    geographicDist:
      'Native to Cebu, Bohol, Siquijor, Negros Oriental, and parts of Leyte and Samar. Through internal migration it became a lingua franca across much of Mindanao, particularly in Davao Region, Cotabato, and Zamboanga del Sur. Cebu City and Davao City are predominantly Cebuano-speaking, with overseas communities in the US and the Middle East.',

    interestingFact:
      'Cebuano is the only Philippine language where the inclusive "we" (kita) and exclusive "we" (kami) distinction is consistently maintained in daily speech — a feature rooted in its Austronesian heritage. It also has three grammatical number markers: singular, dual (kita as "we two"), and plural.',

    wordOrder: 'Typically Verb–Subject–Object (VSO), though it can shift to VOS for emphasis.',

    wordOrderExample: {
      sentence: 'Nagkaon ang bata og saging.',
      breakdown: 'Verb nagkaon (ate) + Subject ang bata (the child) + Object og saging (a banana)',
    },

    pronunciationNotes: [
      'Vowels: three core sounds (/a/, /i/, /u/); <e> and <o> appear in loanwords. Bohol speakers use a distinct [ɛ] and [ɔ].',
      'Glottal stop (often omitted in writing) changes meaning: bába (chin) vs. babâ (to go down).',
      'Stress is phonemic: dágan (run) vs. dagán (weight).',
    ],

    expressions: [
      {
        phrase: 'Mao ba?',
        literal: 'Is that so?',
        meaning: 'Expresses surprise, curiosity, or polite acknowledgment. Tone signals whether it is genuine or skeptical.',
      },
      {
        phrase: 'Hala!',
        literal: '(No direct translation)',
        meaning: 'Exclamation of alarm, excitement, or mild warning — "Oh no!" or "Watch out!"',
      },
      {
        phrase: 'Bitaw.',
        literal: "Really / That's true",
        meaning: 'Used to agree, confirm, or emphasize a point. Softer than an outright "yes."',
      },
      {
        phrase: 'Giatay!',
        literal: 'Epidemic',
        meaning: 'Versatile expression of frustration or surprise. Mild profanity among close friends — similar to "darn!" or "shoot!"',
      },
      {
        phrase: 'Sus!',
        literal: 'Short for Hesus (Jesus)',
        meaning: 'Exclamation of annoyance, disappointment, or resignation. Think "ugh" or "oof."',
      },
      {
        phrase: 'Ambot.',
        literal: "I don't know",
        meaning: 'Often said with a shrug; expresses helplessness or gentle exasperation — "I give up on you."',
      },
      {
        phrase: 'Basta',
        literal: 'As long as / No matter what',
        meaning: 'Signals determination or a non-negotiable condition. "Basta Cebuano, bisag asa maayo."',
      },
      {
        phrase: 'Lagi',
        literal: "Yes, that's right",
        meaning: 'Soft acknowledgment or agreement — similar to "yeah" or "right."',
      },
    ],

    traditions: [
      {
        name: 'Sinulog Festival',
        desc: 'Held every third Sunday of January in Cebu City, it honors the Santo Niño (Child Jesus). The signature dance — two steps forward, one step back — symbolizes the river current (sulog). It is the largest festival in the Philippines.',
      },
      {
        name: 'Pamamanhikan',
        desc: "A formal meeting where the man's family visits the woman's family to ask for her hand in marriage. Still widely practiced as a mark of respect.",
      },
      {
        name: 'Bisita Iglesia',
        desc: 'During Holy Week, families visit seven or more churches to pray the Stations of the Cross. In Cebu, many include the Basilica del Santo Niño.',
      },
      {
        name: 'Barangay Fiestas',
        desc: 'Every barangay celebrates its patron saint with mass (misa), procession (prosisyon), community gathering (tambay), and a communal feast (handaan).',
      },
    ],

    dishes: [
      {
        name: 'Lechon Cebu',
        desc: 'Whole roasted pig with crispy skin, seasoned with lemongrass, garlic, and spices. Widely considered the best lechon in the Philippines.',
      },
      {
        name: 'Ginabot',
        desc: 'Deep-fried pork intestines served with a spicy vinegar dip. A popular pulutan (drinking snack).',
      },
      {
        name: 'Sutukil',
        desc: 'Fresh seafood cooked three ways: grilled (sugba), stewed (tuwa), or raw in vinegar (kilaw).',
      },
      {
        name: 'Puso',
        desc: 'Hanging rice wrapped in woven coconut leaves — the iconic accompaniment to grilled meats.',
      },
      {
        name: 'Torta',
        desc: 'A dense, soft cake from Argao made with tuba (coconut wine) and local cheese.',
      },
      {
        name: 'Bod-bod',
        desc: 'Sticky rice cake wrapped in banana leaves, often paired with ripe mango or chocolate.',
      },
    ],

    arts: [
      'Balitaw — a traditional poetic debate in song, often with guitar, used for courtship and social commentary.',
      'Classic folk songs: "Matud Nila," "Usahay," and "Rosas Pandan" — beloved for nostalgia and romance.',
      'Contemporary poets include Ernestina "Inday" Abella, Adonis Durado, and Merlie Alunan. The Bathalad organization promotes Cebuano literature.',
      'Visual arts: painter Martino Abellana; the "Dalan sa Kabilin" (Path of Heritage) cultural trail in Cebu City.',
      'Guitar-making: towns near Maribojoc are renowned for handcrafted guitars from native wood.',
    ],

    values: [
      {
        name: 'Respect for Elders',
        desc: "Using Manong (older brother/uncle) and Manang (older sister/aunt) even for strangers signals politeness. The pagmamano gesture — taking an elder's hand to the forehead — is still practiced.",
      },
      {
        name: 'Pragmatism (Diskarte)',
        desc: 'Cebuanos are often described as business-minded, straightforward, and solution-oriented. They prize diskarte (resourcefulness) and tiyaga (perseverance).',
      },
      {
        name: 'Close Family Ties',
        desc: 'Extended families often live near each other. Utang na loob (debt of gratitude) binds relatives and friends in a network of mutual support.',
      },
      {
        name: 'Magtinabangay',
        desc: 'While "bahala na" (come what may) is a Filipino trait, Cebuanos add "magtinabangay" — let\'s help each other — emphasizing collective responsibility.',
      },
      {
        name: 'Religious Devotion',
        desc: 'The Santo Niño is central to Cebuano faith. Many homes have a statue, and weekly novenas are common throughout the year.',
      },
    ],

    identityTitle: 'Ang Sugbuanon — The Cebuano People',

    coreTraits: [
      "Resilient and Hardworking — rooted in Cebu's history as a trading port and modern economic hub.",
      'Pragmatic and Direct — clarity is valued; plain speech is a sign of respect, not rudeness.',
      'Devout yet Festive — faith is deep, but celebrations are lively and inclusive.',
      'Proud of their Language — speaking Cebuano is a marker of identity even among migrants and diaspora.',
    ],

    historicalRoots:
      'Pre-colonial Cebu (Sugbo) was a prosperous settlement under Rajah Humabon. The Spanish arrived in 1521 and brought Christianity, but Cebuanos resisted through leaders like Lapu-Lapu. The province later became a center of Philippine nationalism.',

    modernInfluence:
      'Cebu is the second-largest metropolitan area in the Philippines and a major industrial and business hub. Cebuano culture shapes national media, regional broadcasting, and politics. Cebuanos are active in overseas labor, entrepreneurship, and the arts.',

    proverbs: [
      {
        text: 'Ang dili molingi sa gigikanan, dili makaabot sa padulngan.',
        translation: 'He who does not look back at where he came from will never reach his destination.',
      },
      {
        text: 'Bisan unsa ka taas sa imong paglupad, naa gyud kay pahulayanan.',
        translation: 'No matter how high you fly, you will always have a place to rest.',
      },
      {
        text: 'Sa kalisod, makita ang higala.',
        translation: 'In difficulty, a true friend is revealed.',
      },
      {
        text: 'Basta magtinabangay, walay lisod.',
        translation: 'As long as we help each other, nothing is too difficult.',
      },
    ],
  },

  /* ── HILIGAYNON (hil) ── */
  hil: {
    languageFamily:
      'Austronesian › Malayo-Polynesian › Philippine › Greater Central Philippine › Central Philippine › Visayan › Hiligaynon',

    history:
      'Hiligaynon originated in the lowlands of Iloilo and Panay Island. It became the lingua franca of Western Visayas due to the influence of the port of Iloilo, a major commercial hub during the Spanish and American colonial periods. The language spread to Negros Occidental with the sugar industry. Hiligaynon has a rich literary tradition including the balak (poetry), paktakon (riddles), and hurobaton (proverbs).',

    geographicDist:
      'Dominant in Iloilo, Guimaras, Negros Occidental, Capiz, Antique, and parts of Aklan. In Mindanao it is widely spoken in the Soccsksargen region (South Cotabato, Sultan Kudarat, North Cotabato). Significant communities also exist in Metro Manila, California, and Hawaii.',

    interestingFact:
      'Hiligaynon distinguishes three levels of "this/that" based on distance and visibility: ini (very near the speaker), ina (near the listener), and to (far from both). It also uses the particle balá to soften statements or express polite uncertainty.',

    wordOrder: 'Verb–Subject–Object (VSO) as the basic order; VOS is common in spoken contexts for emphasis.',

    wordOrderExample: {
      sentence: 'Nagkaon ang bata sang saging.',
      breakdown: 'Verb nagkaon (ate) + Subject ang bata (the child) + Object sang saging (banana)',
    },

    pronunciationNotes: [
      'Vowels: three native sounds /a/, /i/, /u/ — /e/ and /o/ used in loanwords and some native words.',
      'The language has a soft, melodic "sing-song" rhythm compared to the harder sounds of Cebuano.',
      'Stress is phonemic: ága (morning) vs. agá (early). Misplacing stress can change meaning.',
      'The /r/ is slightly rolled; the glottal stop /ʔ/ distinguishes meaning in some word pairs.',
    ],

    expressions: [
      {
        phrase: 'Kamusta ka?',
        literal: 'How are you? (from Spanish cómo está)',
        meaning: 'Standard greeting. Often answered with Manaug (I\'m fine) or Amo lang (Just the same).',
      },
      {
        phrase: 'Amo na?',
        literal: 'Is that so?',
        meaning: 'Expresses understanding, surprise, or confirmation — very common in daily conversation.',
      },
      {
        phrase: 'Kabay pa.',
        literal: 'If only / I wish',
        meaning: 'Expresses a heartfelt wish or hope for something, often something unlikely.',
      },
      {
        phrase: 'Gid',
        literal: 'Really / Very (enclitic)',
        meaning: 'Adds strong emphasis — similar to jud in Cebuano. "Nami gid!" (Very nice!)',
      },
      {
        phrase: 'Daw',
        literal: 'Like / Seems',
        meaning: 'Softens statements or expresses approximation. "Daw kapoy siya." (He seems tired.)',
      },
      {
        phrase: 'Lain gid.',
        literal: 'Different / Strange indeed',
        meaning: 'Marks something unusual, interesting, or problematic. Can be said with admiration or concern.',
      },
      {
        phrase: 'Mayu-mayu lang.',
        literal: 'Just fine / Just okay',
        meaning: 'A modest, humble response to "How are you?" — humility is a core Ilonggo value.',
      },
      {
        phrase: 'Abi ko.',
        literal: 'I thought',
        meaning: 'Used to correct a mistaken assumption. "Abi ko nakaon ka na." (I thought you had already eaten.)',
      },
    ],

    traditions: [
      {
        name: 'MassKara Festival',
        desc: 'Held in Bacolod City every October. Features smiling masks (from "mass" + "cara"), street dancing, and a celebration of resilience. It began in the 1980s after a sugar crisis, symbolizing the Ilonggo ability to smile through hardship.',
      },
      {
        name: 'Dinagyang Festival',
        desc: 'Celebrated in Iloilo City every fourth weekend of January. It honors the Santo Niño with tribal dances, drumbeats, and elaborate costumes — known for highly choreographed performances.',
      },
      {
        name: 'Pamulak',
        desc: 'A flower festival in Iloilo, part of the Dinagyang celebration, where people decorate boats and floats with flowers.',
      },
      {
        name: 'Harvest and Sugar Rituals',
        desc: 'Negros Occidental is the "Sugar Capital of the Philippines." Harvest time includes rituals like "pagsaot sa tubo" (dancing on sugarcane) and offering the first harvest to the church or spirits.',
      },
    ],

    dishes: [
      {
        name: 'Batchoy',
        desc: 'A rich noodle soup from La Paz, Iloilo, made with pork organs, beef or pork broth, crushed chicharon, and egg. Topped with fresh garlic and scallions.',
      },
      {
        name: 'Chicken Inasal',
        desc: 'Grilled chicken marinated in annatto, calamansi, ginger, garlic, and lemongrass. Originated in Bacolod and now a national favorite. Served with sinamak (spiced vinegar).',
      },
      {
        name: 'Pancit Molo',
        desc: 'A soup dumpling dish from Molo, Iloilo — like a Filipino wonton soup with pork and shrimp filling in clear chicken broth.',
      },
      {
        name: 'KBL (Kadyos, Baboy, kag Langka)',
        desc: 'A sour soup made with pigeon peas, pork, and unripe jackfruit, flavored with batwan — a souring agent native to Panay.',
      },
      {
        name: 'Piaya',
        desc: 'A flatbread filled with muscovado sugar and sesame seeds, cooked on a griddle. Originally from Iloilo\'s Jaro district.',
      },
      {
        name: 'Napoleones',
        desc: 'A layered puff pastry filled with custard and topped with glazed sugar, popular in Bacolod.',
      },
    ],

    arts: [
      '"Dandansoy" — a farewell song about a man leaving his love; "Iloilo nga Probinsya Ko" — an ode to the province.',
      'Kuratsa — a courtship dance popular in the Visayas, including Hiligaynon areas.',
      'Magdalena Jalandoni was a pioneering Hiligaynon novelist; Valente Cristobal a celebrated poet.',
      'Patadyong weaving — colorful checkered fabric from Miag-ao, Iloilo — and hablon handwoven textiles.',
      'Jaro Cathedral and colonial-era churches define Iloilo\'s architectural heritage.',
    ],

    values: [
      {
        name: 'Kalma (Composure)',
        desc: 'Ilonggos are known for being soft-spoken and avoiding confrontation. Raising one\'s voice is considered rude; patience and calm are virtues.',
      },
      {
        name: 'Mapinagbigay (Generosity)',
        desc: 'Visitors are always offered food — even if supplies are limited. Sharing meals is considered a treasure: "Daw manggad" (like a treasure).',
      },
      {
        name: 'Hiyaw (Shame/Modesty)',
        desc: 'Ilonggos avoid drawing attention to themselves, avoid refusing offers openly, and prefer speaking indirectly to preserve social harmony.',
      },
      {
        name: 'Religious Devotion',
        desc: 'Iloilo is known as the "City of Churches." The Santo Niño is highly venerated, and many homes have altars with regular novenas.',
      },
    ],

    identityTitle: 'Ilonggo — The People of Iloilo and the Western Visayas',

    coreTraits: [
      'Soft-spoken and Calm (Kalma) — Ilonggos speak in a gentle, melodic manner. Loudness is avoided.',
      'Resilient with a Smile — the MassKara festival captures the spirit: "Smile even when it\'s hard."',
      'Generous and Hospitable — "Manggad" (treasure) is how they view sharing food. Visitors are always fed.',
      'Sugar-Rooted — the sugar industry shaped Negros Occidental\'s identity, from hacienda life to labor struggles.',
    ],

    historicalRoots:
      'Panay Island was historically known as Madiaas and was the landing site of the ten Bornean datus. The Spaniards established Oton (later Iloilo) in the 16th century. The sugar boom in the 19th century brought wealth and migration to Negros. Ilonggos were among the leaders of the Philippine Revolution and the sugar workers\' movement.',

    modernInfluence:
      'Ilonggos are prominent in national politics. Iloilo City is a regional hub for education and commerce; Bacolod is the "City of Smiles." Ilonggo cuisine (chicken inasal, batchoy) has gone national. Many Ilonggos work overseas, especially in California, Nevada, and the Middle East.',

    proverbs: [
      {
        text: 'Ang indi magbalik sa ginhalinan, indi makalab-ot sa pakadtuan.',
        translation: 'He who does not return to his origin will not reach his destination.',
      },
      {
        text: 'Sa tiyempo sang kalisod, makilala ang abyan.',
        translation: 'In times of difficulty, you know your friend.',
      },
      {
        text: 'Kon may kwarta, may regalo; kon wala, may handa nga puwa.',
        translation: 'If there\'s money, there\'s a gift; if none, there\'s a cooked offering. (Hospitality regardless of wealth.)',
      },
      {
        text: 'Ang kalan-on indi pagdumilian.',
        translation: 'Don\'t refuse food. (Expresses gratitude and humility.)',
      },
    ],
  },

  /* ── ILOCANO (ilo) ── */
  ilo: {
    languageFamily:
      'Austronesian › Malayo-Polynesian › Philippine › Northern Luzon › Ilocano',

    history:
      'Ilocano originated in the northwestern coast of Luzon. The Ilocanos (or Samtoy — "sao mi ditoy," our language here) developed a resilient, hardworking culture due to the region\'s harsh geography and frequent typhoons. During the Spanish colonial period, Ilocanos migrated south to escape poverty, spreading their language across the Cordilleras, Cagayan Valley, and later to Mindanao and Hawaii.',

    geographicDist:
      'Native to the Ilocos provinces, La Union, and Abra. Dominant in the Cordilleras and widely spoken in Cagayan Valley, Isabela, and Nueva Vizcaya. Internationally, Ilocano is spoken in Hawaii (the third most spoken language there), California, and Saudi Arabia.',

    interestingFact:
      'Ilocano has a unique dual pronoun sita/ta meaning specifically "the two of us (you and me)" — rare among major Philippine languages. The epic Biag ni Lam-ang is one of the few pre-colonial Philippine epics that was written down during the Spanish period.',

    wordOrder: 'Verb–Subject–Object (VSO), can shift to VOS for emphasis — similar to other Philippine languages.',

    wordOrderExample: {
      sentence: 'Mangan ti ubing ti saba.',
      breakdown: 'Verb mangan (will eat) + Subject ti ubing (the child) + Object ti saba (banana)',
    },

    pronunciationNotes: [
      'Five vowel sounds: /a/, /i/, /u/, /ɛ/ (e), /o/ — unlike Tagalog, Ilocano distinguishes /i/ and /ɛ/ in native words.',
      'Glottal stop /ʔ/ and stress are both phonemic: puón (origin) vs. púon (tree trunk).',
      'The /r/ is trilled; /k/ is more forceful than in Tagalog.',
      'Retains "e" and "o" in native words (e.g., uray — even; ngem — but).',
    ],

    expressions: [
      {
        phrase: 'Kasanu?',
        literal: 'How? / What\'s up?',
        meaning: 'Versatile greeting and question: Kasanu ka? (How are you?); or as an exclamation of surprise: Kasanu! (Wow!)',
      },
      {
        phrase: 'Naimbag.',
        literal: 'Good / Fine',
        meaning: 'Used in greetings — Naimbag nga aldaw (Good day) — and to express satisfaction with something.',
      },
      {
        phrase: 'Awan.',
        literal: 'None / Nothing / Not here',
        meaning: 'Says something doesn\'t exist or isn\'t available. Can express polite decline or quiet resignation.',
      },
      {
        phrase: 'Agbiag!',
        literal: 'Long live! (Let live)',
        meaning: 'A cheer or expression of support — similar to "Viva!" Used in festivals, rallies, or celebrations.',
      },
      {
        phrase: 'Pasensyaian',
        literal: 'From Spanish paciencia',
        meaning: '"Bear with it / Be patient" — reflects Ilocano stoicism in the face of hardship.',
      },
      {
        phrase: 'Dardarepdep',
        literal: 'Daydream / Illusion',
        meaning: 'Tells someone they\'re hoping for something unrealistic: "Dardarepdep mo laeng dayta." (That\'s just your daydream.)',
      },
      {
        phrase: 'Saan / Wen',
        literal: 'No / Yes',
        meaning: 'Basic affirmatives. Wen is often drawn out warmly: "Weeen." Saan is a firm but polite negative.',
      },
      {
        phrase: 'Marunong',
        literal: 'Knows / Skilled',
        meaning: 'Describing someone skilled — especially in farming, cooking, or crafts — is a high compliment among Ilocanos.',
      },
    ],

    traditions: [
      {
        name: 'Pamulinawen Festival',
        desc: 'Held in Laoag City, Ilocos Norte. Named after the folk song about a hard-hearted woman, it features street dancing, cultural shows, and a beauty pageant.',
      },
      {
        name: 'Basi Drinking Rituals',
        desc: 'Basi (fermented sugarcane wine) is used in offerings to ancestors and spirits. Part of weddings, funerals, and harvest celebrations.',
      },
      {
        name: 'Atang',
        desc: 'A ritual offering of food, betel nut, or basi to spirits and ancestors, placed on a small bamboo altar (dulang). Still practiced in rural areas.',
      },
      {
        name: 'Lamay (Wake)',
        desc: 'Ilocanos observe multi-day wakes with dasal (prayers) and atang for the dead. On the ninth day, a paraw (final prayer) is held; a year later, the grem (death anniversary) is observed.',
      },
    ],

    dishes: [
      {
        name: 'Pinakbet (Ilocano)',
        desc: 'Steamed mixed vegetables — bitter melon, okra, eggplant, squash, string beans — with bagoong (fermented fish paste). The Ilocano version is dry with no added water.',
      },
      {
        name: 'Bagnet',
        desc: 'Deep-fried pork belly with extra-crispy skin, boiled first then fried twice. Distinctively Ilocano — similar to lechon kawali but crispier.',
      },
      {
        name: 'Longganisa Ilocos',
        desc: 'Garlicky, tangy sausages colored red with annatto, made with ground pork and vinegar. Usually small and linked.',
      },
      {
        name: 'Dinengdeng',
        desc: 'A soup-based vegetable dish with bagoong and grilled or fried fish — simpler than pinakbet, a daily comfort food.',
      },
      {
        name: 'Basi',
        desc: 'Fermented sugarcane wine, sometimes flavored with duhat bark or fruits. Sweet-sour taste; used in rituals and celebrations.',
      },
      {
        name: 'Tupig',
        desc: 'Glutinous rice cake wrapped in banana leaves and grilled over charcoal, filled with coconut and sugar.',
      },
    ],

    arts: [
      'Biag ni Lam-ang — a pre-colonial epic about a hero who talks from birth, avenges his father, and woos a princess with supernatural feats.',
      'Folk songs: Pamulinawen, Manang Biday, O Naraniag a Bulan, and Dungdungwen Kanto — played on kubing (jaw harp) or kudyapi (boat lute).',
      'Sakuting — a stick dance from Abra that simulates martial arts.',
      'Leona Florentino, the first Filipino woman poet (19th century), wrote in Ilocano.',
      'Inabel — handwoven fabric with geometric patterns on wooden looms. The binakol pattern is said to confuse evil spirits.',
    ],

    values: [
      {
        name: 'Nakem (Prudence)',
        desc: 'A core value meaning "reason" or "judgment." Ilocanos prize thinking before acting; a person with good nakem is wise and prudent.',
      },
      {
        name: 'Regget (Hard Work)',
        desc: 'Ilocanos are known as industrious farmers, laborers, and migrants. Regget (hard work) is a point of cultural pride.',
      },
      {
        name: 'Kinaimpit (Frugality)',
        desc: 'Ilocanos are stereotypically thrifty, but this stems from living in a harsh coastal environment prone to typhoons and droughts. Saving is a virtue.',
      },
      {
        name: 'Panagkaykaysa (Unity)',
        desc: '"Nagkaykaysa nga takder, nasaknap a matnag" — United we stand, divided we fall. Community solidarity in work and hardship is a pillar of Ilocano life.',
      },
    ],

    identityTitle: 'Taga-Ilocos — The Ilocano People (also Samtoy)',

    coreTraits: [
      'Resilient and Frugal — shaped by a harsh coastal and mountainous environment prone to typhoons and droughts.',
      'Hardworking (Regget) — known as the "farmers of the Philippines" and among the most industrious migrants.',
      'Prudent (Nakem) — values thinking before acting; not impulsive.',
      'Family-Centered — extended families live together; panagkakadua (living together in harmony) is key.',
    ],

    historicalRoots:
      'Pre-colonial Ilocanos traded with Chinese, Japanese, and Malay merchants. Spanish colonization established Vigan as a political center. Ilocanos were among the first to rebel against Spain — Diego Silang in 1763 led the Ilocos Revolt, and his widow Gabriela Silang continued the resistance.',

    modernInfluence:
      'Ilocanos have produced two Philippine presidents: Elpidio Quirino and Ferdinand Marcos. Ilocano workers are a backbone of overseas Filipino labor — especially in Hawaii, California, and the Middle East. The language is offered at the University of Hawaiʻi and is celebrated in annual festivals in Honolulu.',

    proverbs: [
      {
        text: 'Ti saan nga agimadmad, madmadanto.',
        translation: 'He who does not look back will not reach his destination.',
      },
      {
        text: 'Awan ti maimas, no adda ti regget.',
        translation: 'Nothing is impossible if there is hard work.',
      },
      {
        text: 'Ti tao a nagregget, saan nga agbisin.',
        translation: 'A hardworking person will not go hungry.',
      },
      {
        text: 'Uray awan ti kuarta, no adda ti panagkaykaysa, adda latta ti rabii.',
        translation: 'Even without money, if there is unity, there is still a future.',
      },
    ],
  },

  /* ── PANGASINAN (pag) ── */
  pag: {
    languageFamily:
      'Austronesian › Malayo-Polynesian › Philippine › Northern Luzon › Meso-Cordilleran › South-Central Cordilleran › Pangasinic › Pangasinan',

    history:
      'Pangasinense originated in the Agno River basin and coastal plains of Pangasinan province. The name comes from panag-asinan (place where salt is made). Pre-colonial Pangasinan was the thriving kingdom of Caboloan, trading with China, Japan, and India. The province witnessed early revolts against Spanish rule — the Malong Revolt (1660–1661) and Palaris Revolt (1762–1765).',

    geographicDist:
      'Primarily spoken in central and eastern Pangasinan — Lingayen, Dagupan, San Carlos, Urdaneta, Calasiao, Binmaley, and Mangaldan. Also spoken in border areas of northern Tarlac, western Nueva Ecija, and southwestern La Union. Significant diaspora in Metro Manila, California (San Diego, Los Angeles), and Hawaii.',

    interestingFact:
      'Pangasinense has four demonstrative pronouns with distinct distance markers: ayari (this near me), ata (that near you), atu (that far from both), and arin (yonder, very far). It also has a special respectful pronoun for elders: sika (informal you) vs. kayo (formal/polite you) — similar to French tu vs. vous.',

    wordOrder: 'Verb–Subject–Object (VSO), with VOS also common in spoken narratives.',

    wordOrderExample: {
      sentence: 'Anggan so ubung na saba.',
      breakdown: 'Verb anggan (ate) + Subject so ubung (the child) + Object na saba (banana)',
    },

    pronunciationNotes: [
      'Five vowel sounds: /a/, /i/, /u/, /ɛ/ (e), /o/ — similar to Ilocano, distinguishes /i/ and /ɛ/ in native words.',
      'The /r/ is a flap; vowel /e/ is often pronounced /ɛ/ as in English "bed."',
      'Stress is phonemic; the glottal stop is important and was marked by a circumflex in older orthographies.',
      'Does not have the /f/ or /v/ sounds natively.',
    ],

    expressions: [
      {
        phrase: 'Kumusta ka?',
        literal: 'How are you? (from Spanish cómo está)',
        meaning: 'Standard greeting. Answered with Mabunig (I\'m fine) or Sansinabi (So-so).',
      },
      {
        phrase: 'Agya.',
        literal: 'Yes (affirmative)',
        meaning: 'Polite affirmation, also used as a conversational filler. "Agya, onla ak." (Yes, I will go.)',
      },
      {
        phrase: 'Gayam',
        literal: 'Indeed / So / Actually',
        meaning: 'Versatile particle indicating surprise, realization, or emphasis. "Sika gayam?" (So it\'s you? / It was you indeed.)',
      },
      {
        phrase: 'Sansinabi',
        literal: 'So-so / Just okay',
        meaning: 'Humble response to "How are you?" — reflects Pangasinense modesty and avoidance of boasting.',
      },
      {
        phrase: 'Anto et?',
        literal: 'What is that?',
        meaning: 'Used to ask for clarification or express surprise — similar to "Really?" or "What?"',
      },
      {
        phrase: 'Tay mangan.',
        literal: 'Let\'s eat.',
        meaning: 'The hortatory tay (shortened from tayo) is used to warmly invite someone into an action.',
      },
      {
        phrase: 'Ay, salamat!',
        literal: 'Oh, thanks!',
        meaning: 'Expression of gratitude and relief combined. "Ay, salamat ta onla ka." (Oh, thanks that you\'re coming.)',
      },
      {
        phrase: 'Mano man?',
        literal: 'What\'s happening? / What\'s up?',
        meaning: 'Informal greeting among friends. "Mano man dita?" (What\'s up there?)',
      },
    ],

    traditions: [
      {
        name: 'Pista\'y Dayat (Feast of the Sea)',
        desc: 'Held annually on May 1st in Lingayen Gulf. Fishermen offer flowers and food to the sea, with a fluvial procession and street dancing to give thanks for a bountiful harvest.',
      },
      {
        name: 'Bangus Festival',
        desc: 'Celebrated in Dagupan City every April. Features street parties, grill competitions, and the world\'s longest bangus (milkfish) barbecue.',
      },
      {
        name: 'Agew na Pangasinan (Pangasinan Day)',
        desc: 'Celebrated on April 5th, commemorating the founding of Pangasinan province. Parades, cultural shows, and beauty pageants are held.',
      },
      {
        name: 'Atang & Nobbing',
        desc: 'Atang involves offerings of food, betel nut, or basi to spirits and ancestors — placed at the doorstep or on a bamboo altar. Nobbing is the tradition of serenading a loved one at night with guitar and Pangasinense love songs.',
      },
    ],

    dishes: [
      {
        name: 'Pigar-pigar',
        desc: 'A stir-fried dish of thinly sliced carabao or beef, onions, and cabbage, seasoned with soy sauce and pepper. A Pangasinan specialty originating from Calasiao.',
      },
      {
        name: 'Puto Calasiao',
        desc: 'Small, soft, steamed white rice cakes famous from Calasiao. Fluffy and slightly sweet, often eaten as breakfast or merienda.',
      },
      {
        name: 'Bangus Dishes',
        desc: 'Dagupan is the Bangus Capital. Key dishes include Relyenong bangus (stuffed milkfish), Sinigang na bangus (sour milkfish soup), and Daing na bangus (marinated fried milkfish).',
      },
      {
        name: 'Binungey',
        desc: 'Sticky rice and coconut milk cooked inside bamboo tubes over open fire. Smoky aroma; commonly sold by roadside vendors.',
      },
      {
        name: 'Kalamay',
        desc: 'A sticky rice cake made from glutinous rice flour, coconut milk, and brown sugar, cooked slowly until thick. Topped with latik (coconut curds).',
      },
      {
        name: 'Tupig',
        desc: 'Glutinous rice cake wrapped in banana leaves and grilled. The Pangasinan version often includes coconut strips and peanuts.',
      },
    ],

    arts: [
      '"Malinak Lay Labi" (Peaceful Night) and "Marikit na Bulan" (Beautiful Moon) are beloved Pangasinense folk songs.',
      'Pandanggo Pangasinan — a courtship dance with candles; Kuraldal — a dance of thanksgiving at fiestas.',
      'Santiago B. Villafania is a celebrated contemporary poet, author of "Balikas na Caboloan" (Words of Caboloan).',
      'Our Lady of Manaoag shrine is a major pilgrimage destination known for its centuries-old ivory image of the Virgin Mary.',
      'Bamboo and rattan weaving, pottery from Calasiao and Binmaley, and fish-net making in coastal towns.',
    ],

    values: [
      {
        name: 'Panagkaykaysa (Unity)',
        desc: 'Community solidarity especially during fiestas, harvests, and emergencies. Pangasinenses help each other through collective effort (bayanihan).',
      },
      {
        name: 'Panagpeteg (Hard Work)',
        desc: '"Say maong kimey, say maong abung" — Good work, good harvest. Pangasinenses are known as industrious farmers, fisherfolk, and entrepreneurs.',
      },
      {
        name: 'Panagkalem (Patience)',
        desc: 'Calmness and avoiding direct confrontation. Pangasinenses are known for being slow to anger and preferring peaceful resolution.',
      },
      {
        name: 'Frugality (Kinaimpitan)',
        desc: '"Say ag man-impit, ag man-asenso" — One who does not save does not progress. Thrift and saving for the future are virtues.',
      },
    ],

    identityTitle: 'Pangasinense — The People of the Salt Place (from panag-asinan)',

    coreTraits: [
      'Hardworking (Manpeteg) — industrious farmers, fisherfolk, and entrepreneurs.',
      'Calm and Patient (Makalmalem) — avoids rash actions and loud confrontations.',
      'Frugal (Maimpit) — values saving and resourcefulness.',
      'Community-Oriented — strong panagkaykaysa (unity) in work and celebrations.',
      'Proud of their Language — Pangasinense is a distinct language, not a dialect of Ilocano or Tagalog.',
    ],

    historicalRoots:
      'Pre-colonial Pangasinan was the kingdom of Caboloan, a trading power that sent emissaries to China. The Spanish established Pangasinan as a province in 1580. The province was the site of the Malong Revolt (1660–1661) and the Palaris Revolt (1762–1765) against Spanish rule. In the 20th century, Pangasinan became a major agricultural and aquaculture producer.',

    modernInfluence:
      'Pangasinan has produced notable national figures including President Fidel V. Ramos (born in Lingayen) and Speaker Jose de Venecia Jr. (from Dagupan). The province is a major supplier of bangus (milkfish) nationwide. Pangasinense migrants maintain cultural organizations in California and Hawaii.',

    proverbs: [
      {
        text: 'Say toon ag man-iling ed pinangibatan to, ag makasabi ed laen to.',
        translation: 'He who does not look back at where he came from will not reach his destination.',
      },
      {
        text: 'Say maong kimey, say maong abung.',
        translation: 'Good work, good harvest.',
      },
      {
        text: 'No say danum ag gumod, say sira ag mabiro.',
        translation: 'If the water does not move, the fish will not be caught. (Effort is needed for results.)',
      },
      {
        text: 'Say ag man-impit, ag man-asenso.',
        translation: 'One who does not save does not progress.',
      },
    ],
  },

  /* ── TAGALOG / FILIPINO (fil) ── */
  fil: {
    languageFamily:
      'Austronesian › Malayo-Polynesian › Philippine › Greater Central Philippine › Central Philippine › Tagalog',

    history:
      'Tagalog originated in the riverine areas of Southern Luzon — taga-ilog means "people of the river." The Spanish selected Manila as the colonial capital, making Tagalog the language of colonial administration. The first printed book in the Philippines, the Doctrina Christiana (1593), was in Tagalog and Spanish. In 1937 Tagalog was chosen as the basis for the national language; in 1987 Filipino was formally declared the national language.',

    geographicDist:
      'Native to Metro Manila, Cavite, Laguna, Batangas, Rizal, Quezon, Bulacan, Bataan, Nueva Ecija, Zambales, Marinduque, Mindoro, and Palawan. As Filipino, it serves as the national lingua franca. Overseas, it is spoken in the United States, Canada, Saudi Arabia, Japan, and many other countries.',

    interestingFact:
      'Tagalog has a unique focus system marking whether the subject is the actor, object, location, beneficiary, or instrument of the verb. It also has the famous po and opo politeness markers — less common in other Philippine languages — which show deep respect when addressing elders or strangers.',

    wordOrder: 'Verb–Subject–Object (VSO) typically; VOS is common in everyday speech; sentences can also be predicate-initial or subject-initial for emphasis.',

    wordOrderExample: {
      sentence: 'Kumain ang bata ng saging.',
      breakdown: 'Verb kumain (ate) + Subject ang bata (the child) + Object ng saging (banana)',
    },

    pronunciationNotes: [
      'Three native vowels (/a/, /i/, /u/); /e/ and /o/ used in loanwords. Batangas Tagalog retains /e/ vs /i/ distinctions.',
      'Stress is phonemic: bása (read) vs. basâ (wet). The glottal stop is marked by a hyphen or diacritic.',
      'The /ng/ sound can appear at the beginning of words (e.g., ngipin — tooth) — unusual among world languages.',
      'The /r/ is a flap or trill; the /h/ is breathy. Po/opo are unique politeness particles added to virtually any sentence.',
    ],

    expressions: [
      {
        phrase: 'Kamusta?',
        literal: 'How are you? (from Spanish cómo está)',
        meaning: 'Universal Filipino greeting. Answered with Mabuti naman (I\'m fine) or Ok lang (Just okay).',
      },
      {
        phrase: 'Bahala na.',
        literal: 'Come what may / Leave it to God',
        meaning: 'Expresses fatalism and trust in a higher power. A core Filipino value and attitude toward uncertainty.',
      },
      {
        phrase: 'Ano ba?',
        literal: 'What, really? / What the?',
        meaning: 'Expresses annoyance, confusion, or emphasis. Often combined: "Ano ba kasi!" (What the, come on!)',
      },
      {
        phrase: 'Sayang!',
        literal: 'What a waste!',
        meaning: 'Expresses regret over a missed opportunity or wasted item. Deep sense of loss in a single word.',
      },
      {
        phrase: 'Sige na.',
        literal: 'Go on / Please / Alright',
        meaning: 'Used to concede, urge action, or politely insist. Can mean encouragement or gentle pleading.',
      },
      {
        phrase: 'Ewan ko.',
        literal: 'I don\'t know',
        meaning: 'Expresses ignorance, resignation, or dismissal. Often paired with "bahala na" for complete surrender.',
      },
      {
        phrase: 'Ayos lang.',
        literal: 'It\'s okay / It\'s fine',
        meaning: 'Response to apologies or thanks; also used to downplay problems and maintain smooth relations (pakikisama).',
      },
      {
        phrase: 'Hala!',
        literal: '(Exclamation)',
        meaning: 'Expresses alarm, warning, or surprise — "Oh no!" or "Watch out!" Shared with Cebuano but distinct in tone.',
      },
    ],

    traditions: [
      {
        name: 'Pahiyas Festival',
        desc: 'Held in Lucban, Quezon every May 15th. Houses are decorated with colorful rice wafers (kiping), fruits, vegetables, and agricultural produce to honor San Isidro Labrador, patron saint of farmers.',
      },
      {
        name: 'Pista ng Nazareno',
        desc: 'Celebrated in Quiapo, Manila every January 9th. The Black Nazarene statue is paraded through the streets, with millions of barefoot devotees participating.',
      },
      {
        name: 'Simbang Gabi',
        desc: 'A nine-day series of pre-dawn masses leading to Christmas Eve. Completing all nine masses is believed to grant a wish — deeply observed in Tagalog regions.',
      },
      {
        name: 'Bayanihan',
        desc: 'The tradition of community cooperation — neighbors helping a family move their house by literally carrying it on bamboo poles. Still practiced in rural Tagalog areas.',
      },
    ],

    dishes: [
      {
        name: 'Adobo',
        desc: 'The most famous Filipino dish — meat (chicken or pork) simmered in vinegar, soy sauce, garlic, bay leaves, and peppercorns. The Tagalog version is usually saucy.',
      },
      {
        name: 'Sinigang',
        desc: 'A sour tamarind soup with pork or fish and vegetables. Tagalog regions use gabi (taro) to thicken the broth.',
      },
      {
        name: 'Kare-Kare',
        desc: 'A rich oxtail and vegetable stew in peanut sauce, served with bagoong (fermented shrimp paste). A centerpiece of special occasions.',
      },
      {
        name: 'Bulalo',
        desc: 'A beef shank soup with bone marrow, cabbage, corn, and potatoes. Originally from Batangas, it has become a national comfort food.',
      },
      {
        name: 'Buko Pie',
        desc: 'A pie made from young coconut flesh and condensed milk — famous from Los Baños, Laguna. A beloved pasalubong (gift) from the region.',
      },
      {
        name: 'Pancit Palabok',
        desc: 'Rice noodles with a savory orange sauce, topped with shrimp, pork cracklings, hard-boiled egg, and green onions. A festive Tagalog dish.',
      },
    ],

    arts: [
      'Florante at Laura (1838) by Francisco Balagtas — the masterpiece of Tagalog epic poetry.',
      'Folk songs: "Bahay Kubo," "Leron Leron Sinta" (from Batangas), "Paruparong Bukid," and "Sitsiritsit."',
      'Tinikling — bamboo pole dance; Cariñosa — courtship dance with a handkerchief; Maglalatik — mock war dance.',
      'Fernando Amorsolo, the first National Artist — painted luminous scenes of rural Philippine life.',
      'Jeepney art — elaborately decorated public transport vehicles with horses, saints, and colorful slogans.',
    ],

    values: [
      {
        name: 'Pakikisama (Smooth Relations)',
        desc: 'Getting along with others; avoiding conflict and maintaining group harmony. One of the most defining traits of Filipino social life.',
      },
      {
        name: 'Utang na Loob (Debt of Gratitude)',
        desc: 'A deep social bond that obligates the recipient of a favor to return it in the future. It strengthens relationships across generations.',
      },
      {
        name: 'Hiya (Shame)',
        desc: '"Nakakahiya" (how embarrassing) influences behavior to avoid social disapproval. Tagalog speakers are sensitive to maintaining face in public.',
      },
      {
        name: 'Bahala Na (Fatalism)',
        desc: 'Leaving outcomes to a higher power — but also courage to face uncertainty with equanimity. Not mere resignation but active trust.',
      },
    ],

    identityTitle: 'Tagalog — The People of the River (from taga-ilog)',

    coreTraits: [
      'Resilient (Matatag) — Tagalogs have faced colonization, wars, and natural disasters, yet remain optimistic.',
      'Friendly and Hospitable (Mapagpatuloy) — visitors are always offered food and drink.',
      'Family-Oriented (Pamilya) — "pamilya muna" (family first) is a lived principle, not just a saying.',
      'Adaptable — Tagalog (as Filipino) has absorbed loanwords from Spanish, English, Chinese, and other Philippine languages.',
    ],

    historicalRoots:
      'The Tagalog region was the site of the pre-colonial Tondo and Maynila kingdoms, trading with China and Southeast Asia. The Spanish conquered Manila in 1571 and made it the colonial capital. Tagalog provinces — Batangas, Laguna, Cavite, Bulacan — were the cradle of the Philippine Revolution of 1896.',

    modernInfluence:
      'Filipino (based on Tagalog) is the national language used in government, education, media, and everyday communication nationwide. Filipino pop music, television (ABS-CBN, GMA), and movies are predominantly in Tagalog. National heroes José Rizal, Andrés Bonifacio, and Corazon Aquino were Tagalog speakers.',

    proverbs: [
      {
        text: 'Ang hindi marunong lumingon sa pinanggalingan ay hindi makararating sa paroroonan.',
        translation: 'He who does not look back at where he came from will not reach his destination.',
      },
      {
        text: 'Kung may tiyaga, may nilaga.',
        translation: 'If there is perseverance, there is stew. (Hard work brings its reward.)',
      },
      {
        text: 'Ang mabigat ay gumagaan kung sama-sama.',
        translation: 'A heavy load becomes light when carried together.',
      },
      {
        text: 'Daig ng maagap ang masipag.',
        translation: 'Being proactive beats being merely hardworking.',
      },
    ],
  },
};

/* ─────────────────────────────────────────────
   Internal: fallback-aware image
───────────────────────────────────────────── */
const CULTURAL_IMAGE_FALLBACK = '/Images/cultural-fallback.svg';

const CulturalContextImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
}> = ({ src, alt, className, loading, style }) => {
  const [resolved, setResolved] = useState(src);
  useEffect(() => { setResolved(src); }, [src]);
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      style={style}
      decoding="async"
      onError={() =>
        setResolved(cur => cur === CULTURAL_IMAGE_FALLBACK ? cur : CULTURAL_IMAGE_FALLBACK)
      }
    />
  );
};

/* ─────────────────────────────────────────────
   Internal: section heading
───────────────────────────────────────────── */
const SectionHeading: React.FC<{ emoji: string; label: string }> = ({ emoji, label }) => (
  <div className="cdm-section-heading">
    <span className="cdm-section-heading__emoji" aria-hidden="true">{emoji}</span>
    <span className="cdm-section-heading__text">{label}</span>
  </div>
);

/* ─────────────────────────────────────────────
   Internal: Tab bar
───────────────────────────────────────────── */
type TabId = 'overview' | 'language' | 'culture' | 'phrases';

interface TabDef { id: TabId; emoji: string; label: string; }

const TabBar: React.FC<{
  tabs: TabDef[];
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  color: string;
}> = ({ tabs, activeTab, onSelect, color }) => (
  <div className="cdm-tab-bar" role="tablist">
    {tabs.map(t => (
      <button
        key={t.id}
        role="tab"
        aria-selected={activeTab === t.id}
        className={`cdm-tab-btn${activeTab === t.id ? ' cdm-tab-btn--active' : ''}`}
        style={activeTab === t.id ? { '--tab-color': color } as React.CSSProperties : undefined}
        onClick={() => onSelect(t.id)}
      >
        <span className="cdm-tab-btn__emoji" aria-hidden="true">{t.emoji}</span>
        <span className="cdm-tab-btn__label">{t.label}</span>
      </button>
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   CardDetailModal  (with drag-to-expand hero)
───────────────────────────────────────────── */

/** Two sheet snap positions (as % of viewport height from bottom) */
const SNAP_PEEK = 52;   // minimal mode (not used - opens in full)
const SNAP_FULL = 90;   // full sheet height (default opening state)

const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  isOpen,
  onClose,
  onSelectDialect,
  currentLanguageCode,
}) => {
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  /** Current snap level: 'peek' | 'full' */
  const [snap, setSnap] = useState<'peek' | 'full'>('full');

  // drag state
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<'peek' | 'full'>('full');
  const sheetRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setSnap('full');
      setActiveTab('overview');
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const t = setTimeout(() => { setVisible(false); setSnap('full'); }, 340);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!visible || !card) return null;

  const matchedLang = card.dialectCode
    ? (LANGUAGES.find((l: Language) => l.code === card.dialectCode) ?? null)
    : null;

  const isAlreadyActive = Boolean(matchedLang && currentLanguageCode === matchedLang.code);

  /* Pull rich content from the embedded map — no external file needed */
  const c: DialectContent | undefined = DIALECT_CONTENT[card.dialectCode];

  /* ── Drag handlers ── */
  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY;
    dragStartSnap.current = snap;
    isDragging.current = true;
  };

  const handleDragEnd = (clientY: number) => {
    if (!isDragging.current || dragStartY.current === null) return;
    isDragging.current = false;
    const delta = dragStartY.current - clientY; // positive = dragged up
    if (dragStartSnap.current === 'peek' && delta > 40) {
      setSnap('full');
    } else if (dragStartSnap.current === 'full' && delta < -40) {
      setSnap('peek');
    }
    dragStartY.current = null;
  };

  const sheetHeight = snap === 'peek' ? SNAP_PEEK : SNAP_FULL;

  return ReactDOM.createPortal(
    <div
      className={`cdm-overlay${animating ? ' cdm-overlay--in' : ''}`}
      onClick={() => { if (snap === 'peek') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.title} dialect details`}
    >
      <div
        ref={sheetRef}
        className={`cdm-sheet cdm-sheet--draggable${animating ? ' cdm-sheet--in' : ''}${snap === 'full' ? ' cdm-sheet--full' : ''}`}
        style={{ maxHeight: `${sheetHeight}dvh` }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => handleDragStart(e.clientY)}
        onMouseUp={e => handleDragEnd(e.clientY)}
        onTouchStart={e => handleDragStart(e.touches[0].clientY)}
        onTouchEnd={e => handleDragEnd(e.changedTouches[0].clientY)}
      >
        {/* ── Drag handle ── */}
        <div
          className="cdm-drag-handle"
          aria-label="Close modal"
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); onClose(); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
        >
          <span className="cdm-drag-handle__bar" />
          <span className="cdm-drag-handle__hint">
            ↓ Pull down to close
          </span>
          <button className="cdm-close" onClick={e => { e.stopPropagation(); onClose(); }} aria-label="Close" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body — only visible in full mode ── */}
        <div className={`cdm-body${snap === 'peek' ? ' cdm-body--hidden' : ''}`}>

          {/* Stats row — always visible */}
          <div className="cdm-facts-row">
            {card.facts.map(f => (
              <div key={f.label} className="cdm-fact">
                <span className="cdm-fact-val">{f.value}</span>
                <span className="cdm-fact-lbl">{f.label}</span>
              </div>
            ))}
          </div>

          {/* ── Tab panels (scrollable content) ── */}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="cdm-tab-panel">
              <div style={{ width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
                <CulturalContextImage src={card.image} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
              </div>
              <p className="cdm-desc">{card.desc}</p>

              <div className="cdm-section-label">Highlights</div>
              <ul className="cdm-highlights">
                {card.highlights.map(h => (
                  <li key={h} className="cdm-highlight-item">
                    <span className="cdm-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {h}
                  </li>
                ))}
              </ul>

              {c && (
                <>
                  {c.languageFamily && (
                    <div className="cdm-info-row">
                      <span className="cdm-info-label">Language family</span>
                      <span className="cdm-info-value">{c.languageFamily}</span>
                    </div>
                  )}
                  {c.history && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="📜" label="Brief History" />
                      <p className="cdm-rich-body">{c.history}</p>
                    </section>
                  )}
                  {c.geographicDist && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="📍" label="Where It's Spoken" />
                      <p className="cdm-rich-body">{c.geographicDist}</p>
                    </section>
                  )}
                  {c.interestingFact && (
                    <div className="cdm-fun-fact">
                      <span className="cdm-fun-fact__icon" aria-hidden="true">💡</span>
                      <p className="cdm-fun-fact__text">{c.interestingFact}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* LANGUAGE */}
          {activeTab === 'language' && (
            <div className="cdm-tab-panel">
              {c ? (
                <>
                  {c.wordOrder && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🔤" label="Word Order" />
                      <p className="cdm-rich-body">{c.wordOrder}</p>
                      {c.wordOrderExample && (
                        <div className="cdm-example-box">
                          <p className="cdm-example-sentence">{c.wordOrderExample.sentence}</p>
                          <p className="cdm-example-breakdown">{c.wordOrderExample.breakdown}</p>
                        </div>
                      )}
                    </section>
                  )}
                  {c.pronunciationNotes && c.pronunciationNotes.length > 0 && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🔊" label="Pronunciation" />
                      <ul className="cdm-bullet-list">
                        {c.pronunciationNotes.map((n, i) => (
                          <li key={i} className="cdm-bullet-item">{n}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {c.proverbs && c.proverbs.length > 0 && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="📖" label="Proverbs & Sayings" />
                      <div className="cdm-proverbs-list">
                        {c.proverbs.map((p, i) => (
                          <div key={i} className="cdm-proverb-card">
                            <p className="cdm-proverb-text">&#8220;{p.text}&#8221;</p>
                            <p className="cdm-proverb-translation">{p.translation}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {!c.wordOrder && !c.pronunciationNotes?.length && !c.proverbs?.length && (
                    <p className="cdm-tab-empty">Language details coming soon.</p>
                  )}
                </>
              ) : (
                <p className="cdm-tab-empty">Language details coming soon.</p>
              )}
            </div>
          )}

          {/* CULTURE */}
          {activeTab === 'culture' && (
            <div className="cdm-tab-panel">
              {c ? (
                <>
                  {c.traditions && c.traditions.length > 0 && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🎉" label="Traditions & Customs" />
                      <div className="cdm-traditions-list">
                        {c.traditions.map((t, i) => (
                          <div key={i} className="cdm-tradition-item">
                            <p className="cdm-tradition-name">{t.name}</p>
                            <p className="cdm-tradition-desc">{t.desc}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {c.dishes && c.dishes.length > 0 && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🍽️" label="Food & Cuisine" />
                      <div className="cdm-dishes-grid">
                        {c.dishes.map((d, i) => (
                          <div key={i} className="cdm-dish-card">
                            <p className="cdm-dish-name">{d.name}</p>
                            <p className="cdm-dish-desc">{d.desc}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {c.arts && c.arts.length > 0 && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🎨" label="Arts, Music & Literature" />
                      <ul className="cdm-bullet-list">
                        {c.arts.map((a, i) => (
                          <li key={i} className="cdm-bullet-item">{a}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {c.values && c.values.length > 0 && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🤝" label="Values & Social Norms" />
                      <div className="cdm-values-list">
                        {c.values.map((v, i) => (
                          <div key={i} className="cdm-value-item">
                            <p className="cdm-value-name">{v.name}</p>
                            <p className="cdm-value-desc">{v.desc}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {(c.identityTitle || c.historicalRoots || c.modernInfluence || c.coreTraits?.length) && (
                    <section className="cdm-rich-section">
                      <SectionHeading emoji="🏛️" label="Cultural Identity" />
                      {c.identityTitle && <p className="cdm-identity-title">{c.identityTitle}</p>}
                      {c.historicalRoots && (
                        <>
                          <p className="cdm-rich-label">Historical roots</p>
                          <p className="cdm-rich-body">{c.historicalRoots}</p>
                        </>
                      )}
                      {c.modernInfluence && (
                        <>
                          <p className="cdm-rich-label">Modern influence</p>
                          <p className="cdm-rich-body">{c.modernInfluence}</p>
                        </>
                      )}
                      {c.coreTraits && c.coreTraits.length > 0 && (
                        <>
                          <p className="cdm-rich-label">Core traits</p>
                          <ul className="cdm-bullet-list">
                            {c.coreTraits.map((t, i) => (
                              <li key={i} className="cdm-bullet-item">{t}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </section>
                  )}
                  {!c.traditions?.length && !c.dishes?.length && !c.arts?.length && !c.values?.length && (
                    <p className="cdm-tab-empty">Cultural details coming soon.</p>
                  )}
                </>
              ) : (
                <p className="cdm-tab-empty">Cultural details coming soon.</p>
              )}
            </div>
          )}

          {/* PHRASES */}
          {activeTab === 'phrases' && (
            <div className="cdm-tab-panel">
              {c?.expressions && c.expressions.length > 0 ? (
                <div className="cdm-expressions-list">
                  {c.expressions.map((ex, i) => (
                    <div key={i} className="cdm-expression-card">
                      <p className="cdm-expression-phrase">{ex.phrase}</p>
                      <p className="cdm-expression-literal">Literal: {ex.literal}</p>
                      <p className="cdm-expression-meaning">{ex.meaning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cdm-tab-empty">Common phrases coming soon.</p>
              )}
            </div>
          )}

          {/* ── CTA — always at bottom ── */}
          <div className="cdm-cta-wrap">
            {matchedLang ? (
              isAlreadyActive ? (
                <div className="cdm-already-active">
                  <span className="cdm-already-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span><strong>{matchedLang.name}</strong> is your active dialect</span>
                </div>
              ) : (
                <button
                  className="cdm-proceed-btn"
                  style={{ '--btn-color': card.tagColor } as React.CSSProperties}
                  onClick={() => { onSelectDialect(matchedLang); onClose(); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Proceed with {matchedLang.name}
                </button>
              )
            ) : (
              <div className="cdm-coming-soon">
                <span>🚧</span>
                <span>This dialect is coming soon to SalinTayo</span>
              </div>
            )}
          </div>

        </div>

        {/* ── Fixed Tab bar at bottom ── */}
        <TabBar
          tabs={[
            { id: 'overview', emoji: '🌏', label: 'Overview' },
            { id: 'language', emoji: '🗣️', label: 'Language' },
            { id: 'culture',  emoji: '🎉', label: 'Culture'  },
            { id: 'phrases',  emoji: '💬', label: 'Phrases'  },
          ]}
          activeTab={activeTab}
          onSelect={setActiveTab}
          color={card.tagColor}
        />

      </div>
    </div>,
    document.body,
  );
};

export default CardDetailModal;