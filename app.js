const form = document.querySelector("#pass-form");
const input = document.querySelector("#surname");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#result-title");
const resultText = document.querySelector("#result-text");
const contactActions = document.querySelector("#contact-actions");
const phoneLink = document.querySelector("#phone-link");
const checkButton = document.querySelector("#check-button");

const config = window.PASS_CHECK_CONFIG;
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

    if (isListed) {
      showResult(
        "success",
        "Пропуск заказан",
        "Фамилия есть в списке."
      );
      return;
    }

    showResult(
      "missing",
      "Фамилии нет в списке",
      "Напишите, чтобы оформить заявку.",
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
