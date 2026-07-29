import { writeFile } from "node:fs/promises";
import { WORDS_ES } from "../js/dict-es.js";
import { WORDS_EN } from "../js/dict-en.js";

const output = new URL("../ios/OurPhrase/Resources/dictionaries.json", import.meta.url);
await writeFile(output, JSON.stringify({ es: WORDS_ES, en: WORDS_EN }));
