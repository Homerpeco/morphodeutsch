# MorphoDeutsch – Der Adjektiv-Baukasten

Fifth app in the German-learning set (SprintDeutsch, Karteikasten, DeutschTube, RecallDeutsch).
It teaches adjectives as **forms, families, phrases and choices**, not as lone translations.

Every adjective is shown split into colour-coded building blocks:
blue = base word, amber = linking element (Fugen-s), green = suffix / head, raspberry = prefix, violet = ge- of Partizip II.

## What it does
- **Starter deck**: the 17 Beruf & Arbeit adjectives from *Aspekte Beruf B2*, each with base word, blocks, word family,
  contrasts, typical nouns and example sentences (written fresh, with English translations).
- **Add** (like the Verb Meister App): type an adjective and the blocks, base word, element, spelling change
  (a → ä), family and Partizip partner are detected. Paste a whole list at once. Missing meanings come from MyMemory,
  missing example sentences from Tatoeba.
- **Review** (moves words between 6 boxes: today, 1, 3, 7, 14, 30 days) follows the learning loop:
  Deconstruct → Construct → Discriminate → Inflect → Collocate → Produce. Each word gets the exercise for its weakest skill.
- **Family-aware repetition**: a forgotten word goes back to box 1 and gets two follow-up questions later in the same
  session; a family or usage slip only moves it down one box; related words (same element or same family) are brought
  forward to tomorrow instead of being failed with it. Stats separate *forgot the word*, *family*, *usage* and *transfer* mistakes.
- **Drills** (do not move boxes): Derivation lab with transfer challenges (build words you have never seen from a known
  pattern), Partizip I vs II (37 sentences), adjective endings (generated from the nouns, incl. n-declension and plurals),
  opposites and near-synonyms, word families, words in context, prepositions + case, write your own.
- **Patterns**: 24 building elements with meaning, rules and 150+ example words; ending tables; Partizip I/II rule.
- **Data**: JSON backup, CSV export/import, cloud sync between devices.

## Files
| File | What |
|---|---|
| `index.html`, `styles.css` | page and design |
| `data.js` | `AFFIXES` (pattern library), `SEED` (starter deck), `PPAIRS` (Partizip sentences), `PROMPTS` |
| `engine.js` | grammar: declension, noun forms, block segmentation, word-formation detection, Partizip II guesses |
| `app.js` | app: storage, sync, practice engine, screens |
| `api/adjectives.js` | sync endpoint (Vercel Blob) |
| `sw.js`, `manifest.webmanifest`, `icons/` | installable on the phone, works offline |

Rule: every `parts` array must spell its word exactly (checked at start-up, error in the console otherwise).

## Storage and sync
- Browser: `localStorage` key **`morphodeutsch_v1`** (never rename). Sync key: `morphodeutsch_sync_key`.
- Cloud: `GET/PUT /api/adjectives`, one JSON document at `morphodeutsch/adjectives.json` in Vercel Blob.
  The app always merges before it writes: per word the newer `updatedAt` wins, deletions travel as tombstones,
  review log and pattern counters take the maximum. Starter words carry `updatedAt: 1`, so a fresh device never
  overwrites progress made elsewhere.

### Vercel settings
| Setting | Value |
|---|---|
| Framework preset | Other (no build command) |
| Storage | connect a Blob store (adds `BLOB_READ_WRITE_TOKEN`) |
| `SYNC_KEY` (env var) | any password; the app asks for it once per device (`VERB_SYNC_SECRET` also accepted) |

Without a Blob store the app still works fully; the badge then says **Local only**.
