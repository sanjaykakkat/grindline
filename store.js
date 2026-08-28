// ===== Grindline Store =====

import {
  onAuth,
  loadUserData,
  saveUserData
} from "./auth.js";

import { characters } from "./characters.js";


// ---------- State ----------

let currentUser = null;
let state = null;


// ---------- Helpers ----------

function formatBounty(n) {
  if (n >= 1_000_000_000) {
    return "฿" +
      (n / 1_000_000_000)
        .toFixed(1)
        .replace(/\.0$/, "") +
      "B";
  }

  if (n >= 1_000_000) {
    return "฿" +
      (n / 1_000_000)
        .toFixed(1)
        .replace(/\.0$/, "") +
      "M";
  }

  if (n >= 1_000) {
    return "฿" +
      (n / 1_000)
        .toFixed(1)
        .replace(/\.0$/, "") +
      "K";
  }

  return "฿" + n.toLocaleString();
}


// ---------- UI ----------

function updateBounty() {
  document.getElementById("store-bounty").textContent =
    formatBounty(state.bounty);
}


function renderStore() {
  const container =
    document.getElementById("store-characters");

  container.innerHTML = "";

  Object.values(characters).forEach((character) => {

    const owned =
      state.unlockedCharacters.includes(character.id);

    const canAfford =
      state.bounty >= character.price;

    const card =
      document.createElement("article");

    card.className =
      "store-character-card" +
      (owned ? " owned" : "");

    card.innerHTML = `
      <div class="character-image-wrap">

        <img
          src="${character.image}"
          alt="${character.name} ${character.variation}"
          class="store-character-image"
        >

        <span class="character-variation">
          ${(character.variation ?? "Standard").toUpperCase()}
        </span>

      </div>


      <div class="store-character-info">

        <div class="character-name-area">

          <h3>
            ${character.name}
          </h3>

          <p>
            ${character.variation}
          </p>

        </div>


        <div class="character-buy-area">

          <div class="character-price">
            ${formatBounty(character.price)}
          </div>

          ${
            owned
              ? `
                <span class="owned-badge">
                  Owned
                </span>
              `
              : `
                <button
                  class="buy-btn"
                  data-character="${character.id}"
                  ${canAfford ? "" : "disabled"}
                >
                  Buy
                </button>
              `
          }

        </div>

      </div>
    `;

    container.appendChild(card);
  });


  // Buy button events
  document
    .querySelectorAll(".buy-btn")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => buyCharacter(
          button.dataset.character
        )
      );

    });

}


// ---------- Buy Character ----------

async function buyCharacter(characterId) {

  const character =
    characters[characterId];

  if (!character) {
    return;
  }


  // Already owned
  if (
    state.unlockedCharacters.includes(
      characterId
    )
  ) {
    return;
  }


  // Not enough bounty
  if (
    state.bounty <
    character.price
  ) {
    alert("Not enough Bounty.");
    return;
  }


  // Deduct bounty
  state.bounty -= character.price;


  // Add character to owned characters
  state.unlockedCharacters.push(
    characterId
  );


  try {

    await saveUserData(
      currentUser.uid,
      {
        bounty: state.bounty,
        unlockedCharacters:
          state.unlockedCharacters
      }
    );


    // Update UI
    updateBounty();
    renderStore();


  } catch (error) {

    console.error(
      "Failed to buy character:",
      error
    );

    // Restore data if Firebase fails
    state.bounty += character.price;

    state.unlockedCharacters =
      state.unlockedCharacters.filter(
        id => id !== characterId
      );

    alert(
      "Purchase failed. Please try again."
    );

    updateBounty();
    renderStore();
  }

}


// ---------- Navigation ----------

document
  .querySelectorAll(".nav-item")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const page =
          button.dataset.page;

        const pages = {
          home: "index.html",
          crew: "crew.html",
          store: "store.html",
          settings: "settings.html"
        };

        if (pages[page]) {
          window.location.href =
            pages[page];
        }

      }
    );

  });


// ---------- Auth ----------

onAuth(async (user) => {

  if (!user) {
    window.location.href =
      "login.html";

    return;
  }


  currentUser = user;


  try {

    const data =
      await loadUserData(user.uid);


    if (!data) {
      console.error(
        "User data not found."
      );

      return;
    }


    state = {

      bounty:
        data.bounty ?? 0,

      unlockedCharacters:
        data.unlockedCharacters ?? []

    };


    // Render store
    updateBounty();

    renderStore();


    // Show app
    document
      .getElementById("loading-screen")
      .classList.add("hidden");

    document
      .getElementById("store-app")
      .classList.remove("hidden");


  } catch (err) {
  console.error("❌ Failed to load store:", err);
  console.error("Error name:", err?.name);
  console.error("Error message:", err?.message);
  console.error("Error stack:", err?.stack);
  }

});
