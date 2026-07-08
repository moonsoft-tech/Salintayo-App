import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IonIcon } from '@ionic/react';
import { flashOutline } from 'ionicons/icons';
import { cancelSpeech, speakText } from '../utils/tts';
import { getResolvedDialectLangCode } from '../utils/dialectPreference';
import './QuickChatBubble.css';

const STORAGE_KEY = 'salintayo_quickchat_enabled';
const LANG_KEY = 'salintayo_dialect_lang';
const QCB_LANG_KEY = 'salintayo_qcb_dialect_lang';
const POS_KEY = 'salintayo_quickchat_pos';
const BUBBLE_SIZE = 52;
const MOVE_THRESHOLD = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const getLangCode = (): string => {
  try {
    return localStorage.getItem(QCB_LANG_KEY) ?? localStorage.getItem(LANG_KEY) ?? getResolvedDialectLangCode();
  } catch {
    try {
      return getResolvedDialectLangCode();
    } catch {
      return 'fil';
    }
  }
};

const LANG_LABEL_MAP: Record<string, string> = {
  en: 'English',
  fil: 'Filipino',
  ceb: 'Cebuano',
  ilo: 'Ilocano',
  hil: 'Hiligaynon',
  war: 'Waray',
  bik: 'Bikol',
  pam: 'Kapampangan',
  pag: 'Pangasinan',
  tsg: 'Tausug',
};

// Keyed by [langCode][categoryId] — same order as EMERGENCY_CATEGORIES phrases.
// Languages without a translation fall back to English automatically.
const TRANSLATIONS: Record<string, Record<string, string[]>> = {
  en: {}, // English uses the base phrases
  // NOTE: We keep the table intentionally partial here; missing entries
  // will fall back to the English phrase in the UI and TTS.
  fil: {
    medical: [
      'Tumawag ng ambulansya agad.',
      'Kailangan ko ng doktor.',
      'Hindi ako makahinga.',
      'May isang tao na nawalan ng malay / hindi humihinga.',
      'Sobra ang pagdurugo niya.',
      'Nagkakaroon ako ng allergic reaction.',
      'Kumain ako ng isang bagay at masama ang pakiramdam ko.',
      'Masakit ang aking dibdib.',
      'Sa tingin ko ay may lagnat ako.',
      'Nasaan ang pinakamalapit na ospital?',
      'Nasaan ang pinakamalapit na 24-oras na parmasya?',
      'Pakitulungan akong manatiling tahimik.',
      'Kailangan ko ng wheelchair.',
    ],
    safety: [
      'Tumawag ng pulis!',
      'Tulong! Kailangan ko ng tulong!',
      'Tulong! Magnanakaw!',
      'Ninakawan ako.',
      'Ninakaw ang aking pitaka / telepono / pasaporte.',
      'May sumusunod sa akin.',
      'Pakitigil na ang pakialam sa akin.',
      'Lumayo ka sa akin.',
      'Nararamdaman kong may banta sa akin.',
      'Gusto kong mag-ulat ng krimen.',
      'Nasaan ang himpilan ng pulis?',
      'Kailangan kong makipag-ugnayan sa aking embahada / konsulado.',
      'Nawawala ang aking kaibigan.',
      'Nawawala ang aking anak. Hindi ko sila mahanap.',
    ],
    disaster: [
      'Lindol! Lumabas sa gusali!',
      'May babala ba ng lindol?',
      'Nasaan ang evacuation center?',
      'Ligtas ba dito?',
      'Tumataas ang tubig. May baha ba?',
      'Paparating ang bagyo. Ligtas ba ang paglalakbay?',
      'Kakaiba ang kilos ng bulkan. Ano ang dapat naming gawin?',
      'Saan ako makakahanap ng mataas na lugar?',
      'Pakibukas ang mga emergency alert.',
    ],
    transport: [
      'Nasira ang traysikel / jeepney.',
      'Kailangan ko ng mekaniko.',
      'Kailangan ko ng tow truck.',
      'Naubusan kami ng gasolina.',
      'Pato ang aking gulong.',
      'Maling ruta ang tinatahak ng driver ng taksi.',
      'Pakigamit ang metro.',
      'Mahal na yan. Pakibigyan ng tamang presyo.',
      'Dito na. Gusto kong bumaba.',
      'Pakibagalan ang pagmamaneho. Hindi ito ligtas.',
      'Saan ako makakahanap ng mapagkakatiwalaang taksi / Grab?',
      'Nalampasan ko ang aking flight / bus / barko.',
      'Nawala ang aking bagahe.',
    ],
    lost: [
      'Nawawala ako.',
      'Hindi ko alam kung nasaan ang aking hotel.',
      'Maaari mo bang tulungan akong hanapin ang address na ito?',
      'Maaari mo bang ipakita sa mapa?',
      'Ligtas bang maglakad doon?',
      'Malayo ba ito mula dito?',
      'Naghahanap ako ng himpilan ng pulis.',
      'Naghahanap ako ng ospital.',
      'Naghahanap ako ng pampublikong palikuran.',
      'Aling direksyon ang sentro ng lungsod?',
      'Pakisulat ang address para sa akin.',
    ],
    comms: [
      'Nagsasalita ka ba ng Ingles?',
      'Pakimaging mabagal.',
      'Hindi ko naiintindihan.',
      'Maaari mo bang ulitin iyon?',
      'Maaari mo bang tulungan akong tumawag ng taksi?',
      'Patay na ang baterya ng aking telepono. Maaari akong humiram ng charger?',
      'Hindi gumagana ang aking mobile data. Mayroon ka bang WiFi?',
      'Kinain ng ATM ang aking card. Ano ang dapat kong gawin?',
      'Nawala ang aking bank card. Nasaan ang pinakamalapit na bangko?',
      'Maaari ko bang gamitin ang iyong telepono? Emergency ito.',
      'Pakihintay dito kasama ako.',
      'Kailangan kong tumawag sa ibang bansa.',
    ],
  },
  ceb: {
    medical: [
      'Tawga dayon og ambulansya.',
      'Kinahanglan ko og doktor.',
      'Dili ko makapanghinga.',
      'May tawo nga nawad-an og malay / dili manghinga.',
      'Grabing pagdugo niya.',
      'Nag-antos ko og allergic reaction.',
      'Nakakaon ko og usa ka butang ug masakit ang akong tiyan.',
      'Masakit ang akong dughan.',
      'Sa akong hunahuna may lagnat ko.',
      'Asa ang pinakadulom nga ospital?',
      'Asa ang pinakadulom nga 24-oras nga parmasya?',
      'Palihug tabangi akong magpabilin nga hilom.',
      'Kinahanglan ko og wheelchair.',
    ],
    safety: [
      'Tawga og pulis!',
      'Tabang! Kinahanglan ko og tabang!',
      'Tabang! Kawatan!',
      'Gikawat ko.',
      'Gikawat ang akong pitaka / telepono / pasaporte.',
      'May tawo nga nagsunod nako.',
      'Palihug biyaan mo ko.',
      'Pag-ikaw sa akong gawas.',
      'Gipahimangno ko.',
      'Gusto kong mag-report og krimen.',
      'Asa ang himpilan sa pulis?',
      'Kinahanglan kong makontak ang akong embahada / konsulado.',
      'Nawala ang akong higala.',
      'Nawala ang akong anak. Dili ko sila makita.',
    ],
    disaster: [
      'Linog! Pag-ikaw sa balay!',
      'Aduna ba babala sa linog?',
      'Asa ang evacuation center?',
      'Luwas ba diri?',
      'Tumataas ang tubig. Aduna ba baha?',
      'Moabot ang bagyo. Luwas ba ang pagbiyahe?',
      'Kakaiba ang kalihokan sa bulkan. Unsa ang among buhaton?',
      'Asa ko makakita og mataas nga lugar?',
      'Palihug buhata ang mga emergency alert.',
    ],
    transport: [
      'Nasira ang traysikel / jeepney.',
      'Kinahanglan ko og mekaniko.',
      'Kinahanglan ko og tow truck.',
      'Naubusan mi og gasolina.',
      'Pato ang akong ligid.',
      'Sayop nga dalan ang gikuha sa driver sa taksi.',
      'Palihug gamita ang metro.',
      'Mahal na. Palihug hatagi og patas nga presyo.',
      'Diritso na. Gusto kong mobaba.',
      'Palihug bagal ang pagmaneho. Dili luwas.',
      'Asa ko makakita og kasaligan nga taksi / Grab?',
      'Nalampasan ko ang akong flight / bus / barko.',
      'Nawala ang akong bagahe.',
    ],
    lost: [
      'Nawala ko.',
      'Dili ko kahibalo asa ang akong hotel.',
      'Maaari ka bang tabangan ko sa pagpangita niining address?',
      'Maaari ka bang ipakita sa mapa?',
      'Luwas ba ang paglakaw didto?',
      'Layo ba gikan diri?',
      'Nagpangita ko og himpilan sa pulis.',
      'Nagpangita ko og ospital.',
      'Nagpangita ko og pampublikong palikuran.',
      'Unsa nga direksyon ang sentro sa lungsod?',
      'Palihug sulata ang address alang nako.',
    ],
    comms: [
      'Magsulti ka ba og English?',
      'Palihug sulti og hinay.',
      'Dili ko kasabot.',
      'Maaari ka bang uliton na?',
      'Maaari ka bang tabangan ko sa pagtawag og taksi?',
      'Patay na ang baterya sa akong telepono. Maaari ko bang manghulam og charger?',
      'Dili mogana ang akong mobile data. Aduna ka bang WiFi?',
      'Gikaon sa ATM ang akong card. Unsa ang akong buhaton?',
      'Nawala ang akong bank card. Asa ang pinakadulom nga bangko?',
      'Maaari ko bang gamiton ang imong telepono? Emergency kini.',
      'Palihug maghulat diri uban nako.',
      'Kinahanglan kong tawagan ang laing nasud.',
    ],
  },
  ilo: {
    medical: [
      'Agtaray nga agtawag ti ambulansya.',
      'Masapul ko ti doktor.',
      'Saan ko a makapagna.',
      'Adda maysa a tao a nawad-an ti panagrikna / saan a mangina.',
      'Nabara unay ti dara na.',
      'Agantosak ti allergic reaction.',
      'Nakanka ti maysa a banag ket masakit ti tian ko.',
      'Masakit ti barukong ko.',
      'Sa panaghunahunak adda lagnat ko.',
      'Sadino ti pinakadupdup a pagtaengan ti maysa nga ospital?',
      'Sadino ti pinakadupdup a 24-oras a parmasya?',
      'Pangngaasi nga tulungan nak nga agtalinaed a natalinaed.',
      'Masapul ko ti wheelchair.',
    ],
    safety: [
      'Agtaray ti pulis!',
      'Tulong! Masapul ko ti tulong!',
      'Tulong! Mannakaw!',
      'Nakarawannak.',
      'Nakarawan ti pitakak / teleponok / pasaportek.',
      'Adda maysa a tao nga agsursuro kaniak.',
      'Pangngaasi nga baybay-an nak.',
      'Aginana ka manipud kaniak.',
      'Maaramidak a mabutbuteng.',
      'Kayat ko nga ireport ti krimen.',
      'Sadino ti pagtaengan ti pulis?',
      'Masapul ko nga agkontak iti embahada / konsulado ko.',
      'Nawala ti gayyem ko.',
      'Nawala ti anak ko. Saan ko nga mabirukan ida.',
    ],
    disaster: [
      'Gulog! Rummuar iti balay!',
      'Adda babala ti gulog?',
      'Sadino ti evacuation center?',
      'Natalged kadi ditoy?',
      'Tumataas ti danum. Adda baha kadi?',
      'Umay ti bagyo. Natalged kadi ti panagbiahe?',
      'Kakaiba ti aramid ti bulkang. Ania ti aramide mi?',
      'Sadino ti mabirukan ko ti nangato a lugar?',
      'Pangngaasi nga irugi ti emergency alert.',
    ],
    transport: [
      'Nasira ti traysikel / jeepney.',
      'Masapul ko ti mekaniko.',
      'Masapul ko ti tow truck.',
      'Naubosan mi ti gasolina.',
      'Pato ti ligid ko.',
      'Saan ti nagan ti dalan nga innala ti driver ti taksi.',
      'Pangngaasi nga usaren ti metro.',
      'Nalabes unay dayta. Pangngaasi nga ited ti umiso a gatad.',
      'Agdama ditoy. Kayat ko nga bumaba.',
      'Pangngaasi nga agmaneho ka a bassit. Saan a natalged.',
      'Sadino ti mabirukan ko ti mapagtalkan a taksi / Grab?',
      'Nalampasan ko ti flight / bus / barko ko.',
      'Nawala ti bagaje ko.',
    ],
    lost: [
      'Nawalaak.',
      'Saan ko a maammo no sadino ti hotel ko.',
      'Mabalin mo kadi nga tulungan nak nga biruken daytoy a pagtaengan?',
      'Mabalin mo kadi nga ipakita iti mapa?',
      'Natalged kadi ti aglakad ditoy?',
      'Adayo kadi manipud ditoy?',
      'Agsapulak ti pagtaengan ti pulis.',
      'Agsapulak ti ospital.',
      'Agsapulak ti publiko a palikuran.',
      'Ania a direksion ti sentro ti siudad?',
      'Pangngaasi nga isurat mo ti pagtaengan para kaniak.',
    ],
    comms: [
      'Agsasao ka kadi ti English?',
      'Pangngaasi nga agsasao ka a bassit.',
      'Saan ko a maawatan.',
      'Mabalin mo kadi nga uliten dayta?',
      'Mabalin mo kadi nga tulungan nak nga agtawag ti taksi?',
      'Patay ti baterya ti teleponok. Mabalin ko kadi nga mangutang ti charger?',
      'Saan nga aggapu ti mobile data ko. Adda kadi WiFi mo?',
      'Kinain ti ATM ti card ko. Ania ti aramidek?',
      'Nawala ti bank card ko. Sadino ti pinakadupdup ti bangko?',
      'Mabalin ko kadi nga usaren ti telepono mo? Emergency daytoy.',
      'Pangngaasi nga aguray ka ditoy a kaduak.',
      'Masapul ko nga agtawag iti sabali a pagilian.',
    ],
  },
  hil: {
    medical: [
      'Tawag dayon sang ambulansya.',
      'Kinahanglan ko sang doktor.',
      'Indi ako makapanghinga.',
      'May tawo nga nawad-an sang malay / indi manghinga.',
      'Grabing pagdugo niya.',
      'Nag-antos ako sang allergic reaction.',
      'Nakakaon ako sang isa ka butang kag masakit ang akon tiyan.',
      'Masakit ang akon dughan.',
      'Sa akon hunahuna may lagnat ako.',
      'Diin ang pinakaduol nga ospital?',
      'Diin ang pinakaduol nga 24-oras nga parmasya?',
      'Palihog buligan mo ako nga magpabilin nga hilom.',
      'Kinahanglan ko sang wheelchair.',
    ],
    safety: [
      'Tawag sang pulis!',
      'Tabang! Kinahanglan ko sang tabang!',
      'Tabang! Kawatan!',
      'Gin-awat ko.',
      'Gin-awat ang akon pitaka / telepono / pasaporte.',
      'May tawo nga nagsunod sa akon.',
      'Palihog biyaan mo ako.',
      'Pag-ikaw sa akon gawas.',
      'Ginapahimangno ko.',
      'Gusto ko nga mag-report sang krimen.',
      'Diin ang himpilan sang pulis?',
      'Kinahanglan ko nga makontak ang akon embahada / konsulado.',
      'Nawala ang akon amigo.',
      'Nawala ang akon anak. Indi ko sila makita.',
    ],
    disaster: [
      'Linog! Pag-ikaw sang balay!',
      'May babala ba sang linog?',
      'Diin ang evacuation center?',
      'Luwas ba diri?',
      'Tumataas ang tubig. May baha ba?',
      'Moabot ang bagyo. Luwas ba ang pagbiyahe?',
      'Kakaiba ang kalihokan sang bulkan. Ano ang among buhaton?',
      'Diin ko makakita sang mataas nga lugar?',
      'Palihog buhata ang mga emergency alert.',
    ],
    transport: [
      'Nasira ang traysikel / jeepney.',
      'Kinahanglan ko sang mekaniko.',
      'Kinahanglan ko sang tow truck.',
      'Naubusan mi sang gasolina.',
      'Pato ang akon ligid.',
      'Sayop nga dalan ang ginkuha sang driver sang taksi.',
      'Palihog gamita ang metro.',
      'Mahal na. Palihog hatagi sang patas nga presyo.',
      'Diritso na. Gusto ko nga mobaba.',
      'Palihog bagal ang pagmaneho. Indi luwas.',
      'Diin ko makakita sang kasaligan nga taksi / Grab?',
      'Nalampasan ko ang akon flight / bus / barko.',
      'Nawala ang akon bagahe.',
    ],
    lost: [
      'Nawala ako.',
      'Indi ko kahibalo diin ang akon hotel.',
      'Maaari ka bang buligan ko sa pagpangita niining address?',
      'Maaari ka bang ipakita sa mapa?',
      'Luwas ba ang paglakaw didto?',
      'Layo ba gikan diri?',
      'Nagpangita ko sang himpilan sang pulis.',
      'Nagpangita ko sang ospital.',
      'Nagpangita ko sang pampublikong palikuran.',
      'Ano nga direksyon ang sentro sang lungsod?',
      'Palihog sulata ang address para sa akon.',
    ],
    comms: [
      'Nagahambal ka ba sang English?',
      'Palihog hambal sang hinay.',
      'Indi ko maintindihan.',
      'Maaari ka bang uliton na?',
      'Maaari ka bang buligan ko sa pagtawag sang taksi?',
      'Patay na ang baterya sang akon telepono. Maaari ko bang manghulam sang charger?',
      'Indi nagagana ang akon mobile data. May ara ka bang WiFi?',
      'Ginkaon sang ATM ang akon card. Ano ang akon buhaton?',
      'Nawala ang akon bank card. Diin ang pinakaduol nga bangko?',
      'Maaari ko bang gamiton ang telepono mo? Emergency ini.',
      'Palihog maghulat diri uban nako.',
      'Kinahanglan ko nga magtawag sa iban nga nasud.',
    ],
  },
  pag: {
    medical: [
      'Tawagen yo agad so ambulansya.',
      'Masapul ko so doktor.',
      'Ali ko maka-pangasi.',
      'Walo so tao a nawad-an nen malay / ali mangasi.',
      'Grabing pagdugo na.',
      'Agantosak nen allergic reaction.',
      'Nakakan ko nen sakey a bengat kag masakit so tian ko.',
      'Masakit so barukong ko.',
      'Sa panaghunahunak walo lagnat ko.',
      'Nukarin so pinakamalapit a ospital?',
      'Nukarin so pinakamalapit a 24-oras a parmasya?',
      'Palihog tulongan nak a magmaliw ya natalinaed.',
      'Masapul ko so wheelchair.',
    ],
    safety: [
      'Tawagen yo so pulis!',
      'Tolong! Masapul ko so tulong!',
      'Tolong! Manakaw!',
      'Ginawat ak.',
      'Ginawat so pitakak / teleponok / pasaportek.',
      'Walo so tao a sumusunod kanak.',
      'Palihog biyayaan nak.',
      'Agiyan ka ed ak a gawa.',
      'Ginapahimangno ak.',
      'Gusto kong mag-report nen krimen.',
      'Nukarin so himpilan nen pulis?',
      'Masapul kong makontak so embahada / konsulado ko.',
      'Nawala so gayem ko.',
      'Nawala so anak ko. Ali ko sila makita.',
    ],
    disaster: [
      'Linog! Rumuaren yo ed bale!',
      'Walo ba babala nen linog?',
      'Nukarin so evacuation center?',
      'Natalged ya keni?',
      'Tumataas so danum. Walo ba baha?',
      'Umay so bagyo. Natalged ba so pagbiyahe?',
      'Kakaiba so kaliwa nen bulkang. Anto so aramiden mi?',
      'Nukarin so mabirukan ko nen mataas a lugar?',
      'Palihog buhaten yo so emergency alert.',
    ],
    transport: [
      'Nasira so traysikel / jeepney.',
      'Masapul ko so mekaniko.',
      'Masapul ko so tow truck.',
      'Naubusan mi nen gasolina.',
      'Pato so ligid ko.',
      'Ali so nagan nen dalan a inala nen driver nen taksi.',
      'Palihog gamiten yo so metro.',
      'Nalabes unay ya. Palihog itden yo so umiso a gatad.',
      'Agdama keni. Gusto kong bumaba.',
      'Palihog bagal so pagmaneho. Ali natalged.',
      'Nukarin so mabirukan ko nen mapagtalkan a taksi / Grab?',
      'Nalampasan ko so flight / bus / barko ko.',
      'Nawala so bagaje ko.',
    ],
    lost: [
      'Nawala ak.',
      'Ali ko ambo nukarin so hotel ko.',
      'Mabalin mo yang tulongan nak a biruken iraya a pagtaengan?',
      'Mabalin mo yang ipakita ed mapa?',
      'Natalged ba so paglakad keni?',
      'Adayo ba ed keni?',
      'Agsapulak nen himpilan nen pulis.',
      'Agsapulak nen ospital.',
      'Agsapulak nen publiko a palikuran.',
      'Anto so direksion nen sentro nen siudad?',
      'Palihog suraten yo so pagtaengan para kanak.',
    ],
    comms: [
      'Agsasalita ka ba ning English?',
      'Palihog salita yang hinay.',
      'Ali ko maintindihan.',
      'Mabalin mo yang uliten ya?',
      'Mabalin mo yang tulungan nak a tumawag ning taksi?',
      'Patay la reng baterya ning teleponok. Mabalin ko yang mangutang ning charger?',
      'Ali magana reng mobile data ko. Wala ka bang WiFi?',
      'Kinan ning ATM reng card ko. Anto reng dapat kong gawen?',
      'Nawala reng bank card ko. Nukarin reng pinakamalapit a bangko?',
      'Mabalin ko yang gamiton reng telepono mo? Emergency ya ini.',
      'Palihog maghintay ka keni a kaduak.',
      'Masapul kong tumawag king ibang nasyon.',
    ],
  },
  war: {},
  bik: {},
  pam: {},
  tsg: {},
};

/** Returns the translated phrase for the current dialect, falling back to English phrase. */
const getTranslatedPhrase = (categoryId: string, phraseIndex: number, fallbackEnglish: string): string => {
  const lang = getLangCode();
  return TRANSLATIONS[lang]?.[categoryId]?.[phraseIndex] ?? fallbackEnglish;
};

interface EpCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
  phrases: string[];
}

const EMERGENCY_CATEGORIES: EpCategory[] = [
  {
    id: 'medical',
    label: 'Medical',
    emoji: '🚑',
    color: '#dc2626',
    phrases: [
      'Call an ambulance immediately.',
      'I need a doctor.',
      "I can't breathe.",
      'Someone is unconscious / not breathing.',
      'They are bleeding heavily.',
      'I am having an allergic reaction.',
      'I ate something and I feel very sick.',
      'I have chest pain.',
      'I think I have a fever.',
      'Where is the nearest hospital?',
      'Where is the nearest 24-hour pharmacy?',
      'Please help me stay still.',
      'I need a wheelchair.',
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    emoji: '🚨',
    color: '#7c3aed',
    phrases: [
      'Call the police!',
      'Help! I need assistance!',
      'Help! Thief!',
      'I have been robbed.',
      'My wallet / phone / passport was stolen.',
      'Someone is following me.',
      'Please leave me alone.',
      'Stay away from me.',
      'I feel threatened.',
      'I want to report a crime.',
      'Where is the police station?',
      'I need to contact my embassy / consulate.',
      'My friend is missing.',
      "My child is lost. I can't find them.",
    ],
  },
  {
    id: 'disaster',
    label: 'Disaster',
    emoji: '🌀',
    color: '#0d9488',
    phrases: [
      'Earthquake! Get out of the building!',
      'Is there an earthquake warning?',
      'Where is the evacuation center?',
      'Is it safe to stay here?',
      'The water is rising. Is there a flood?',
      'A typhoon is coming. Is it safe to travel?',
      'The volcano is acting strange. What should we do?',
      'Where can I find high ground?',
      'Please turn on the emergency alerts.',
    ],
  },
  {
    id: 'transport',
    label: 'Transport',
    emoji: '🚗',
    color: '#ea580c',
    phrases: [
      'The tricycle / jeepney broke down.',
      'I need a mechanic.',
      'I need a tow truck.',
      'We ran out of gas.',
      'I have a flat tire.',
      'The taxi driver is taking the wrong route.',
      'Please use the meter.',
      'That is too expensive. Please give a fair price.',
      'Stop here. I want to get out.',
      'Please drive slowly. It feels unsafe.',
      'Where can I find a reliable taxi / Grab?',
      'I missed my flight / bus / ferry.',
      'My luggage is lost.',
    ],
  },
  {
    id: 'lost',
    label: 'Lost',
    emoji: '🗺️',
    color: '#0047ab',
    phrases: [
      'I am lost.',
      "I don't know where my hotel is.",
      'Can you help me find this address?',
      'Can you show me on a map?',
      'Is it safe to walk there?',
      'Is it far from here?',
      'I am looking for a police station.',
      'I am looking for a hospital.',
      'I am looking for a public restroom.',
      'Which direction is the city center?',
      'Please write down the address for me.',
    ],
  },
  {
    id: 'comms',
    label: 'Comms',
    emoji: '👥',
    color: '#db2777',
    phrases: [
      'Do you speak English?',
      'Please speak slowly.',
      "I don't understand.",
      'Can you please repeat that?',
      'Can you help me call a taxi?',
      'My phone battery is dead. Can I borrow a charger?',
      'My mobile data is not working. Do you have WiFi?',
      'The ATM ate my card. What should I do?',
      'I lost my bank card. Where is the nearest bank?',
      "Can I use your phone? It's an emergency.",
      'Please wait here with me.',
      'I need to make an international call.',
    ],
  },
];

interface EmergencyPhrasesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmergencyPhrasesModal: React.FC<EmergencyPhrasesModalProps> = ({ isOpen, onClose }) => {
  const [selectedCat, setSelectedCat] = useState<EpCategory | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<string | null>(null);

  const [langCode, setLangCode] = useState<string>(getLangCode);
  useEffect(() => {
    const onLangChanged = () => setLangCode(getLangCode());
    window.addEventListener('salintayo_lang_changed', onLangChanged);
    window.addEventListener('salintayo_qcb_lang_changed', onLangChanged);
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === QCB_LANG_KEY || e.key === LANG_KEY) setLangCode(getLangCode());
    });
    return () => {
      window.removeEventListener('salintayo_lang_changed', onLangChanged);
      window.removeEventListener('salintayo_qcb_lang_changed', onLangChanged);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedCat(null);
    } else {
      cancelSpeech();
      setSpeakingIdx(null);
    }
  }, [isOpen]);

  const handleBack = () => setSelectedCat(null);

  /** Spoken text uses translation when available so TTS matches the user’s preferred language; UI still shows English first. */
  const handleSpeak = useCallback(
    (textToSpeak: string, key: string) => {
      cancelSpeech();

      if (speakingIdx === key) {
        setSpeakingIdx(null);
        return;
      }

      setSpeakingIdx(key);

      speakText(textToSpeak, {
        onEnd: () => setSpeakingIdx(null),
        onError: () => setSpeakingIdx(null),
      });
    },
    [speakingIdx],
  );

  if (!isOpen) return null;

  if (!selectedCat) {
    return (
      <div className="ep-overlay ep-overlay--center" onClick={onClose}>
        <div className="ep-cat-card" onClick={(e) => e.stopPropagation()}>
          <div className="ep-header">
            <div className="ep-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="ep-header-text">
              <h2 className="ep-header-title">Emergency Phrases</h2>
              <p className="ep-header-sub">Choose a category</p>
            </div>
            <button className="ep-close-btn" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="ep-cat-grid">
            {EMERGENCY_CATEGORIES.map((cat, i) => (
              <button
                key={cat.id}
                className="ep-cat-tile"
                style={{ '--cat-color': cat.color, animationDelay: `${i * 0.05}s` } as React.CSSProperties}
                onClick={() => setSelectedCat(cat)}
              >
                <span className="ep-cat-tile__emoji">{cat.emoji}</span>
                <span className="ep-cat-tile__label">{cat.label}</span>
                <span className="ep-cat-tile__count">{cat.phrases.length}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-overlay ep-overlay--center" onClick={onClose}>
      <div className="ep-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ep-handle" />
        <div className="ep-header">
          <button className="ep-back-btn" onClick={handleBack} aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div
            className="ep-header-icon"
            style={{ background: `color-mix(in srgb, ${selectedCat.color} 14%, white)`, color: selectedCat.color }}
          >
            <span style={{ fontSize: '1.1rem' }}>{selectedCat.emoji}</span>
          </div>
          <div className="ep-header-text">
            <h2 className="ep-header-title">{selectedCat.label}</h2>
            <p className="ep-header-sub">
              {selectedCat.phrases.length} phrases · {LANG_LABEL_MAP[langCode] ?? langCode} · tap 🔊 to speak
            </p>
          </div>
          <button className="ep-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="ep-body">
          <div className="ep-card">
            {selectedCat.phrases.map((phrase, i) => {
              const key = `${selectedCat.id}-${i}`;
              const isSpeaking = speakingIdx === key;
              const translatedPhrase = getTranslatedPhrase(selectedCat.id, i, phrase);
              const showTranslation = langCode !== 'en' && translatedPhrase !== phrase;
              return (
                <div key={key} className={`ep-phrase ${isSpeaking ? 'ep-phrase--speaking' : ''}`}>
                  <span className="ep-phrase__text">
                    {phrase}
                    {showTranslation && <span className="ep-phrase__translation">{translatedPhrase}</span>}
                  </span>
                  <button
                    className={`ep-phrase__speak ${isSpeaking ? 'ep-phrase__speak--active' : ''}`}
                    aria-label="Speak phrase"
                    style={{ '--cat-color': selectedCat.color } as React.CSSProperties}
                    onClick={() => handleSpeak(translatedPhrase, key)}
                  >
                    {isSpeaking ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickChatBubble: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showEmergency, setShowEmergency] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const s = localStorage.getItem(POS_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    return { x: window.innerWidth - BUBBLE_SIZE - 16, y: window.innerHeight - 180 };
  });

  const bubbleRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  const enabledRef = useRef(isEnabled);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    const sync = () => {
      const next = localStorage.getItem(STORAGE_KEY) === 'true';
      setIsEnabled(next);
      enabledRef.current = next;
      if (!next) setShowEmergency(false);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
      if (e.key === LANG_KEY) cancelSpeech();
      if (e.key === QCB_LANG_KEY) cancelSpeech();
    };
    const onLangChanged = () => cancelSpeech();
    window.addEventListener('storage', onStorage);
    window.addEventListener('salintayo_qcb_changed', sync);
    window.addEventListener('salintayo_lang_changed', onLangChanged);
    window.addEventListener('salintayo_qcb_lang_changed', onLangChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('salintayo_qcb_changed', sync);
      window.removeEventListener('salintayo_lang_changed', onLangChanged);
      window.removeEventListener('salintayo_qcb_lang_changed', onLangChanged);
    };
  }, []);

  const setShowEmergencyRef = useRef(setShowEmergency);
  const setIsPulsingRef = useRef(setIsPulsing);
  const setIsDraggingRef = useRef(setIsDragging);
  const setPosRef = useRef(setPos);
  useEffect(() => {
    setShowEmergencyRef.current = setShowEmergency;
  });
  useEffect(() => {
    setIsPulsingRef.current = setIsPulsing;
  });
  useEffect(() => {
    setIsDraggingRef.current = setIsDragging;
  });
  useEffect(() => {
    setPosRef.current = setPos;
  });

  const ds = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  const savePos = (x: number, y: number) => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
    } catch {}
  };
  const persistEnabled = (val: boolean) => {
    setIsEnabled(val);
    enabledRef.current = val;
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {}
  };

  const onStartRef = useRef((clientX: number, clientY: number) => {
    const { x, y } = posRef.current;
    ds.current = { active: true, moved: false, startX: clientX, startY: clientY, originX: x, originY: y };
    if (enabledRef.current) {
      lpTimer.current = setTimeout(() => {
        if (!ds.current.moved) {
          longPressedRef.current = true;
          persistEnabled(false);
          setShowEmergencyRef.current(false);
          setTimeout(() => {
            longPressedRef.current = false;
          }, 600);
        }
      }, 700);
    }
  });

  const onMoveRef = useRef((clientX: number, clientY: number) => {
    if (!ds.current.active) return;
    const dx = clientX - ds.current.startX;
    const dy = clientY - ds.current.startY;
    if (!ds.current.moved) {
      if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
      ds.current.moved = true;
      setIsDraggingRef.current(true);
      if (lpTimer.current) clearTimeout(lpTimer.current);
    }
    const nx = clamp(ds.current.originX + dx, 4, window.innerWidth - BUBBLE_SIZE - 4);
    const ny = clamp(ds.current.originY + dy, 60, window.innerHeight - BUBBLE_SIZE - 4);
    setPosRef.current({ x: nx, y: ny });
    posRef.current = { x: nx, y: ny };
  });

  const onEndRef = useRef((clientX: number) => {
    if (!ds.current.active) return;
    if (lpTimer.current) clearTimeout(lpTimer.current);
    const wasMoved = ds.current.moved;
    ds.current.active = false;
    setIsDraggingRef.current(false);
    if (!wasMoved) {
      if (longPressedRef.current) return;
      if (!enabledRef.current) {
        persistEnabled(true);
        setShowEmergencyRef.current(true);
      } else {
        setIsPulsingRef.current(true);
        setTimeout(() => {
          setIsPulsingRef.current(false);
          setShowEmergencyRef.current(true);
        }, 200);
      }
    } else {
      const snapX = clientX < window.innerWidth / 2 ? 4 : window.innerWidth - BUBBLE_SIZE - 4;
      setPosRef.current({ x: snapX, y: posRef.current.y });
      posRef.current = { x: snapX, y: posRef.current.y };
      savePos(snapX, posRef.current.y);
    }
  });

  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const tStart = (e: TouchEvent) => {
      e.stopPropagation();
      onStartRef.current(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tMove = (e: TouchEvent) => {
      if (!ds.current.active) return;
      e.preventDefault();
      onMoveRef.current(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tEnd = (e: TouchEvent) => onEndRef.current(e.changedTouches[0].clientX);
    const mDown = (e: MouseEvent) => {
      e.preventDefault();
      onStartRef.current(e.clientX, e.clientY);
    };
    const mMove = (e: MouseEvent) => onMoveRef.current(e.clientX, e.clientY);
    const mUp = (e: MouseEvent) => onEndRef.current(e.clientX);
    el.addEventListener('touchstart', tStart, { passive: false });
    el.addEventListener('touchmove', tMove, { passive: false });
    el.addEventListener('touchend', tEnd);
    el.addEventListener('mousedown', mDown);
    window.addEventListener('mousemove', mMove);
    window.addEventListener('mouseup', mUp);
    return () => {
      el.removeEventListener('touchstart', tStart);
      el.removeEventListener('touchmove', tMove);
      el.removeEventListener('touchend', tEnd);
      el.removeEventListener('mousedown', mDown);
      window.removeEventListener('mousemove', mMove);
      window.removeEventListener('mouseup', mUp);
    };
  }, []);

  return (
    <>
      <div
        ref={bubbleRef}
        className={[
          'qcb-bubble',
          'qcb-bubble--on',
          isPulsing ? 'qcb-bubble--pulse' : '',
          isDragging ? 'qcb-bubble--dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ left: pos.x, top: pos.y, display: isEnabled ? 'flex' : 'none' }}
        role="button"
        aria-label="Emergency Phrases"
      >
        <div className="qcb-bubble__inner">
          <IonIcon icon={flashOutline} className="qcb-bubble__icon" />
          <span className="qcb-bubble__badge" />
        </div>
        <div className="qcb-bubble__ripple" />
      </div>

      <EmergencyPhrasesModal isOpen={showEmergency} onClose={() => setShowEmergency(false)} />
    </>
  );
};

export default QuickChatBubble;

