Hebrew Ulpan Vocabulary Quiz App - Final Current Specification

0. Product shape

One-page CodePen app for learning and remembering Hebrew words from Ulpan.

Delivery format:

index.html
style.css
script.js

The user will copy these three files into CodePen manually.

Constraints:

Frontend only.
Vanilla HTML, CSS, and JavaScript.
No backend.
No API keys.
No OAuth.
No accounts.
No build system.
No bundler.
No npm.
No external libraries.
External fonts are allowed only for the font-selection feature.
No local word cache.
Words are downloaded fresh from Google Sheet every time the page opens.
Only attempt history and app configuration are saved locally.

Primary device:

iPhone 13 or similarly small mobile screen.
One-hand mobile use should be comfortable.
Desktop can work, but mobile layout is primary.

The app is a recall-first quiz. It shows the question first, then reveals answer candidates either by user click or by automatic click after a configured delay.

⸻

1. Spreadsheet workflow

Words are stored in a Google Sheet.

The Sheet is publicly available for read access.

A small number of users can edit the Sheet through normal Google Sheets sharing permissions.

The Sheet may be updated multiple times per day.

The app assumes that spreadsheet content is maintained in Google Sheets. The app does not try to repair duplicate words, changed words, changed answers, missing tags, or similar content problems.

Edits in the Sheet work naturally according to the current data. No migration or special handling is required if someone later edits a word, niqqud, answer, description, tags, or row order.

⸻

2. JavaScript configuration constants

At the beginning of script.js, define default configuration constants.

The Google Sheet browser URL is a constant in the JS file.

The URL must be a normal Google Sheet browser URL containing:

/spreadsheets/d/<spreadsheet-id>/
gid=<sheet-gid>

The app uses the spreadsheet ID and gid.

No sheet name is needed.

Example shape:

const DEFAULT_CONFIG = {
  sheetUrl: "PASTE_GOOGLE_SHEET_BROWSER_URL_WITH_ID_AND_GID_HERE",
  directionMode: "random",
  showAnswersDelaySec: 0,
  autoNextDelaySec: 0,
  candidateMin: 3,
  candidateMax: 5,
  attemptCap: 20000
};

Rules:

sheetUrl is edited in code, not through UI.
Runtime user settings are saved in localStorage when changed in the settings panel.
Config defaults are constants at the beginning of script.js.

If the Sheet URL does not contain a spreadsheet ID or gid, handle it as a loading/configuration error:

show native alert
log details to console
stop normal app initialization

⸻

3. Data source

The app reads the Sheet using Google Visualization API.

Input:

A normal Google Sheet browser URL copied from the address bar.
The URL must include spreadsheet ID and gid.

The app converts that URL internally into a Visualization API URL.

Use JSON output.

Use tq to request only the needed columns.

Use headers=1 in the Visualization API URL.

The app can assume fixed column positions:

A: word
B: answer
C: description
D: tags

The query should select only these columns:

select A,B,C,D

The spreadsheet may contain extra columns for other purposes. Ignore them.

Row order in the Sheet does not matter.

Row 1 contains headers.

Data starts from row 2.

The Visualization API request must use headers=1.

Do not skip the first returned table row in code.

The returned table rows are treated as data rows because the API header parameter handles the sheet header row.

Empty or incomplete data rows are ignored:

After cleanup, if word is empty, ignore row.
After cleanup, if answer is empty, ignore row.
Do not show warnings for ignored rows.

If the response is malformed, blocked, inaccessible, missing, or cannot be parsed:

show a native alert with a short error message
log detailed error information to console
stop normal app initialization

Alert example:

Could not load vocabulary data. Please check the browser console for details.

The console should contain as much useful technical detail as practical.

⸻

4. Google Visualization API parsing

The app must parse Google Visualization API JSON/table output, not raw CSV.

The implementation must handle Google Visualization JSON wrapper/prefix format. This is part of normal load logic, not an error case by itself.

Reason:

A single spreadsheet cell may contain comma-separated values.
CSV can quote a whole cell that contains commas.
Commas inside one cell must not be treated as row/column separators.

For example, the tags cell may contain:

lesson/2026-05-27, nouns, school

This is one spreadsheet cell.

Only after reading the complete tags cell value should the app split it by comma.

Commas are prohibited inside tag names.

The app should read cell values from the structured table rows/cells returned by the Visualization API.

⸻

5. Spreadsheet schema

Fixed columns:

word | answer | description | tags

There is no meaning column.

There is no image column.

⸻

6. Spreadsheet columns

6.1 word

Hebrew word as written by the spreadsheet editor.

May contain niqqud.

Examples:

כִּתָּה
זוֹל
עוֹלֶה חָדָשׁ

Rules:

Niqqud is optional.
The app must never rely on niqqud existing.
The runtime word value preserves niqqud if it exists.
The app does not create or store a separate key/plain-word field.
The main quiz surface shows the word without niqqud as a visual transform only.
The info modal shows the cleaned spreadsheet word with niqqud if present.

6.2 answer

Main answer-side content.

Usually text:

class
cheap
new immigrant

The answer cell may also contain an image URL.

If the cleaned answer value starts with http, treat the whole field as an image URL.

Examples:

class
https://example.com/classroom.jpg

Rules:

answer is either text or image URL.
answer cannot contain both text and image URL for the same entity.
If answer starts with http, render it as an image.
If answer does not start with http, render it as text.
Do not validate image loading.
Just create an img tag and let the browser load or fail naturally.

answer text supports line breaks.

6.3 description

Optional free-text explanation.

Examples:

Can mean a classroom or a class/group of students.
Used for a person who recently immigrated to Israel.

Rules:

description is optional.
empty description is allowed.
description supports line breaks.
description is shown in the info modal.
description is not used for correctness.

6.4 tags

Comma-separated tags stored in one spreadsheet cell.

Examples:

lesson/2026-05-27, nouns, school
lesson/2026-05-27, grammar/adjectives
food, kitchen

Rules:

split tags by comma only after reading the complete spreadsheet cell
trim each tag after splitting
commas inside tag names are prohibited
empty tag entries are ignored
slash inside a tag is visual hierarchy only

This is one tag:

grammar/adjectives

not two tags.

Lesson dates are just tags:

lesson/2026-05-27

No separate lesson-date field.

⸻

7. Data cleanup

Think about this as cleanup, not semantic normalization.

The app should not rewrite spreadsheet content beyond simple cleanup needed for copied text safety.

Apply cleanup to:

word
answer

Do not apply aggressive cleanup to description and tags, except normal trimming where needed.

For word and answer:

trim leading/trailing whitespace
remove invisible bidi control marks
remove zero-width characters
preserve visible text
preserve niqqud
preserve punctuation
preserve spelling

For word:

normalize repeated whitespace-like characters to normal spaces

For answer:

preserve line breaks
normalize repeated horizontal whitespace-like characters to normal spaces within each line

Remove common invisible direction/control characters, including:

LRM / RLM
LRE / RLE
LRO / RLO
PDF
LRI / RLI / FSI / PDI
zero-width space
zero-width non-joiner
zero-width joiner
BOM / zero-width no-break space
word joiner

Rules:

do not remove niqqud from stored/runtime word values
do not remove cantillation marks from stored/runtime word values
do not stem
do not translate
do not lowercase or uppercase
do not auto-correct anything

Removing niqqud is allowed only as a visual transform when rendering the main quiz surface.

Correctness must use the cleaned stored values with niqqud preserved.

The cleanup process must be conservative.

Only remove characters that are clearly invisible copied-text dirt.

Do not perform magic normalization.

Niqqud and cantillation are part of the word identity and must remain in the cleaned stored word.

⸻

8. Runtime word object

The app may keep parsed row objects in memory for the current page session.

No local vocabulary cache.

Example runtime object:

{
  word: "כִּתָּה",
  answer: "class",
  answerKind: "text",
  description: "Can mean a classroom or a class/group of students.",
  tags: ["lesson/2026-05-27", "school", "nouns"]
}

Example when answer is an image URL:

{
  word: "כִּתָּה",
  answer: "https://example.com/classroom.jpg",
  answerKind: "image",
  description: "",
  tags: ["lesson/2026-05-27", "school", "nouns"]
}

There is no separate key field.

There is no separate plainWord field.

The cleaned word string is the word identity.

The app does not use row number, answer, generated ID, or a separate stable ID.

If a spreadsheet editor changes a word, the changed cleaned word is treated as the current identity.

Old attempts remain stored as they were and may no longer relate to the changed word.

Whenever the app needs to display Hebrew without niqqud, it derives that visual form from word at render time only.

⸻

9. Answer entity

The answer side is one entity based on the spreadsheet answer field.

If answer starts with http:

answer entity = image

Otherwise:

answer entity = text

The app has only two quiz sides:

Hebrew side
Answer side

There is no separate image quiz mode.

Answer-to-Hebrew mode is allowed even for image-only answers. In that case, the image is the question and the user chooses the Hebrew word.

⸻

10. Local saved data

The app saves two categories of local data:

attempt history
app configuration

Storage uses localStorage.

No vocabulary rows are saved locally.

Use versioned localStorage keys:

hebrew_vocab_attempts_v1
hebrew_vocab_config_v1

⸻

11. Attempt history

Storage:

localStorage key: hebrew_vocab_attempts_v1
value: JSON array of attempts

The array is append-only during normal use.

Rules:

append new attempts to the end
do not sort attempts
do not use timestamp for sequencing
use array order as the real learning sequence
use t only for statistics visualization

11.1 Attempt format

{
  t: 1779894123,
  word: "כִּתָּה",
  answer: "מוֹרֶה"
}

Fields:

t:
  Unix timestamp in seconds.
  Used only for statistics visualization.
word:
  Correct cleaned spreadsheet word.
answer:
  Selected cleaned spreadsheet word.

No response field.

No test field.

Correctness is derived:

attempt.answer === attempt.word

Mistake is derived:

attempt.answer !== attempt.word

In prose, “response” may mean the selected answer, but there is no stored response property.

11.2 Storage cap

Attempt history must be capped.

Hardcoded default:

20000 attempts

On append:

1. Add new attempt to the end.
2. If attempt count exceeds cap, remove oldest attempts from the beginning.
3. Save the trimmed array.

If localStorage write fails because storage is full:

show native alert
log full error to console
try to preserve most recent attempts if simple trimming is possible

No reset, export, or import feature.

⸻

12. App configuration

Configuration is saved in localStorage.

Storage:

localStorage key: hebrew_vocab_config_v1

Configuration includes:

{
  directionMode: "random",
  showAnswersDelaySec: 2,
  autoNextDelaySec: 0,
  candidateMin: 3,
  candidateMax: 5,
  selectedTagGroups: [[]],
  selectedFonts: []
}

Config defaults are constants at the beginning of script.js.

Runtime changes from the settings panel are saved to localStorage.

12.1 Direction mode

Allowed values:

random
hebrew-to-answer
answer-to-hebrew

Default:

random

Behavior:

random:
  for each new card, choose direction with 50/50 probability
hebrew-to-answer:
  always show Hebrew as question and answer entities as candidates
answer-to-hebrew:
  always show answer entity as question and Hebrew words as candidates

Direction is runtime-only and is not saved in attempts.

12.2 Show answers delay

The card always has a Show answers button.

Configuration:

showAnswersDelaySec: number

Rules:

default is 2 seconds
0 means auto-click Show answers immediately
maximum value is 60 seconds
user can always click Show answers manually before the timer fires
no countdown display
while the show-answer timer is running, animate a countdown border around the Show answers button
the animated countdown border is thicker than the normal button border

The max is intentionally large enough to support slow recall.

The timer should use the current configured value when the card is created.

12.3 Auto-next delay

The card always has a Next button.

Configuration:

autoNextDelaySec: number

Rules:

0 means auto-click Next immediately after a correct answer
maximum value is 60 seconds
user can always click Next manually before the timer fires
no countdown display
manual Next requires pressing/holding the Next button for 0.5 seconds
the Next button shows a press animation while it is being held

Important:

force no auto-next after a wrong answer

Reason:

after a wrong answer, the user needs enough time to see and remember the correct answer

If autoNextDelaySec is greater than 0 and the user answers wrong, use that duration only as a visual review countdown around the selected wrong card.

This wrong-answer countdown never advances the card automatically.

12.4 Candidate count

Candidate count is configurable.

Configuration:

candidateMin: number
candidateMax: number

Rules:

minimum practical value: 2
maximum allowed value: 10
default: 3 to 5
actual count is random between candidateMin and candidateMax
if current pool has fewer words, use the pool as-is

Settings UI can use two number inputs or similar simple controls.

If user sets invalid values:

clamp values to 2..10
if candidateMin > candidateMax, set candidateMax = candidateMin

⸻

13. Header/settings/statistics modal

The header contains a small button in the corner.

The main header title is randomly selected on each page load from hidden HTML title options.

Each non-default icon title has a 3% chance; 🇮🇱🧠 is used for the remaining chance.

The header summary is shown on the title line as:

x/y/z, i 🏷️

x = words in the current selected pool whose latest saved attempt is correct.
y = words in the current selected pool.
z = total loaded words.
i = selected tag count.

Clicking it opens a centered modal popup with backdrop.

The same modal-open/close logic can be reused for Info modals.

This combined modal contains:

spreadsheet link
statistics
direction mode
show answers delay
auto-next delay
candidate count min/max
tag selection
font selection

The panel is hidden by default.

Controls save configuration to localStorage.

Direction mode is shown as radio buttons.

Font selection is shown as checkboxes.

No separate pause/disable controls are needed beyond changing the settings values.

Suggested layout order:

spreadsheet link first
stats second
tags third
settings fourth

Font controls are shown inside the same Settings section as the other settings controls.

Changing settings affects new behavior immediately where reasonable.

Tag changes affect the next card/pool calculation. The current card does not need to be rebuilt immediately.

⸻

14. Quiz directions

There are two runtime quiz directions.

14.1 Hebrew -> answer

Question side:

Hebrew word

Rendered on the main card without niqqud as a visual transform.

Candidates:

answer entities from candidate words

Candidates with identical answer entities are collapsed before display.

For text answers, identical means the same cleaned answer text.

For image answers, identical means the same cleaned image URL.

If a duplicate-answer group contains the current correct word, keep the current correct word and discard the duplicate candidates.

Example:

Question:
כיתה
Candidate:
class

If user chooses the correct candidate:

{
  t: 1779894123,
  word: "כִּתָּה",
  answer: "כִּתָּה"
}

If user chooses “teacher”:

{
  t: 1779894123,
  word: "כִּתָּה",
  answer: "מוֹרֶה"
}

14.2 Answer -> Hebrew

Question side:

answer entity

Before choosing the current question word in answer-to-Hebrew mode, collapse words with identical answer entities.

For text answers, identical means the same cleaned answer text.

For image answers, identical means the same cleaned image URL.

Keep one word from each duplicate-answer group for question selection.

This prevents one visible answer-side question from having multiple correct Hebrew words.

Candidates:

Hebrew words

Hebrew candidates are rendered without niqqud on the main candidate surface as a visual transform.

Candidates with identical cleaned word values are collapsed before display.

For an answer-to-Hebrew card, do not include non-current candidate words that have the same answer entity as the current question word.

If any two Hebrew candidates in the same displayed set become identical after stripping niqqud, render all Hebrew candidates in that displayed set with niqqud preserved.

Saved format is exactly the same:

{
  t: 1779894123,
  word: "כִּתָּה",
  answer: "מוֹרֶה"
}

⸻

15. Card lifecycle

The quiz card is recall-first.

Lifecycle:

1. Select current word.
2. Select runtime direction according to directionMode.
3. Show question.
4. Show Info button on the question card.
5. Show Show answers button.
6. Show Next button.
7. Optionally auto-click Show answers after configured delay.
8. Reveal answer candidates.
9. Show Info button on each answer candidate card.
10. User may select answer candidate, or skip with Next.
11. If candidate is selected, save attempt.
12. Highlight correct and selected candidates.
13. User may click Next at any time.
14. If auto-next is enabled and answer was correct, optionally auto-click Next.
15. Select next word.

Next behavior:

If user clicks Next before selecting an answer:
  no attempt is saved
  skipped word gets no penalty or boost
  next word is selected
If user selects an answer:
  attempt is saved
  feedback is shown
  Next remains available
  later candidate taps on the same card do not save more attempts
If selected answer was correct:
  auto-next may run if enabled
If selected answer was wrong:
  auto-next is disabled for this card
  user must manually click Next

Timer behavior:

When moving to a new card, clear any pending Show answers timer and auto-next timer from the previous card.

When Show answers is clicked manually, clear the pending Show answers timer for that card.

When Next is clicked manually, clear pending timers for that card before rendering the next card.

Stale timers from an old card must not reveal answers, save attempts, or advance a newer card.

Show answers and Next controls are displayed before the question card.

Show answers and Next use the panel background.

Disabled controls use 0.3 opacity.

⸻

16. Info button

The app shows an Info button:

on the question card
on each answer candidate card

The button always exists and always works.

The visible label is the ℹ️ symbol.

The button is colorless:

75% transparent, grayscale icon treatment.

The button is positioned in the top right corner of the question card and each answer candidate card.

The button must be absolutely positioned and must not reserve text layout space in the card.

The button position is top: 0 and right: 0.

The click target is larger than the visible icon and uses the same border radius as emoji/icon buttons.

Info opens a centered modal popup with backdrop.

For the question card, Info opens information for the current correct word.

For a candidate card, Info opens information for that candidate word.

The info modal includes:

word as stored after cleanup, with niqqud if present, as modal title
answer
description
tags
detailed stats
answer spoiler

The info modal does not repeat the word in the modal body.

Tags are shown inline.

Description is hidden inside the same answer spoiler details because it may contain answer spoilers.

⸻

16.5 Hebrew text-to-speech

The app uses the browser built-in Web Speech API only.

No external text-to-speech service is used.

The app shows a text-to-speech button:

next to the word in the info modal title
on the upper left side of the question card, only when the question card shows a Hebrew word

The visible label is the 🔊 symbol.

The button is colorless:

75% transparent, grayscale icon treatment.

When clicked, the button reads the cleaned stored Hebrew word for that card or modal.

The spoken value preserves niqqud if present.

The speech utterance language is Hebrew:

he-IL

If browser speech synthesis is unavailable, clicking the button logs a console warning and does not change quiz state.

16.1 Info modal behavior

Rules:

centered popup with backdrop
close button is visible
clicking backdrop may close it
Escape may close it on desktop
content can scroll if needed

16.2 Answer display in info

If answer is text:

show answer text

If answer starts with http:

show it as an image
do not show the raw URL as the main content

The answer spoiler can be implemented with a native <details> element.

The closed label can be simple:

Show answer

Rules:

opening Info does not save an attempt
revealing the answer spoiler does not save an attempt
attempt is saved only when user selects an answer candidate

16.3 Tags in info

Show all tags for the info word.

Example:

lesson/2026-05-27
school
nouns

Slash may be displayed visually as hierarchy, but the tag remains the full string.

16.4 Stats in info

Stats for word W include all attempts where W appears in either field:

attempt.word === W || attempt.answer === W

This is important because any word can appear as the correct question word or as a selected wrong answer for another word.

Correct attempt:

attempt.answer === attempt.word

Mistake:

attempt.answer !== attempt.word

Stats should show at least:

total related attempts
times used as correct word
times selected as answer
correct attempts where this was the target word
wrong attempts where this was the target word
times this word was selected as a wrong answer for another word
recent related attempts
common confusions

Example:

כִּתָּה
As target:
  attempts: 7
  correct: 4
  wrong: 3
Selected as answer:
  total: 5
  correct selections: 4
  wrong selections: 1
Common confusions:
  answered מוֹרֶה for כִּתָּה: 2 times
  answered בַּיִת for כִּתָּה: 1 time

⸻

17. Showing answer candidates

The card always has a button:

Show answers

Behavior:

When card opens:
  Show answers button is visible.
If showAnswersDelaySec is configured:
  after N seconds, app behaves as if the user clicked Show answers.
When Show answers is clicked:
  reveal answer candidates.
No countdown.
No animation.

⸻

18. Candidate generation

Candidate generation uses only the current selected pool.

All logic is recalculated fresh when needed.

Do not cache candidate calculations.

Candidate count:

random number between candidateMin and candidateMax
maximum 10

If current pool is smaller than the requested count:

use the current pool as-is
show fewer candidates
do not fill from global words
do not treat this as an error

Candidates are shuffled every time they are shown.

After candidate generation, remove duplicate displayed candidate entities for the current direction.

Hebrew-to-answer candidate identity is the answer entity.

Answer-to-Hebrew candidate identity is the cleaned word value.

If duplicate removal would discard the current correct word, keep the current correct word and discard the duplicate non-current candidate instead.

Candidate generation priority:

1. correct answer
2. 1-2 previous wrong answers for this word, chosen from last 5 mistakes within current pool
3. 1-2 similar-looking/sounding words from current pool
4. random words from current selected pool until candidate count is reached

18.1 Correct answer

Always include current word.

18.2 Previous wrong answers

A previous mistake for current word W is:

attempt.word === W && attempt.answer !== W

Take the last 5 such mistakes in original array order.

Use only answers that still exist in the current selected pool.

Randomly select 1-2 unique answers.

Example history:

[
  { t: 1, word: "כִּתָּה", answer: "מוֹרֶה" },
  { t: 2, word: "כִּתָּה", answer: "בַּיִת" }
]

Future candidates for כִּתָּה may include:

מוֹרֶה
בַּיִת

18.3 Similar-looking/sounding words

Use a simple hardcoded Hebrew similarity algorithm.

This algorithm may use temporary comparison copies, but it must not change stored word values.

Multi-word phrases are compared as a single string.

For display/comparison copies only, the algorithm may strip niqqud.

Use hardcoded similar/sound-alike Hebrew letter groups.

Suggested groups:

א / ע
ב / ו
כ / ח / ק
ט / ת
ס / ש
פ / ף
צ / ץ
מ / ם
נ / ן
כ / ך

The scoring should stay simple.

Example idea:

exact same letter = high similarity
letter from same hardcoded group = partial similarity
different letter = low/no similarity
length difference reduces score

Pick similar words from the current selected pool only.

Do not over-engineer phonetics.

18.4 Random filler

If more candidates are needed:

add random words from current selected pool

Do not fill from global words outside the current pool.

⸻

19. Answer selection and feedback

When user selects a candidate, append this attempt to localStorage:

{
  t: currentUnixTimeSeconds,
  word: currentWord.word,
  answer: selectedCandidate.word
}

Correctness:

selectedCandidate.word === currentWord.word

Selection is one-shot per card.

Only the first candidate selection on a card appends an attempt.

Additional taps on candidate cards after selection are ignored for storage and correctness.

Feedback:

If correct:
  selected candidate card gets green background and green border.
If wrong:
  correct candidate card gets green background and green border.
  selected wrong candidate card gets red background and red border.

In wrong case, two cards are highlighted:

green = correct answer
red = selected wrong answer

This gives time to remember the correct answer visually.

Do not show text labels such as "Correct answer" or "Selected answer".

Color is enough for feedback.

Countdown border animation should move at constant linear speed around the element perimeter, so vertical and horizontal border progress are not distorted by element proportions.

Countdown border thickness is 4px.

⸻

20. Main card and candidate card layout

The app uses a mobile-first full-screen layout with a fixed-height header.

The page must not create a vertical scrollbar.

The app shell must use modern mobile viewport units and respect the iOS Safari bottom safe area.

Question card and candidate cards should adjust to the available height below the header.

Question cards have no background panel and no border.

Candidate cards keep their background panel and border.

Candidate cards should share the available candidate-list height evenly.

Candidate cards may be shown in one or two columns depending on available width and candidate count.

Do not make the page, quiz panel, or candidate list vertically scrollable.

Use container query units so card text size has a layout-safe fallback based on card size.

Card text elements opt into measured fitting with data-fit-text or .js-fit-text.

The measured fit-text utility chooses the largest font size that fits inside the existing card text area.

The fit-text utility may measure text and set font size, but must not create rows, columns, scrollbars, or otherwise control the card layout.

Refit card text after render, card size changes, viewport/orientation changes, font loads, dynamic text/card changes, and iOS Safari pageshow restoration.

Words must never be split in the middle. Phrases may wrap between words. If a too-long single word cannot fit, clipping is acceptable.

If text cannot fit at the minimum font size, keep the minimum font size and clip overflow.

When the Show answers button is disabled, its label is fully transparent.

On iPhone-size screens:

candidate cards may use one or two columns depending on available width
candidate list does not scroll
tap targets are large enough for one-handed mobile use

Image candidates should fit inside the same card size as text candidates.

Rules:

preserve image aspect ratio
do not stretch images
use object-fit: contain
keep card layout comfortable on iPhone 13

⸻

21. Tag filtering

User can filter study pool by tags.

Tags are generated from current Sheet rows.

Tag selection UI is inside the header/settings/statistics modal.

Tag selection uses scrollable checkbox lists.

The saved config shape is:

selectedTagGroups: [["school", "food"], ["lesson/2026-05-27"]]

Each inner array is one tag list.

Within one list, selected tags use OR logic.

Across lists, non-empty lists use AND logic.

Empty lists do not restrict the pool.

If every list is empty, quiz uses all words.

The first list always exists.

User can add another tag list.

User can remove any list except the first list.

Tag UI may show slash hierarchy visually.

Example tags:

lesson/2026-05-27
lesson/2026-05-28
grammar/adjectives
grammar/nouns
school
food

Visual display:

lesson
  2026-05-27
  2026-05-28
grammar
  adjectives
  nouns
school
food

Internally tags remain full strings:

lesson/2026-05-27
grammar/adjectives

Filter behavior:

word is included if it matches at least one selected tag from every non-empty list

Selected tag groups are saved in localStorage config.

Optional simple control:

clear selected tags

⸻

22. Tag sorting and counts

Tags are sorted alphabetically with numeric/date-friendly ordering.

Use a natural sort style, for example via Intl.Collator with numeric sorting.

For each tag in the selector, show two counts:

total words with this tag
words this checkbox would add to or remove from the current final result

For tag T:

total count = number of words that have T

Delta count:

compare final selected-pool size before toggling this checkbox to final selected-pool size after toggling this checkbox

Display the delta with a sign:

+N
-N
0

Also show total count for that tag.

Example display:

lesson/2026-05-27  18 total, +18
nouns              42 total, +7
school             12 total, +3

If toggling a selected tag would remove words from the final result:

show a negative delta

⸻

22.1 Font selection

Settings include font checkboxes.

Before each new card, randomly select one font from selectedFonts.

If selectedFonts is empty, select the first font.

Apply the selected font to question and candidate card text for that card.

When a font checkbox is checked, apply that font to the current visible question and answer candidates immediately.

When a font checkbox is unchecked and the current card uses that font, randomly select and apply another font from the current selectedFonts set immediately.

If selectedFonts becomes empty, apply the first font immediately.

Future cards still randomly select one font from selectedFonts before each new card.

The font list is:

system-ui, shown as "system font"
Playpen Sans Hebrew from Google Fonts with weight 100
Google Sans
Suez One
Tinos
Gveret Levin
Secular One
Bellefair
David Libre
דנה יד from freefont
מירי from freefont

Each font row shows the font name using that font, followed by space and:

אבגדה

Google Fonts and freefont web fonts are allowed for this feature.

⸻

23. Choosing next word

Next-word selection uses only the append-only attempt array order.

Do not use timestamps for sequencing.

The algorithm is not “choose bucket first, then choose word”.

Instead:

calculate candidate words from each weighting source
assign weights to words
sum weights per word
choose one word by weighted random

All calculations use only words in the current selected pool.

If the current pool is empty:

show an empty-state message
do not quiz

If no attempts exist:

choose random word from current pool

23.1 Correct and wrong attempts

Correct attempt:

attempt.answer === attempt.word

Wrong attempt:

attempt.answer !== attempt.word

23.2 Global fail streak

Global fail streak is the number of consecutive wrong attempts at the latest end of the attempt sequence.

Attempts are stored oldest-to-newest, so calculate by walking backward from the end of the array.

If the latest attempt is correct:

globalFailStreak = 0

If the latest attempt is wrong:

count latest consecutive wrong attempts until the first correct attempt is reached

Stored oldest-to-newest examples:

wrong, correct, correct -> 0
correct, wrong, wrong -> 2

Newer-to-older view of the same examples:

correct, correct, wrong -> 0
wrong, wrong, correct -> 2

23.3 Weight source 1: random coverage

For every word in the current selected pool:

add weight 5

Purpose:

keep quiz broad
avoid only drilling mistakes

23.4 Weight source 2: recent unresolved wrong words

Look at the last 5 wrong attempts whose word is still in the current selected pool.

For each wrong attempt, count successful attempts for that same word after that wrong attempt.

Base weight contribution:

5 if there are 0 later successful attempts for that word
2 if there is 1 later successful attempt for that word
1 if there are 2+ later successful attempts for that word

Apply global bad-feeling reducer:

final contribution = base contribution / (1 + globalFailStreak)

Add this contribution to that word.

Purpose:

repair recent mistakes,
but reduce difficult-word pressure when user is already on a failure streak

Duplicate appearances in the last 5 wrong attempts may naturally add more weight.

23.5 Weight source 3: delayed success check

Find successful attempts, newest to oldest.

Skip the last 3 successful attempts.

Take the next 3 successful attempts after that.

For each corresponding word still in the current selected pool, add weight.

Base contribution:

0.5

If latest attempt was successful:

contribution = 0.5

If latest attempt was wrong:

contribution = 0.5 * globalFailStreak

Purpose:

when user is failing repeatedly,
show more words they recently got right,
to reduce bad-feeling stack and restore momentum

23.6 Anti-repetition

Avoid showing the same word twice in a row unless pool is tiny.

Implementation can do this simply:

if pool size > 1, remove the previous shown word from the weighted set before selection

Skipped cards count as previous shown word for this anti-repetition rule, but skips are not saved as attempts.

If all weights somehow become zero:

fallback to random current-pool word

⸻

24. Statistics

Statistics are available in:

header/settings/statistics modal
Info modal for a word/candidate

Statistics are derived from:

current Sheet words
local attempt array

Use array order for sequence logic.

Use t only for time visualization.

Group daily/time stats using the browser local timezone.

Skipped cards are not saved and are not included in stats.

Possible stats:

total attempts
correct count
wrong count
accuracy
global fail streak
attempts by day
words never attempted
words with most wrong target attempts
words most often selected as wrong answer
common confusions
recent attempts

Correctness:

attempt.answer === attempt.word

Wrongness:

attempt.answer !== attempt.word

Related attempts for word W:

attempt.word === W || attempt.answer === W

⸻

25. Error handling

For unexpected technical errors:

show native alert with a short message
log detailed information to console
do not try complicated recovery

Example:

Something went wrong. Please check the browser console for details.

This applies to:

Google Sheet URL/id/gid extraction failure
Google Sheet fetch/parse failure
localStorage read/write failure
unexpected runtime errors where reasonable

If config save fails:

show alert
log details to console
continue with in-memory settings if possible

If attempt save fails after user answers:

show alert
log details to console
still show feedback
allow continuing if possible

⸻

26. Data validation policy

The clean app does not validate or repair spreadsheet data.

Spreadsheet problems are cleaned in Google Sheets.

The app does not need dedicated validation UI for:

duplicate words
changed words
changed answers
missing descriptions
missing tags
bad image URLs
small candidate pools

Behavior should be best-effort:

render what exists
do not block the quiz because of spreadsheet quality issues
do not show validation warnings

If the current pool has too few candidate words:

use the pool as-is

Rows with empty word or empty answer after cleanup are excluded silently.

⸻

27. Accessibility and mobile comfort

Rules:

buttons should have visible text labels, not only icons
button text should not be selectable
tap targets should be comfortable on iPhone 13
feedback should use both color and text labels
content should remain usable with one hand
candidate list may scroll
modals may scroll

Hebrew text on cards should be large.

The UI may be LTR overall, with Hebrew text displayed naturally.

⸻

28. Implementation style

JavaScript:

one script.js file
plain functions
one simple shared state object is acceptable
no framework
no modules required
no external libraries
comments allowed for tricky parts only

Comment especially tricky parts:

Google Visualization API JSON wrapper parsing
text cleanup
weighted next-word selection
candidate generation

HTML:

index.html contains markup and links to style.css and script.js

CSS:

style.css contains mobile-first styling
no external fonts
no CSS framework

⸻

29. Non-goals

Do not implement:

backend
Google OAuth
Google API keys
manual word IDs
local word cache
accounts
sync between devices
typed Hebrew input
typed translation input
real spaced repetition intervals
audio quiz
separate lesson date field
full Anki-style scheduling
complex phonetic matching
AI-generated examples
reset history
export/import
