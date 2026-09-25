const form = document.querySelector("#pass-form");
const input = document.querySelector("#surname");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#result-title");
const resultText = document.querySelector("#result-text");
const contactActions = document.querySelector("#contact-actions");
const phoneLink = document.querySelector("#phone-link");
const checkButton = document.querySelector("#check-button");
const loggingNote = document.querySelector("#logging-note");

const config = window.PASS_CHECK_CONFIG;
const logConfig = window.PASS_LOG_CONFIG || {};
const knownHashes = new Set(window.PASS_SURNAME_HASHES || []);

function normalizeSurname(value) {
  const firstToken = value.trim().split(/\s+/u)[0] || "";
  return firstToken
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^а-я-]/gu, "");
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getSessionId() {
  const storageKey = "mosfilm-pass-session";
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

function logCheck(surname, status) {
  if (!logConfig.endpoint) {
    return;
  }

  const body = new URLSearchParams({
    surname,
    status,
    sessionId: getSessionId(),
    source: config.namespace,
  });

  fetch(logConfig.endpoint, {
    method: "POST",
    mode: "no-cors",
    body,
    keepalive: true,
    referrerPolicy: "no-referrer",
  }).catch(() => {
    // Logging must never block the pass check.
  });
}

function showResult(state, title, text, showContacts = false) {
  result.hidden = false;
  result.className = `result result--${state}`;
  resultTitle.textContent = title;
  resultText.textContent = text;
  contactActions.hidden = !showContacts;
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

if (config?.phoneDisplay && config?.phoneHref) {
  phoneLink.hidden = false;
  phoneLink.textContent = config.phoneDisplay;
  phoneLink.href = config.phoneHref;
}

if (logConfig.endpoint) {
  loggingNote.hidden = false;
}

async function checkSurname() {
  const surname = normalizeSurname(input.value);
  if (surname.length < 2) {
    showResult("error", "Введите фамилию", "Проверьте написание.");
    input.focus();
    return;
  }

  try {
    const hash = await sha256(`${config.namespace}:${surname}`);
    const isListed = knownHashes.has(hash);
    logCheck(surname, isListed ? "found" : "missing");

    if (isListed) {
      showResult(
        "success",
        "Пропуск заказан",
        "Пропуск можно получить в бюро пропусков."
      );
      return;
    }

    showResult(
      "missing",
      "Фамилия не подтверждена",
      "Если ваша фамилия не подтверждена, обратитесь к Александру Назарову: Telegram @naz_tut_net или телефон 8 926 587 79 72.",
      true
    );
  } catch {
    showResult(
      "error",
      "Не удалось проверить",
      "Откройте страницу в современном браузере и попробуйте ещё раз."
    );
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  checkSurname();
});

checkButton.addEventListener("click", checkSurname);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    checkSurname();
  }
});
