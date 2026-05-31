const DEFAULT_CONFIG = {
  sheetUrl: "https://docs.google.com/spreadsheets/d/1fCxoKggBgR4ueRTf6YEBM72_ENQe3h8j7UaccUIZVfg/edit?gid=0#gid=0",
  directionMode: "random",
  showAnswersDelaySec: 0,
  autoNextDelaySec: 0,
  candidateMin: 3,
  candidateMax: 5,
  attemptCap: 20000
};

const ATTEMPTS_KEY = "hebrew_vocab_attempts_v1";
const CONFIG_KEY = "hebrew_vocab_config_v1";
const MIN_CANDIDATES = 2;
const MAX_CANDIDATES = 10;
const MAX_DELAY_SEC = 60;
const SHEET_QUERY = "select A,B,C,D";
const HEBREW_MARKS_RE = /[\u0591-\u05C7]/g;
const INVISIBLE_DIRT_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u2060]/g;
const HORIZONTAL_SPACE_RE = /[ \t\f\v\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g;
const ANY_SPACE_RE = /\s+/g;
const NEXT_HOLD_MS = 1000;
const FONT_SAMPLE = "אבגדה";
const FONT_OPTIONS = [
  { key: "system", label: "system font", family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", weight: "700" },
  { key: "playpen-sans-hebrew", label: "Playpen Sans Hebrew", family: "'Playpen Sans Hebrew', cursive", weight: "100" },
  { key: "google-sans", label: "Google Sans", family: "'Google Sans', Arial, sans-serif", weight: "700" },
  { key: "suez-one", label: "Suez One", family: "'Suez One', serif", weight: "400" },
  { key: "tinos", label: "Tinos", family: "'Tinos', serif", weight: "700" },
  { key: "gveret-levin", label: "Gveret Levin", family: "'Gveret Levin', cursive", weight: "400" },
  { key: "secular-one", label: "Secular One", family: "'Secular One', sans-serif", weight: "400" },
  { key: "bellefair", label: "Bellefair", family: "'Bellefair', serif", weight: "400" },
  { key: "david-libre", label: "David Libre", family: "'David Libre', serif", weight: "700" },
  { key: "dana-yad", label: "דנה יד", family: "'Dana Yad', 'דנה יד', cursive", weight: "400" },
  { key: "miri", label: "מירי", family: "'Miri', 'מירי', sans-serif", weight: "400" }
];

const state = {
  words: [],
  attempts: [],
  config: {},
  currentPool: [],
  currentCard: null,
  previousShownWord: null,
  cardSeq: 0,
  showTimer: null,
  nextTimer: null,
  nextHoldTimer: null,
  wrongTimer: null,
  currentFont: FONT_OPTIONS[0],
  unexpectedAlertShown: false
};

const els = {};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("error", function (event) {
  if (!state.unexpectedAlertShown) {
    state.unexpectedAlertShown = true;
    alertAndLog("Something went wrong. Please check the browser console for details.", event.error || event.message);
  }
});
window.addEventListener("unhandledrejection", function (event) {
  if (!state.unexpectedAlertShown) {
    state.unexpectedAlertShown = true;
    alertAndLog("Something went wrong. Please check the browser console for details.", event.reason);
  }
});
async function init() {
  collectElements();
  bindStaticEvents();
  showStatus("Loading vocabulary...");

  try {
    state.config = loadConfig();
    state.attempts = loadAttempts();
    const sheetParts = parseSheetUrl(DEFAULT_CONFIG.sheetUrl);
    const words = await loadVocabulary(sheetParts);
    state.words = words;
    renderPoolSummary();
    renderNextCard();
  } catch (error) {
    showStatus("Could not load vocabulary data.");
    alertAndLog("Could not load vocabulary data. Please check the browser console for details.", error);
  }
}

function collectElements() {
  els.appTitle = document.getElementById("appTitle");
  els.poolSummary = document.getElementById("poolSummary");
  els.settingsButton = document.getElementById("settingsButton");
  els.statusPanel = document.getElementById("statusPanel");
  els.quizPanel = document.getElementById("quizPanel");
  els.questionInfoButton = document.getElementById("questionInfoButton");
  els.questionContent = document.getElementById("questionContent");
  els.showAnswersButton = document.getElementById("showAnswersButton");
  els.nextButton = document.getElementById("nextButton");
  els.candidateList = document.getElementById("candidateList");
  els.modalBackdrop = document.getElementById("modalBackdrop");
  els.modalTitle = document.getElementById("modalTitle");
  els.modalBody = document.getElementById("modalBody");
  els.modalCloseButton = document.getElementById("modalCloseButton");
}

function bindStaticEvents() {
  selectAppTitle();
  els.settingsButton.addEventListener("click", openSettingsModal);
  els.questionInfoButton.addEventListener("click", function () {
    if (state.currentCard) {
      openInfoModal(state.currentCard.word);
    }
  });
  els.showAnswersButton.addEventListener("click", function () {
    if (state.currentCard) {
      revealAnswers(state.currentCard.id);
    }
  });
  els.nextButton.addEventListener("pointerdown", startNextHold);
  els.nextButton.addEventListener("pointerup", cancelNextHold);
  els.nextButton.addEventListener("pointerleave", cancelNextHold);
  els.nextButton.addEventListener("pointercancel", cancelNextHold);
  els.nextButton.addEventListener("keydown", function (event) {
    if ((event.key === " " || event.key === "Enter") && !state.nextHoldTimer) {
      event.preventDefault();
      startNextHold();
    }
  });
  els.nextButton.addEventListener("keyup", function (event) {
    if (event.key === " " || event.key === "Enter") {
      cancelNextHold();
    }
  });
  els.nextButton.addEventListener("click", function (event) {
    event.preventDefault();
  });
  els.modalCloseButton.addEventListener("click", closeModal);
  els.modalBackdrop.addEventListener("click", function (event) {
    if (event.target === els.modalBackdrop) {
      closeModal();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !els.modalBackdrop.hidden) {
      closeModal();
    }
  });
}

function selectAppTitle() {
  const options = Array.from(els.appTitle.querySelectorAll(".title-option"));
  const defaultOption = options.find(function (option) {
    return option.hasAttribute("data-title-default");
  });
  let roll = Math.random() * 100;
  let selected = defaultOption || options[0];

  options.forEach(function (option) {
    const weight = Number(option.getAttribute("data-title-weight") || 0);
    if (weight > 0 && roll >= 0 && roll < weight) {
      selected = option;
    }
    roll -= weight;
  });

  options.forEach(function (option) {
    option.hidden = option !== selected;
  });
}

function parseSheetUrl(sheetUrl) {
  let url;
  try {
    url = new URL(sheetUrl);
  } catch (error) {
    throw new Error("Invalid Google Sheet URL: " + String(error && error.message ? error.message : error));
  }

  const idMatch = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : "";
  let gid = url.searchParams.get("gid") || "";
  if (!gid && url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    gid = hashParams.get("gid") || "";
  }

  if (!spreadsheetId || !gid) {
    throw new Error("Google Sheet URL must contain /spreadsheets/d/<spreadsheet-id>/ and gid=<sheet-gid>.");
  }

  return { spreadsheetId: spreadsheetId, gid: gid };
}

function buildVisualizationUrl(sheetParts) {
  const base = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetParts.spreadsheetId) + "/gviz/tq";
  const params = new URLSearchParams({
    gid: sheetParts.gid,
    headers: "1",
    tqx: "out:json",
    tq: SHEET_QUERY
  });
  return base + "?" + params.toString();
}

async function loadVocabulary(sheetParts) {
  const url = buildVisualizationUrl(sheetParts);
  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("Google Sheet fetch failed", { url: url, error: error });
    throw error;
  }

  if (!response.ok) {
    const text = await response.text().catch(function () {
      return "";
    });
    console.error("Google Sheet fetch returned a non-OK response", {
      url: url,
      status: response.status,
      statusText: response.statusText,
      bodyPreview: text.slice(0, 500)
    });
    throw new Error("Google Sheet fetch failed with status " + response.status + ".");
  }

  const text = await response.text();
  const table = parseVisualizationTable(text);
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const words = [];

  for (const row of rows) {
    const cells = Array.isArray(row.c) ? row.c : [];
    const word = cleanWord(cellValue(cells[0]));
    const answer = cleanAnswer(cellValue(cells[1]));
    if (!word || !answer) {
      continue;
    }
    const description = String(cellValue(cells[2])).trim();
    const tags = parseTags(cellValue(cells[3]));
    words.push({
      word: word,
      answer: answer,
      answerKind: answer.startsWith("http") ? "image" : "text",
      description: description,
      tags: tags
    });
  }

  return words;
}

// Google returns JavaScript wrapped as google.visualization.Query.setResponse(...).
function parseVisualizationTable(text) {
  const marker = "google.visualization.Query.setResponse(";
  const start = text.indexOf(marker);
  if (start === -1) {
    console.error("Visualization response missing expected wrapper", { bodyPreview: text.slice(0, 500) });
    throw new Error("Malformed Google Visualization response.");
  }

  const jsonStart = start + marker.length;
  const jsonEnd = text.lastIndexOf(");");
  if (jsonEnd <= jsonStart) {
    console.error("Visualization response wrapper could not be sliced", { bodyPreview: text.slice(0, 500) });
    throw new Error("Malformed Google Visualization response.");
  }

  let payload;
  try {
    payload = JSON.parse(text.slice(jsonStart, jsonEnd));
  } catch (error) {
    console.error("Visualization response JSON parse failed", {
      error: error,
      bodyPreview: text.slice(0, 500)
    });
    throw error;
  }

  if (!payload || payload.status !== "ok" || !payload.table) {
    console.error("Visualization response status was not ok", payload);
    throw new Error("Google Visualization response status was not ok.");
  }

  return payload.table;
}

function cellValue(cell) {
  if (!cell) {
    return "";
  }
  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v);
  }
  if (cell.f !== undefined && cell.f !== null) {
    return String(cell.f);
  }
  return "";
}

// Cleanup is intentionally conservative: remove copied-text dirt, not meaning.
function cleanWord(value) {
  return String(value)
    .replace(INVISIBLE_DIRT_RE, "")
    .trim()
    .replace(ANY_SPACE_RE, " ");
}

function cleanAnswer(value) {
  return String(value)
    .replace(INVISIBLE_DIRT_RE, "")
    .trim()
    .split(/\r\n|\r|\n/)
    .map(function (line) {
      return line.replace(HORIZONTAL_SPACE_RE, " ").trim();
    })
    .join("\n");
}

function parseTags(value) {
  return String(value)
    .trim()
    .split(",")
    .map(function (tag) {
      return tag.trim();
    })
    .filter(Boolean);
}

function loadConfig() {
  const defaults = {
    directionMode: DEFAULT_CONFIG.directionMode,
    showAnswersDelaySec: DEFAULT_CONFIG.showAnswersDelaySec,
    autoNextDelaySec: DEFAULT_CONFIG.autoNextDelaySec,
    candidateMin: DEFAULT_CONFIG.candidateMin,
    candidateMax: DEFAULT_CONFIG.candidateMax,
    selectedTagGroups: [[]],
    selectedFonts: []
  };

  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      return clampConfig(defaults);
    }
    const parsed = JSON.parse(raw);
    return clampConfig(Object.assign({}, defaults, parsed));
  } catch (error) {
    alertAndLog("Something went wrong. Please check the browser console for details.", error);
    return clampConfig(defaults);
  }
}

function saveConfig() {
  const configToStore = {
    directionMode: state.config.directionMode,
    showAnswersDelaySec: state.config.showAnswersDelaySec,
    autoNextDelaySec: state.config.autoNextDelaySec,
    candidateMin: state.config.candidateMin,
    candidateMax: state.config.candidateMax,
    selectedTagGroups: state.config.selectedTagGroups,
    selectedFonts: state.config.selectedFonts
  };

  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(configToStore));
  } catch (error) {
    alertAndLog("Something went wrong. Please check the browser console for details.", error);
  }
}

function clampConfig(config) {
  const next = Object.assign({}, config);
  if (!["random", "hebrew-to-answer", "answer-to-hebrew"].includes(next.directionMode)) {
    next.directionMode = "random";
  }
  next.showAnswersDelaySec = clampNumber(next.showAnswersDelaySec, 0, MAX_DELAY_SEC, 0);
  next.autoNextDelaySec = clampNumber(next.autoNextDelaySec, 0, MAX_DELAY_SEC, 0);
  next.candidateMin = clampNumber(next.candidateMin, MIN_CANDIDATES, MAX_CANDIDATES, DEFAULT_CONFIG.candidateMin);
  next.candidateMax = clampNumber(next.candidateMax, MIN_CANDIDATES, MAX_CANDIDATES, DEFAULT_CONFIG.candidateMax);
  if (next.candidateMin > next.candidateMax) {
    next.candidateMax = next.candidateMin;
  }
  if (Array.isArray(next.selectedTagGroups)) {
    next.selectedTagGroups = next.selectedTagGroups.map(function (group) {
      return Array.isArray(group) ? cleanTagSelection(group) : [];
    });
  } else if (Array.isArray(next.selectedTags)) {
    next.selectedTagGroups = [cleanTagSelection(next.selectedTags)];
  } else {
    next.selectedTagGroups = [[]];
  }
  if (next.selectedTagGroups.length === 0) {
    next.selectedTagGroups = [[]];
  }
  if (!Array.isArray(next.selectedFonts)) {
    next.selectedFonts = [];
  }
  next.selectedFonts = next.selectedFonts.filter(function (fontKey) {
    return FONT_OPTIONS.some(function (font) {
      return font.key === fontKey;
    });
  });
  return next;
}

function cleanTagSelection(tags) {
  return Array.from(new Set(tags.filter(function (tag) {
    return typeof tag === "string" && tag.trim();
  })));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function loadAttempts() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isAttemptShape);
  } catch (error) {
    alertAndLog("Something went wrong. Please check the browser console for details.", error);
    return [];
  }
}

function isAttemptShape(value) {
  return value &&
    typeof value.t === "number" &&
    typeof value.word === "string" &&
    typeof value.answer === "string";
}

function appendAttempt(attempt) {
  const capped = state.attempts.concat([attempt]).slice(-DEFAULT_CONFIG.attemptCap);
  state.attempts = capped;

  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(capped));
  } catch (error) {
    console.error("Attempt save failed", error);
    const smaller = capped.slice(-Math.max(1, Math.floor(DEFAULT_CONFIG.attemptCap / 2)));
    try {
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(smaller));
      state.attempts = smaller;
    } catch (secondError) {
      console.error("Attempt save retry failed", secondError);
    }
    alert("Could not save attempt history. Please check the browser console for details.");
  }
  renderPoolSummary();
}

function renderNextCard() {
  clearTimers();
  closeModal();
  state.currentPool = getSelectedPool();
  renderPoolSummary();

  if (state.currentPool.length === 0) {
    state.currentCard = null;
    els.quizPanel.hidden = true;
    showStatus("No words match the selected tags.");
    return;
  }

  hideStatus();
  const id = ++state.cardSeq;
  const direction = chooseDirection();
  const questionPool = getQuestionPoolForDirection(state.currentPool, direction);
  const word = chooseNextWord(questionPool, state.previousShownWord);
  const candidatePool = getCandidatePoolForCard(state.currentPool, word, direction);
  const candidates = generateCandidates(word, candidatePool, direction);
  const showHebrewNiqqud = direction === "answer-to-hebrew" && hasStrippedHebrewCollision(candidates);
  const font = chooseCardFont();

  state.previousShownWord = word.word;
  state.currentFont = font;
  state.currentCard = {
    id: id,
    word: word,
    direction: direction,
    candidates: candidates,
    font: font,
    showHebrewNiqqud: showHebrewNiqqud,
    answersShown: false,
    selectedWord: null
  };

  renderQuestion();
  renderCandidates();
  els.quizPanel.hidden = false;
  els.showAnswersButton.disabled = false;
  els.showAnswersButton.classList.remove("countdown-active");
  scheduleShowAnswers(id);
}

function showStatus(message) {
  els.statusPanel.textContent = message;
  els.statusPanel.hidden = false;
  els.quizPanel.hidden = true;
}

function hideStatus() {
  els.statusPanel.hidden = true;
}

function renderPoolSummary() {
  const total = state.words.length;
  const selectedPool = getSelectedPool();
  const selected = selectedPool.length;
  const known = countWordsWithLatestGoodAttempt(selectedPool);
  const tagCount = getSelectedTagCount(state.config.selectedTagGroups);
  clearNode(els.poolSummary);
  els.poolSummary.appendChild(document.createTextNode(known + "/" + selected + "/" + total + ", " + tagCount + " "));
  const tagIcon = document.createElement("span");
  tagIcon.className = "summary-tag-icon";
  tagIcon.textContent = "🏷️";
  els.poolSummary.appendChild(tagIcon);
}

function getSelectedPool() {
  return filterWordsByTagGroups(state.words, state.config.selectedTagGroups);
}

function filterWordsByTagGroups(words, tagGroups) {
  const activeGroups = getActiveTagGroups(tagGroups);
  if (activeGroups.length === 0) {
    return words.slice();
  }
  return words.filter(function (word) {
    return activeGroups.every(function (group) {
      const selectedSet = new Set(group);
      return word.tags.some(function (tag) {
        return selectedSet.has(tag);
      });
    });
  });
}

function getActiveTagGroups(tagGroups) {
  return (Array.isArray(tagGroups) ? tagGroups : [[]]).filter(function (group) {
    return Array.isArray(group) && group.length > 0;
  });
}

function getSelectedTagCount(tagGroups) {
  return (Array.isArray(tagGroups) ? tagGroups : [[]]).reduce(function (total, group) {
    return total + (Array.isArray(group) ? group.length : 0);
  }, 0);
}

function countWordsWithLatestGoodAttempt(words) {
  return words.filter(function (word) {
    for (let i = state.attempts.length - 1; i >= 0; i -= 1) {
      const attempt = state.attempts[i];
      if (attempt.word === word.word) {
        return attempt.answer === attempt.word;
      }
    }
    return false;
  }).length;
}

function getQuestionPoolForDirection(pool, direction) {
  if (direction !== "answer-to-hebrew") {
    return pool;
  }

  const byQuestion = new Map();
  for (const word of pool) {
    const identity = answerIdentity(word);
    if (!byQuestion.has(identity)) {
      byQuestion.set(identity, word);
    }
  }
  return Array.from(byQuestion.values());
}

function getCandidatePoolForCard(pool, currentWord, direction) {
  if (direction !== "answer-to-hebrew") {
    return pool;
  }

  const currentQuestionIdentity = answerIdentity(currentWord);
  return pool.filter(function (word) {
    return word.word === currentWord.word || answerIdentity(word) !== currentQuestionIdentity;
  });
}

function chooseDirection() {
  if (state.config.directionMode === "random") {
    return Math.random() < 0.5 ? "hebrew-to-answer" : "answer-to-hebrew";
  }
  return state.config.directionMode;
}

function chooseCardFont() {
  const available = getSelectedFontOptions();
  return available.length ? randomItem(available) : FONT_OPTIONS[0];
}

function getSelectedFontOptions() {
  const selected = state.config.selectedFonts || [];
  return selected
    .map(function (fontKey) {
      return FONT_OPTIONS.find(function (font) {
        return font.key === fontKey;
      });
    })
    .filter(Boolean);
}

function applyCurrentCardFontChange(changedFont, checked) {
  if (!state.currentCard) {
    return;
  }

  const available = getSelectedFontOptions();
  const currentFontStillSelected = available.some(function (font) {
    return font.key === state.currentCard.font.key;
  });
  let nextFont = state.currentCard.font;

  if (checked) {
    nextFont = changedFont;
  } else if (!currentFontStillSelected) {
    nextFont = available.length ? randomItem(available) : FONT_OPTIONS[0];
  }

  if (nextFont.key === state.currentCard.font.key) {
    return;
  }

  state.currentCard.font = nextFont;
  state.currentFont = nextFont;
  applyFontToVisibleCardText(nextFont);
}

function applyFontToVisibleCardText(font) {
  applyFontToElement(els.questionContent, font);
  document.querySelectorAll(".candidate-choice").forEach(function (element) {
    applyFontToElement(element, font);
  });
}

// Weighted next-word selection uses attempt array order, never timestamps.
function chooseNextWord(pool, previousShownWord) {
  if (state.attempts.length === 0) {
    return randomItem(pool);
  }

  const weights = new Map();
  for (const word of pool) {
    weights.set(word.word, (weights.get(word.word) || 0) + 5);
  }

  const poolWords = new Set(pool.map(function (word) {
    return word.word;
  }));
  const failStreak = getGlobalFailStreak(state.attempts);
  const recentWrong = state.attempts.filter(function (attempt) {
    return attempt.answer !== attempt.word && poolWords.has(attempt.word);
  }).slice(-5);

  for (const wrongAttempt of recentWrong) {
    const wrongIndex = state.attempts.indexOf(wrongAttempt);
    let laterSuccesses = 0;
    for (let i = wrongIndex + 1; i < state.attempts.length; i += 1) {
      const attempt = state.attempts[i];
      if (attempt.word === wrongAttempt.word && attempt.answer === attempt.word) {
        laterSuccesses += 1;
      }
    }
    const base = laterSuccesses === 0 ? 5 : laterSuccesses === 1 ? 2 : 1;
    weights.set(wrongAttempt.word, (weights.get(wrongAttempt.word) || 0) + base / (1 + failStreak));
  }

  const successes = state.attempts.filter(function (attempt) {
    return attempt.answer === attempt.word;
  }).reverse().slice(3, 6);
  const latestWasWrong = state.attempts.length > 0 && state.attempts[state.attempts.length - 1].answer !== state.attempts[state.attempts.length - 1].word;
  for (const success of successes) {
    if (poolWords.has(success.word)) {
      const contribution = latestWasWrong ? 0.5 * failStreak : 0.5;
      weights.set(success.word, (weights.get(success.word) || 0) + contribution);
    }
  }

  if (pool.length > 1 && previousShownWord) {
    weights.delete(previousShownWord);
  }

  const choices = pool.filter(function (word) {
    return weights.has(word.word) && weights.get(word.word) > 0;
  });
  if (choices.length === 0) {
    const fallbackPool = pool.length > 1 && previousShownWord
      ? pool.filter(function (word) { return word.word !== previousShownWord; })
      : pool;
    return randomItem(fallbackPool.length ? fallbackPool : pool);
  }

  const totalWeight = choices.reduce(function (total, word) {
    return total + weights.get(word.word);
  }, 0);
  let roll = Math.random() * totalWeight;
  for (const word of choices) {
    roll -= weights.get(word.word);
    if (roll <= 0) {
      return word;
    }
  }
  return choices[choices.length - 1];
}

function getGlobalFailStreak(attempts) {
  let count = 0;
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    if (attempts[i].answer === attempts[i].word) {
      break;
    }
    count += 1;
  }
  return count;
}

// Candidate generation follows the priority list, then removes visible duplicates.
function generateCandidates(currentWord, pool, direction) {
  const requestedCount = randomInteger(state.config.candidateMin, state.config.candidateMax);
  const byWord = new Map();
  for (const word of pool) {
    if (!byWord.has(word.word)) {
      byWord.set(word.word, word);
    }
  }

  let candidates = [currentWord];
  const recentMistakes = state.attempts.filter(function (attempt) {
    return attempt.word === currentWord.word && attempt.answer !== attempt.word && byWord.has(attempt.answer);
  }).slice(-5);
  const mistakeWords = uniqueWords(shuffle(recentMistakes.map(function (attempt) {
    return byWord.get(attempt.answer);
  }))).slice(0, randomInteger(1, 2));
  candidates = addUniqueCandidates(candidates, mistakeWords, requestedCount);

  const similarWords = getSimilarWords(currentWord, pool).slice(0, randomInteger(1, 2));
  candidates = addUniqueCandidates(candidates, similarWords, requestedCount);

  candidates = addUniqueCandidates(candidates, shuffle(pool), requestedCount);
  candidates = dedupeCandidatesForDirection(candidates, currentWord, direction);

  if (candidates.length < requestedCount) {
    candidates = addUniqueCandidatesByDisplay(candidates, shuffle(pool), requestedCount, currentWord, direction);
  }

  return shuffle(candidates);
}

function addUniqueCandidates(candidates, additions, maxCount) {
  const seen = new Set(candidates.map(function (word) {
    return word.word;
  }));
  const next = candidates.slice();
  for (const word of additions) {
    if (!word || seen.has(word.word)) {
      continue;
    }
    next.push(word);
    seen.add(word.word);
    if (next.length >= maxCount) {
      break;
    }
  }
  return next;
}

function addUniqueCandidatesByDisplay(candidates, additions, maxCount, currentWord, direction) {
  const next = candidates.slice();
  const seenWords = new Set(next.map(function (word) { return word.word; }));
  const seenDisplay = new Set(next.map(function (word) {
    return candidateIdentity(word, direction);
  }));

  for (const word of additions) {
    const identity = candidateIdentity(word, direction);
    if (!word || seenWords.has(word.word) || seenDisplay.has(identity)) {
      continue;
    }
    if (word.word === currentWord.word || !seenDisplay.has(identity)) {
      next.push(word);
      seenWords.add(word.word);
      seenDisplay.add(identity);
    }
    if (next.length >= maxCount) {
      break;
    }
  }
  return next;
}

function uniqueWords(words) {
  const seen = new Set();
  const result = [];
  for (const word of words) {
    if (word && !seen.has(word.word)) {
      seen.add(word.word);
      result.push(word);
    }
  }
  return result;
}

function dedupeCandidatesForDirection(candidates, currentWord, direction) {
  const byIdentity = new Map();
  for (const candidate of candidates) {
    const identity = candidateIdentity(candidate, direction);
    const existing = byIdentity.get(identity);
    if (!existing || candidate.word === currentWord.word) {
      byIdentity.set(identity, candidate);
    }
  }
  return Array.from(byIdentity.values());
}

function candidateIdentity(word, direction) {
  if (direction === "hebrew-to-answer") {
    return answerIdentity(word);
  }
  return word.word;
}

function answerIdentity(word) {
  return word.answerKind + ":" + word.answer;
}

function getSimilarWords(currentWord, pool) {
  return pool
    .filter(function (word) {
      return word.word !== currentWord.word;
    })
    .map(function (word) {
      return { word: word, score: scoreHebrewSimilarity(currentWord.word, word.word) };
    })
    .filter(function (entry) {
      return entry.score > 0;
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .map(function (entry) {
      return entry.word;
    });
}

function scoreHebrewSimilarity(left, right) {
  const a = stripHebrewMarks(left).replace(ANY_SPACE_RE, " ");
  const b = stripHebrewMarks(right).replace(ANY_SPACE_RE, " ");
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) {
    return 0;
  }
  let score = 0;
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i += 1) {
    if (a[i] === b[i]) {
      score += 2;
    } else if (sameHebrewGroup(a[i], b[i])) {
      score += 1;
    }
  }
  return score / maxLength - Math.abs(a.length - b.length) * 0.15;
}

function sameHebrewGroup(left, right) {
  const groups = ["אע", "בו", "כחקך", "טת", "סש", "פף", "צץ", "מם", "נן"];
  return groups.some(function (group) {
    return group.includes(left) && group.includes(right);
  });
}

function hasStrippedHebrewCollision(candidates) {
  const seen = new Set();
  for (const candidate of candidates) {
    const stripped = stripHebrewMarks(candidate.word);
    if (seen.has(stripped)) {
      return true;
    }
    seen.add(stripped);
  }
  return false;
}

function stripHebrewMarks(value) {
  return String(value).replace(HEBREW_MARKS_RE, "");
}

function renderQuestion() {
  const card = state.currentCard;
  clearNode(els.questionContent);
  els.questionContent.className = "question-content";
  applyFontToElement(els.questionContent, card.font);
  if (card.direction === "hebrew-to-answer") {
    els.questionContent.dir = "rtl";
    els.questionContent.textContent = stripHebrewMarks(card.word.word);
  } else {
    els.questionContent.dir = "auto";
    renderAnswerEntity(els.questionContent, card.word, true);
  }
}

function renderCandidates() {
  const card = state.currentCard;
  clearNode(els.candidateList);
  els.candidateList.hidden = !card.answersShown;
  if (!card.answersShown) {
    return;
  }

  card.candidates.forEach(function (candidate, index) {
    const candidateCard = document.createElement("article");
    candidateCard.className = "candidate-card";
    if (card.selectedWord) {
      if (candidate.word === card.word.word) {
        candidateCard.classList.add("correct");
      }
      if (candidate.word === card.selectedWord && candidate.word !== card.word.word) {
        candidateCard.classList.add("wrong");
      }
    }

    const choice = document.createElement("button");
    choice.className = "candidate-choice";
    choice.type = "button";
    applyFontToElement(choice, card.font);
    choice.addEventListener("click", function () {
      selectCandidate(index);
    });

    if (card.direction === "hebrew-to-answer") {
      renderAnswerEntity(choice, candidate, false);
    } else {
      const text = document.createElement("span");
      text.className = "candidate-text hebrew card-text";
      text.textContent = card.showHebrewNiqqud ? candidate.word : stripHebrewMarks(candidate.word);
      choice.appendChild(text);
    }

    const info = document.createElement("button");
    info.className = "info-button colorless-icon";
    info.type = "button";
    info.setAttribute("aria-label", "Info");
    info.textContent = "ℹ️";
    info.addEventListener("click", function () {
      openInfoModal(candidate);
    });

    candidateCard.appendChild(choice);
    candidateCard.appendChild(info);
    els.candidateList.appendChild(candidateCard);
  });
}

function renderAnswerEntity(parent, word, isQuestion) {
  if (word.answerKind === "image") {
    const image = document.createElement("img");
    image.src = word.answer;
    image.alt = "";
    parent.appendChild(image);
    return;
  }

  const text = document.createElement("span");
  text.className = isQuestion ? "card-text" : "candidate-text card-text";
  text.textContent = word.answer;
  if (isQuestion) {
    parent.classList.add("answer-text");
  }
  parent.appendChild(text);
}

function applyFontToElement(element, font) {
  element.style.fontFamily = font.family;
  element.style.fontWeight = font.weight;
}

function revealAnswers(cardId) {
  if (!state.currentCard || state.currentCard.id !== cardId || state.currentCard.answersShown) {
    return;
  }
  clearShowTimer();
  state.currentCard.answersShown = true;
  els.showAnswersButton.disabled = true;
  renderCandidates();
}

function selectCandidate(index) {
  const card = state.currentCard;
  if (!card || !card.answersShown || card.selectedWord) {
    return;
  }
  const selected = card.candidates[index];
  if (!selected) {
    return;
  }
  const attempt = {
    t: Math.floor(Date.now() / 1000),
    word: card.word.word,
    answer: selected.word
  };
  appendAttempt(attempt);
  card.selectedWord = selected.word;
  renderCandidates();

  if (selected.word === card.word.word) {
    scheduleAutoNext(card.id);
  } else {
    clearNextTimer();
    scheduleWrongReviewCountdown(card.id);
  }
}

function scheduleShowAnswers(cardId) {
  clearShowTimer();
  const delayMs = state.config.showAnswersDelaySec * 1000;
  if (delayMs > 0) {
    startCountdownBorder(els.showAnswersButton, "countdown-active", state.config.showAnswersDelaySec, "var(--gold)");
  }
  state.showTimer = window.setTimeout(function () {
    revealAnswers(cardId);
  }, delayMs);
}

function scheduleAutoNext(cardId) {
  clearNextTimer();
  const delayMs = state.config.autoNextDelaySec * 1000;
  state.nextTimer = window.setTimeout(function () {
    if (state.currentCard && state.currentCard.id === cardId) {
      renderNextCard();
    }
  }, delayMs);
}

function clearTimers() {
  clearShowTimer();
  clearNextTimer();
  clearNextHold();
  clearWrongTimer();
}

function clearShowTimer() {
  if (state.showTimer !== null) {
    window.clearTimeout(state.showTimer);
    state.showTimer = null;
  }
  clearCountdownBorder(els.showAnswersButton, "countdown-active");
}

function clearNextTimer() {
  if (state.nextTimer !== null) {
    window.clearTimeout(state.nextTimer);
    state.nextTimer = null;
  }
}

function clearNextHold() {
  if (state.nextHoldTimer !== null) {
    window.clearTimeout(state.nextHoldTimer);
    state.nextHoldTimer = null;
  }
  clearCountdownBorder(els.nextButton, "holding");
}

function clearWrongTimer() {
  if (state.wrongTimer !== null) {
    window.clearTimeout(state.wrongTimer);
    state.wrongTimer = null;
  }
  document.querySelectorAll(".candidate-card.wrong.countdown-active").forEach(function (element) {
    clearCountdownBorder(element, "countdown-active");
  });
}

function startNextHold() {
  if (state.nextHoldTimer || !state.currentCard) {
    return;
  }
  startCountdownBorder(els.nextButton, "holding", NEXT_HOLD_MS / 1000, "var(--gold)");
  state.nextHoldTimer = window.setTimeout(function () {
    state.nextHoldTimer = null;
    clearCountdownBorder(els.nextButton, "holding");
    renderNextCard();
  }, NEXT_HOLD_MS);
}

function cancelNextHold() {
  clearNextHold();
}

function scheduleWrongReviewCountdown(cardId) {
  clearWrongTimer();
  const delayMs = state.config.autoNextDelaySec * 1000;
  if (delayMs <= 0) {
    return;
  }
  const wrongCard = els.candidateList.querySelector(".candidate-card.wrong");
  if (!wrongCard) {
    return;
  }
  startCountdownBorder(wrongCard, "countdown-active", state.config.autoNextDelaySec, "var(--red-line)");
  state.wrongTimer = window.setTimeout(function () {
    if (state.currentCard && state.currentCard.id === cardId) {
      clearCountdownBorder(wrongCard, "countdown-active");
    }
    state.wrongTimer = null;
  }, delayMs);
}

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function startCountdownBorder(element, className, durationSec, color) {
  clearCountdownBorder(element, className);
  element.style.setProperty("--countdown-line", color);

  const width = Math.max(1, element.offsetWidth);
  const height = Math.max(1, element.offsetHeight);
  const perimeter = (width + height) * 2;
  const durations = {
    top: durationSec * width / perimeter,
    right: durationSec * height / perimeter,
    bottom: durationSec * width / perimeter,
    left: durationSec * height / perimeter
  };
  const delays = {
    top: 0,
    right: durations.top,
    bottom: durations.top + durations.right,
    left: durations.top + durations.right + durations.bottom
  };
  const edges = document.createElement("span");
  edges.className = "countdown-edges";
  edges.setAttribute("aria-hidden", "true");

  ["top", "right", "bottom", "left"].forEach(function (side) {
    const edge = document.createElement("span");
    edge.className = "countdown-edge " + side;
    edge.style.animationDuration = Math.max(0.001, durations[side]) + "s";
    edge.style.animationDelay = delays[side] + "s";
    edges.appendChild(edge);
  });

  element.appendChild(edges);
  restartAnimation(element, className);
}

function clearCountdownBorder(element, className) {
  element.classList.remove(className);
  Array.from(element.children).forEach(function (child) {
    if (child.classList.contains("countdown-edges")) {
      child.remove();
    }
  });
  element.style.removeProperty("--countdown-line");
}

function openSettingsModal() {
  openModal("Stats & Settings", buildSettingsContent());
}

function buildSettingsContent() {
  const wrapper = document.createElement("div");
  appendStatsSection(wrapper);
  appendSettingsSection(wrapper);
  appendFontsSection(wrapper);
  appendTagsSection(wrapper);
  return wrapper;
}

function appendStatsSection(wrapper) {
  const section = sectionNode("Statistics");
  const stats = getGlobalStats();
  const list = document.createElement("div");
  list.className = "stats-list";
  addStatLine(list, "Total attempts", String(stats.total));
  addStatLine(list, "Correct", String(stats.correct));
  addStatLine(list, "Wrong", String(stats.wrong));
  addStatLine(list, "Accuracy", stats.total ? Math.round((stats.correct / stats.total) * 100) + "%" : "0%");
  addStatLine(list, "Global fail streak", String(stats.failStreak));
  addStatLine(list, "Never attempted", String(stats.neverAttempted));
  section.appendChild(list);

  if (stats.commonConfusions.length > 0) {
    const title = document.createElement("h3");
    title.textContent = "Common confusions";
    title.style.marginTop = "14px";
    section.appendChild(title);
    const recent = document.createElement("div");
    recent.className = "recent-list";
    stats.commonConfusions.slice(0, 5).forEach(function (item) {
      addPlainLine(recent, item.label + ": " + item.count);
    });
    section.appendChild(recent);
  }

  wrapper.appendChild(section);
}

function appendSettingsSection(wrapper) {
  const section = sectionNode("Settings");
  const grid = document.createElement("div");
  grid.className = "settings-grid";

  const direction = radioField("Direction", "directionMode", [
    ["random", "Random"],
    ["hebrew-to-answer", "Hebrew to answer"],
    ["answer-to-hebrew", "Answer to Hebrew"]
  ], state.config.directionMode);
  direction.inputs.forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked) {
        state.config.directionMode = input.value;
        saveConfig();
      }
    });
  });
  grid.appendChild(direction.row);

  const showDelay = numberField("Show answers delay", state.config.showAnswersDelaySec, 0, MAX_DELAY_SEC);
  showDelay.input.addEventListener("change", function () {
    state.config.showAnswersDelaySec = clampNumber(showDelay.input.value, 0, MAX_DELAY_SEC, 0);
    showDelay.input.value = state.config.showAnswersDelaySec;
    saveConfig();
  });
  grid.appendChild(showDelay.row);

  const nextDelay = numberField("Auto-next delay", state.config.autoNextDelaySec, 0, MAX_DELAY_SEC);
  nextDelay.input.addEventListener("change", function () {
    state.config.autoNextDelaySec = clampNumber(nextDelay.input.value, 0, MAX_DELAY_SEC, 0);
    nextDelay.input.value = state.config.autoNextDelaySec;
    saveConfig();
  });
  grid.appendChild(nextDelay.row);

  const minCount = numberField("Candidate min", state.config.candidateMin, MIN_CANDIDATES, MAX_CANDIDATES);
  const maxCount = numberField("Candidate max", state.config.candidateMax, MIN_CANDIDATES, MAX_CANDIDATES);
  function saveCandidateCounts() {
    state.config.candidateMin = clampNumber(minCount.input.value, MIN_CANDIDATES, MAX_CANDIDATES, DEFAULT_CONFIG.candidateMin);
    state.config.candidateMax = clampNumber(maxCount.input.value, MIN_CANDIDATES, MAX_CANDIDATES, DEFAULT_CONFIG.candidateMax);
    if (state.config.candidateMin > state.config.candidateMax) {
      state.config.candidateMax = state.config.candidateMin;
    }
    minCount.input.value = state.config.candidateMin;
    maxCount.input.value = state.config.candidateMax;
    saveConfig();
  }
  minCount.input.addEventListener("change", saveCandidateCounts);
  maxCount.input.addEventListener("change", saveCandidateCounts);
  grid.appendChild(minCount.row);
  grid.appendChild(maxCount.row);

  section.appendChild(grid);
  wrapper.appendChild(section);
}

function appendFontsSection(wrapper) {
  const section = sectionNode("Fonts");
  const selected = new Set(state.config.selectedFonts || []);
  const list = document.createElement("div");
  list.className = "font-list";

  FONT_OPTIONS.forEach(function (font) {
    const row = document.createElement("label");
    row.className = "font-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(font.key);
    checkbox.addEventListener("change", function () {
      const next = new Set(state.config.selectedFonts || []);
      if (checkbox.checked) {
        next.add(font.key);
      } else {
        next.delete(font.key);
      }
      state.config.selectedFonts = Array.from(next);
      applyCurrentCardFontChange(font, checkbox.checked);
      saveConfig();
    });

    const sample = document.createElement("span");
    sample.className = "font-sample";
    sample.textContent = font.label + "   " + FONT_SAMPLE;
    applyFontToElement(sample, font);

    row.appendChild(checkbox);
    row.appendChild(sample);
    list.appendChild(row);
  });

  section.appendChild(list);
  wrapper.appendChild(section);
}

function appendTagsSection(wrapper) {
  const section = sectionNode("Tags");
  const tags = getAllTags();
  state.config.selectedTagGroups.forEach(function (group, groupIndex) {
    section.appendChild(buildTagGroup(tags, group, groupIndex));
  });

  const addList = document.createElement("button");
  addList.type = "button";
  addList.className = "secondary-button";
  addList.textContent = "Add another list";
  addList.addEventListener("click", function () {
    state.config.selectedTagGroups.push([]);
    saveConfig();
    openSettingsModal();
  });
  section.appendChild(addList);
  wrapper.appendChild(section);
}

function buildTagGroup(tags, selectedTags, groupIndex) {
  const group = document.createElement("div");
  group.className = "tag-group";

  const header = document.createElement("div");
  header.className = "tag-group-header";
  const title = document.createElement("h3");
  title.textContent = "Tag list " + (groupIndex + 1);
  header.appendChild(title);
  if (groupIndex > 0) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button";
    remove.textContent = "Remove list";
    remove.addEventListener("click", function () {
      state.config.selectedTagGroups.splice(groupIndex, 1);
      if (state.config.selectedTagGroups.length === 0) {
        state.config.selectedTagGroups = [[]];
      }
      saveConfig();
      renderPoolSummary();
      openSettingsModal();
    });
    header.appendChild(remove);
  }
  group.appendChild(header);

  const list = document.createElement("div");
  list.className = "tag-list";
  const selected = new Set(selectedTags);

  tags.forEach(function (tag) {
    const row = document.createElement("label");
    row.className = "tag-row tag-indent-" + Math.min(3, tag.split("/").length - 1);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(tag);
    checkbox.addEventListener("change", function () {
      const next = new Set(state.config.selectedTagGroups[groupIndex] || []);
      if (checkbox.checked) {
        next.add(tag);
      } else {
        next.delete(tag);
      }
      state.config.selectedTagGroups[groupIndex] = Array.from(next);
      saveConfig();
      renderPoolSummary();
      openSettingsModal();
    });

    const labelText = document.createElement("span");
    labelText.className = "tag-label-line";
    const name = document.createElement("span");
    name.className = "tag-name";
    name.textContent = tag;
    const count = document.createElement("span");
    count.className = "tag-count";
    const total = state.words.filter(function (word) {
      return word.tags.includes(tag);
    }).length;
    const delta = getTagToggleDelta(groupIndex, tag);
    count.textContent = total + " total, " + formatDelta(delta);
    labelText.appendChild(name);
    labelText.appendChild(count);
    row.appendChild(checkbox);
    row.appendChild(labelText);
    list.appendChild(row);
  });

  if (tags.length === 0) {
    addPlainLine(list, "No tags in current sheet.");
  }
  group.appendChild(list);
  return group;
}

function getTagToggleDelta(groupIndex, tag) {
  const before = filterWordsByTagGroups(state.words, state.config.selectedTagGroups).length;
  const nextGroups = state.config.selectedTagGroups.map(function (group) {
    return group.slice();
  });
  const group = new Set(nextGroups[groupIndex] || []);
  if (group.has(tag)) {
    group.delete(tag);
  } else {
    group.add(tag);
  }
  nextGroups[groupIndex] = Array.from(group);
  const after = filterWordsByTagGroups(state.words, nextGroups).length;
  return after - before;
}

function formatDelta(delta) {
  if (delta > 0) {
    return "+" + delta;
  }
  return String(delta);
}

function getAllTags() {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return Array.from(new Set(state.words.flatMap(function (word) {
    return word.tags;
  }))).sort(collator.compare);
}

function openInfoModal(word) {
  const wrapper = document.createElement("div");

  const answerSection = plainModalSection();
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Show answer";
  details.appendChild(summary);
  const answerBlock = document.createElement("div");
  answerBlock.style.marginTop = "8px";
  renderInfoAnswer(answerBlock, word);
  details.appendChild(answerBlock);

  const description = document.createElement("div");
  description.className = "answer-block";
  description.style.marginTop = "8px";
  description.textContent = word.description || "No description.";
  details.appendChild(description);
  answerSection.appendChild(details);
  wrapper.appendChild(answerSection);

  const tagsSection = sectionNode("Tags");
  if (word.tags.length) {
    const tagList = document.createElement("div");
    tagList.className = "inline-tags";
    word.tags.forEach(function (tag) {
      const item = document.createElement("span");
      item.className = "inline-tag";
      item.textContent = tag;
      tagList.appendChild(item);
    });
    tagsSection.appendChild(tagList);
  } else {
    addPlainLine(tagsSection, "No tags.");
  }
  wrapper.appendChild(tagsSection);

  appendWordStatsSection(wrapper, word.word);
  openModal(word.word, wrapper);
}

function renderInfoAnswer(parent, word) {
  if (word.answerKind === "image") {
    const image = document.createElement("img");
    image.className = "answer-image";
    image.src = word.answer;
    image.alt = "";
    parent.appendChild(image);
    return;
  }
  const text = document.createElement("div");
  text.className = "answer-block";
  text.textContent = word.answer;
  parent.appendChild(text);
}

function appendWordStatsSection(wrapper, wordValue) {
  const stats = getWordStats(wordValue);
  const section = sectionNode("Detailed stats");
  const list = document.createElement("div");
  list.className = "stats-list";
  addStatLine(list, "Total related attempts", String(stats.related.length));
  addStatLine(list, "Times used as correct word", String(stats.asTarget));
  addStatLine(list, "Times selected as answer", String(stats.asAnswer));
  addStatLine(list, "Correct target attempts", String(stats.correctTarget));
  addStatLine(list, "Wrong target attempts", String(stats.wrongTarget));
  addStatLine(list, "Selected wrong for another word", String(stats.selectedWrong));
  section.appendChild(list);

  if (stats.commonConfusions.length) {
    const title = document.createElement("h3");
    title.textContent = "Common confusions";
    title.style.marginTop = "14px";
    section.appendChild(title);
    const confusions = document.createElement("div");
    confusions.className = "recent-list";
    stats.commonConfusions.slice(0, 5).forEach(function (item) {
      addPlainLine(confusions, item.label + ": " + item.count);
    });
    section.appendChild(confusions);
  }

  if (stats.related.length) {
    const title = document.createElement("h3");
    title.textContent = "Recent related attempts";
    title.style.marginTop = "14px";
    section.appendChild(title);
    const recent = document.createElement("div");
    recent.className = "recent-list";
    stats.related.slice(-5).reverse().forEach(function (attempt) {
      const status = attempt.answer === attempt.word ? "correct" : "wrong";
      addPlainLine(recent, status + ": " + attempt.word + " -> " + attempt.answer);
    });
    section.appendChild(recent);
  }

  wrapper.appendChild(section);
}

function getGlobalStats() {
  const total = state.attempts.length;
  const correct = state.attempts.filter(function (attempt) {
    return attempt.answer === attempt.word;
  }).length;
  const wrong = total - correct;
  const currentWords = new Set(state.words.map(function (word) {
    return word.word;
  }));
  const attemptedTargets = new Set(state.attempts.map(function (attempt) {
    return attempt.word;
  }));
  const neverAttempted = Array.from(currentWords).filter(function (word) {
    return !attemptedTargets.has(word);
  }).length;

  return {
    total: total,
    correct: correct,
    wrong: wrong,
    failStreak: getGlobalFailStreak(state.attempts),
    neverAttempted: neverAttempted,
    commonConfusions: getCommonConfusions(state.attempts, null)
  };
}

function getWordStats(wordValue) {
  const related = state.attempts.filter(function (attempt) {
    return attempt.word === wordValue || attempt.answer === wordValue;
  });
  return {
    related: related,
    asTarget: state.attempts.filter(function (attempt) { return attempt.word === wordValue; }).length,
    asAnswer: state.attempts.filter(function (attempt) { return attempt.answer === wordValue; }).length,
    correctTarget: state.attempts.filter(function (attempt) {
      return attempt.word === wordValue && attempt.answer === attempt.word;
    }).length,
    wrongTarget: state.attempts.filter(function (attempt) {
      return attempt.word === wordValue && attempt.answer !== attempt.word;
    }).length,
    selectedWrong: state.attempts.filter(function (attempt) {
      return attempt.answer === wordValue && attempt.answer !== attempt.word;
    }).length,
    commonConfusions: getCommonConfusions(state.attempts, wordValue)
  };
}

function getCommonConfusions(attempts, wordValue) {
  const counts = new Map();
  attempts.forEach(function (attempt) {
    if (attempt.answer === attempt.word) {
      return;
    }
    if (wordValue && attempt.word !== wordValue && attempt.answer !== wordValue) {
      return;
    }
    const key = "answered " + attempt.answer + " for " + attempt.word;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(function (entry) {
      return { label: entry[0], count: entry[1] };
    })
    .sort(function (a, b) {
      return b.count - a.count;
    });
}

function sectionNode(titleText) {
  const section = document.createElement("section");
  section.className = "modal-section";
  const title = document.createElement("h3");
  title.textContent = titleText;
  section.appendChild(title);
  return section;
}

function plainModalSection() {
  const section = document.createElement("section");
  section.className = "modal-section";
  return section;
}

function addStatLine(parent, label, value) {
  const row = document.createElement("div");
  row.className = "stat-line";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.textContent = value;
  row.appendChild(labelNode);
  row.appendChild(valueNode);
  parent.appendChild(row);
}

function addPlainLine(parent, text) {
  const row = document.createElement("div");
  row.className = "recent-line";
  row.textContent = text;
  parent.appendChild(row);
}

function radioField(labelText, name, options, value) {
  const row = document.createElement("div");
  row.className = "field-row";
  const label = document.createElement("label");
  label.textContent = labelText;
  const group = document.createElement("div");
  group.className = "radio-group";
  const inputs = [];

  options.forEach(function (option) {
    const itemLabel = document.createElement("label");
    itemLabel.className = "radio-row";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = option[0];
    input.checked = option[0] === value;
    const text = document.createElement("span");
    text.textContent = option[1];
    itemLabel.appendChild(input);
    itemLabel.appendChild(text);
    group.appendChild(itemLabel);
    inputs.push(input);
  });

  row.appendChild(label);
  row.appendChild(group);
  return { row: row, inputs: inputs };
}

function numberField(labelText, value, min, max) {
  const row = document.createElement("div");
  row.className = "field-row";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  row.appendChild(label);
  row.appendChild(input);
  return { row: row, input: input };
}

function openModal(title, bodyNode) {
  els.modalTitle.textContent = title;
  clearNode(els.modalBody);
  els.modalBody.appendChild(bodyNode);
  els.modalBackdrop.hidden = false;
  els.modalCloseButton.focus();
}

function closeModal() {
  els.modalBackdrop.hidden = true;
  clearNode(els.modalBody);
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function alertAndLog(message, error) {
  console.error(message, error);
  alert(message);
}

function randomInteger(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}
