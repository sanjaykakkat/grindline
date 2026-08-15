// ===== Grindline — Core Game State & Logic =====

const STORAGE_KEY = "grindline_v1";

// Character catalog (original, non-copyrighted pirate-themed)
const CHARACTERS = [
  {
    id: "deckhand",
    name: "Deckhand Dreg",
    emoji: "🦜",
    price: 5000,
    desc: "A scrappy starter. Better than nothing.",
  },
  {
    id: "cabin_boy",
    name: "Cabin Boy Finn",
    emoji: "🧒",
    price: 25000,
    desc: "Eager and quick. First real crew member.",
  },
  {
    id: "gunner",
    name: "Gunner Grit",
    emoji: "💣",
    price: 100000,
    desc: "Steady aim. Proven under pressure.",
  },
  {
    id: "navigator",
    name: "Navigator Nyx",
    emoji: "🧭",
    price: 350000,
    desc: "Reads the stars. Never lost.",
  },
  {
    id: "first_mate",
    name: "First Mate Rook",
    emoji: "⚔️",
    price: 1000000,
    desc: "Loyal and lethal. Commands respect.",
  },
  {
    id: "captain",
    name: "Captain Voss",
    emoji: "🏴‍☠️",
    price: 5000000,
    desc: "Legend of the seas. True proof of the grind.",
  },
];

// Default state
function defaultState() {
  return {
    level: 1,
    xp: 0,
    xpToNext: 100,
    bounty: 0,
    stamina: 100,
    maxStamina: 100,
    inventory: [], // array of character ids
    equipped: null, // character id
    lastStaminaUpdate: Date.now(),
  };
}

// Load / Save
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    // Merge with defaults in case new fields are added later
    return { ...defaultState(), ...data };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ===== Game Logic =====

let state = loadState();
let timerInterval = null;
let remainingSeconds = 0;
let isPaused = false;
let currentTaskName = "";
let currentTaskMinutes = 25;

// Stamina recovery: 1 stamina every 3 minutes while not focusing
const STAMINA_RECOVERY_MS = 3 * 60 * 1000;

function recoverStamina() {
  const now = Date.now();
  const elapsed = now - state.lastStaminaUpdate;
  if (elapsed < STAMINA_RECOVERY_MS) return;

  const recovered = Math.floor(elapsed / STAMINA_RECOVERY_MS);
  if (recovered > 0 && state.stamina < state.maxStamina) {
    state.stamina = Math.min(state.maxStamina, state.stamina + recovered);
    state.lastStaminaUpdate = now - (elapsed % STAMINA_RECOVERY_MS);
    saveState(state);
  }
}

// XP curve: simple linear-ish growth
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

function addXP(amount) {
  state.xp += amount;
  let leveled = false;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = xpForLevel(state.level);
    leveled = true;
  }
  return leveled;
}

// Rewards based on minutes focused
function calculateRewards(minutes) {
  // Base: 1000 bounty + 1 XP per minute, scaled a bit
  const bounty = Math.round(minutes * 1000 * (1 + (state.level - 1) * 0.02));
  const xp = Math.round(minutes * 1.2);
  const staminaCost = Math.max(5, Math.round(minutes * 0.5)); // ~0.5 stamina per min
  return { bounty, xp, staminaCost };
}

// ===== UI Helpers =====

function formatBounty(n) {
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return "฿" + (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return "฿" + n.toLocaleString();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function showToast(message, type = "") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = "toast " + type;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.classList.add("hidden");
  }, 3200);
}

function updateUI() {
  recoverStamina();

  document.getElementById("level").textContent = state.level;
  document.getElementById("xp-text").textContent = `${state.xp} / ${state.xpToNext}`;
  const xpPct = Math.min(100, (state.xp / state.xpToNext) * 100);
  document.getElementById("xp-fill").style.width = xpPct + "%";

  document.getElementById("bounty").textContent = formatBounty(state.bounty);
  document.getElementById("stamina").textContent = `${state.stamina}/${state.maxStamina}`;
  const stamPct = (state.stamina / state.maxStamina) * 100;
  document.getElementById("stamina-fill").style.width = stamPct + "%";

  // Equipped character
  const eqEl = document.getElementById("equipped-character");
  if (state.equipped) {
    const char = CHARACTERS.find((c) => c.id === state.equipped);
    if (char) {
      eqEl.innerHTML = `
        <div class="char-avatar">${char.emoji}</div>
        <div class="char-info">
          <div class="char-name">${char.name}</div>
          <div class="char-desc">${char.desc}</div>
        </div>
      `;
    }
  } else {
    eqEl.innerHTML = `
      <div class="char-avatar">🏴‍☠️</div>
      <div class="char-info">
        <div class="char-name">No one equipped</div>
        <div class="char-desc">Buy a character in the shop!</div>
      </div>
    `;
  }

  renderShop();
  renderInventory();
}

function renderShop() {
  const grid = document.getElementById("shop-grid");
  grid.innerHTML = CHARACTERS.map((char) => {
    const owned = state.inventory.includes(char.id);
    return `
      <div class="shop-item ${owned ? "owned" : ""}">
        <div class="avatar">${char.emoji}</div>
        <div class="name">${char.name}</div>
        <div class="price">${owned ? "OWNED" : formatBounty(char.price)}</div>
        <div class="desc">${char.desc}</div>
        ${
          owned
            ? `<button class="btn equip" data-equip="${char.id}">${state.equipped === char.id ? "Equipped" : "Equip"}</button>`
            : `<button class="btn shop-buy" data-buy="${char.id}" ${state.bounty < char.price ? "disabled" : ""}>Buy</button>`
        }
      </div>
    `;
  }).join("");

  // Bind buy / equip
  grid.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => buyCharacter(btn.dataset.buy));
  });
  grid.querySelectorAll("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => equipCharacter(btn.dataset.equip));
  });
}

function renderInventory() {
  const grid = document.getElementById("inventory");
  if (state.inventory.length === 0) {
    grid.innerHTML = `<p class="empty-msg">No characters yet. Buy one from the shop!</p>`;
    return;
  }

  grid.innerHTML = state.inventory
    .map((id) => {
      const char = CHARACTERS.find((c) => c.id === id);
      if (!char) return "";
      const isEq = state.equipped === id;
      return `
        <div class="inv-item ${isEq ? "equipped" : ""}">
          <div class="avatar">${char.emoji}</div>
          <div class="name">${char.name}</div>
          <button class="btn equip" data-equip="${id}">${isEq ? "Equipped" : "Equip"}</button>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => equipCharacter(btn.dataset.equip));
  });
}

// ===== Actions =====

function buyCharacter(id) {
  const char = CHARACTERS.find((c) => c.id === id);
  if (!char) return;
  if (state.inventory.includes(id)) {
    showToast("You already own this character.");
    return;
  }
  if (state.bounty < char.price) {
    showToast("Not enough Bounty. Keep grinding!", "gold");
    return;
  }

  state.bounty -= char.price;
  state.inventory.push(id);
  if (!state.equipped) state.equipped = id; // auto-equip first purchase
  saveState(state);
  updateUI();
  showToast(`Unlocked ${char.name}! 🎉`, "success");
}

function equipCharacter(id) {
  if (!state.inventory.includes(id)) return;
  state.equipped = id;
  saveState(state);
  updateUI();
  const char = CHARACTERS.find((c) => c.id === id);
  showToast(`Equipped ${char.name}`);
}

// Timer
function startFocus() {
  const nameInput = document.getElementById("task-name");
  const minutesSelect = document.getElementById("task-minutes");
  const name = nameInput.value.trim() || "Focus Session";
  const minutes = parseInt(minutesSelect.value, 10);

  const { staminaCost } = calculateRewards(minutes);
  if (state.stamina < staminaCost) {
    showToast(`Not enough Stamina (need ${staminaCost}). Take a break!`);
    return;
  }

  currentTaskName = name;
  currentTaskMinutes = minutes;
  remainingSeconds = minutes * 60;
  isPaused = false;

  document.getElementById("task-setup").classList.add("hidden");
  document.getElementById("timer-view").classList.remove("hidden");
  document.getElementById("current-task-name").textContent = currentTaskName;
  document.getElementById("timer-display").textContent = formatTime(remainingSeconds);
  document.getElementById("pause-btn").textContent = "Pause";

  // Deduct stamina at start (or we could do it on complete — doing at start prevents abuse)
  state.stamina -= staminaCost;
  state.lastStaminaUpdate = Date.now();
  saveState(state);
  updateUI();

  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 1000);
}

function tick() {
  if (isPaused) return;
  remainingSeconds -= 1;
  document.getElementById("timer-display").textContent = formatTime(Math.max(0, remainingSeconds));

  if (remainingSeconds <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    // Auto-complete when timer hits zero
    completeSession(true);
  }
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
}

function completeSession(fromTimer = false) {
  clearInterval(timerInterval);
  timerInterval = null;

  const minutes = currentTaskMinutes;
  // If user completes early, still give full rewards for chosen duration
  // (simple v1 behavior — can be refined later)
  const { bounty, xp } = calculateRewards(minutes);

  const leveled = addXP(xp);
  state.bounty += bounty;
  saveState(state);

  // Reset UI
  document.getElementById("timer-view").classList.add("hidden");
  document.getElementById("task-setup").classList.remove("hidden");
  document.getElementById("task-name").value = "";

  updateUI();

  let msg = `+${formatBounty(bounty)} Bounty  •  +${xp} XP`;
  if (leveled) msg += `  •  LEVEL UP! → ${state.level}`;
  showToast(msg, "gold");
}

function cancelSession() {
  clearInterval(timerInterval);
  timerInterval = null;

  // Refund stamina on cancel (fair)
  const { staminaCost } = calculateRewards(currentTaskMinutes);
  state.stamina = Math.min(state.maxStamina, state.stamina + staminaCost);
  state.lastStaminaUpdate = Date.now();
  saveState(state);

  document.getElementById("timer-view").classList.add("hidden");
  document.getElementById("task-setup").classList.remove("hidden");
  updateUI();
  showToast("Session cancelled. Stamina refunded.");
}

// ===== Init =====

document.getElementById("start-btn").addEventListener("click", startFocus);
document.getElementById("pause-btn").addEventListener("click", togglePause);
document.getElementById("complete-btn").addEventListener("click", () => completeSession(false));
document.getElementById("cancel-btn").addEventListener("click", cancelSession);

// Recover stamina periodically while the page is open
setInterval(() => {
  recoverStamina();
  updateUI();
}, 30000);

// Initial render
updateUI();

