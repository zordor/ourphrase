import { WORDS_ES } from "./dict-es.js";
import { WORDS_EN } from "./dict-en.js";

export const DICTIONARIES = {
  es: { code: "es", name: "Español", words: WORDS_ES },
  en: { code: "en", name: "English", words: WORDS_EN },
};

export function getDictionary(code) {
  const d = DICTIONARIES[code];
  if (!d) throw new Error("unknown language: " + code);
  return d;
}
