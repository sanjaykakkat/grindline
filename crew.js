// ===== Grindline Crew =====

import {
  onAuth,
  loadUserData,
  saveUserData
} from "./auth.js";

import { characters } from "./characters.js";


// ---------- State ----------

let currentUser = null;

let state = null;


// ---------- Crew Roles ----------

const crewRoles = [
  "swordsman",
  "cook",
  "navigator",
  "sniper"
];


// ---------- Helpers ----------

function getCharacter(id) {
  return characters[id] || null;
}


// ---------- Render Crew ----------

function renderCrew() {

  const captainId =
    state.currentCharacterId;

  const captain =
    getCharacter(captainId);


  // ----- Captain -----

  const captainContainer =
    document.getElementById("captain-character");

  if (captainContainer && captain) {

    captainContainer.innerHTML = `
      <img
        src="${captain.image}"
        alt="${captain.name}"
        class="crew-character-image"
      >

      <div class="crew-character-name">
        ${captain.name}
      </div>
    `;

  }


  // ----- Roles -----

  crewRoles.forEach((role) => {

    const container =
      document.getElementById(`${role}-character`);

    if (!container) return;


    const characterId =
      state.crew?.[role];

    const character =
      getCharacter(characterId);


    // Empty role
    if (!character) {

      container.innerHTML = `
        <button
          class="empty-role-btn"
          data-role="${role}"
        >
          +
        </button>
      `;

      return;
    }


    // Character assigned
    container.innerHTML = `

      <img
        src="${character.image}"
        alt="${character.name}"
        class="crew-character-image"
      >

      <div class="crew-character-name">
        ${character.name}
      </div>

      <button
        class="change-role-btn"
        data-role="${role}"
      >
        Change
      </button>

    `;

  });


  bindCrewButtons();

  renderCharacterList();

}


// ---------- Character List ----------

function renderCharacterList() {

  const container =
    document.getElementById("acquired-characters");

  if (!container) return;


  container.innerHTML = "";


  state.unlockedCharacters.forEach((characterId) => {

    const character =
      getCharacter(characterId);

    if (!character) return;


    // Don't show captain in available list
    const isCaptain =
      characterId ===
      state.currentCharacterId;


    // Check whether already assigned
    const assignedRole =
      crewRoles.find(
        role =>
          state.crew?.[role] === characterId
      );


    const card =
      document.createElement("article");

    card.className =
      "acquired-character-card";


    card.innerHTML = `

      <img
        src="${character.image}"
        alt="${character.name}"
        class="acquired-character-image"
      >

      <div class="acquired-character-info">

        <strong>
          ${character.name}
        </strong>

        <span>
          ${
            isCaptain
              ? "Captain"
              : assignedRole
                ? assignedRole
                : "Available"
          }
        </span>

      </div>

    `;


    // Captain cannot be assigned another role
    if (!isCaptain) {

      card.addEventListener(
        "click",
        () => openRoleSelection(
          characterId
        )
      );

    }


    container.appendChild(card);

  });

}


// ---------- Role Selection ----------

let selectedCharacterId = null;


function openRoleSelection(characterId) {

  selectedCharacterId =
    characterId;


  const modal =
    document.getElementById("role-modal");

  if (!modal) return;


  modal.classList.remove("hidden");


  renderRoleOptions();

}


function renderRoleOptions() {

  const container =
    document.getElementById("role-options");

  if (!container) return;


  container.innerHTML = "";


  crewRoles.forEach((role) => {

    const button =
      document.createElement("button");

    button.className =
      "role-option-btn";


    const assignedCharacterId =
      state.crew?.[role];

    const assignedCharacter =
      getCharacter(
        assignedCharacterId
      );


    button.innerHTML = `

      <strong>
        ${capitalize(role)}
      </strong>

      <span>
        ${
          assignedCharacter
            ? assignedCharacter.name
            : "Empty"
        }
      </span>

    `;


    button.addEventListener(
      "click",
      () => assignCharacterToRole(
        selectedCharacterId,
        role
      )
    );


    container.appendChild(button);

  });

}


// ---------- Assign Character ----------

async function assignCharacterToRole(
  characterId,
  newRole
) {

  if (!state.crew) {
    state.crew = {};
  }


  // Remove character from any previous role
  crewRoles.forEach((role) => {

    if (
      state.crew[role] ===
      characterId
    ) {

      state.crew[role] =
        null;

    }

  });


  // Assign character to new role
  state.crew[newRole] =
    characterId;


  try {

    await saveUserData(
      currentUser.uid,
      {
        crew: state.crew
      }
    );


    closeRoleModal();

    renderCrew();


  } catch (error) {

    console.error(
      "Failed to save crew:",
      error
    );

    alert(
      "Couldn't save your crew. Try again."
    );

  }

}


// ---------- Change Existing Role ----------

function bindCrewButtons() {

  document
    .querySelectorAll(
      ".empty-role-btn"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          openCharacterSelection(
            button.dataset.role
          );

        }
      );

    });


  document
    .querySelectorAll(
      ".change-role-btn"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          openCharacterSelection(
            button.dataset.role
          );

        }
      );

    });

}


// ---------- Select Character For Role ----------

let targetRole = null;


function openCharacterSelection(role) {

  targetRole = role;


  const modal =
    document.getElementById(
      "character-modal"
    );

  if (!modal) return;


  modal.classList.remove("hidden");


  renderCharacterOptions();

}


function renderCharacterOptions() {

  const container =
    document.getElementById(
      "character-options"
    );

  if (!container) return;


  container.innerHTML = "";


  state.unlockedCharacters.forEach(
    (characterId) => {

      // Captain cannot have another role
      if (
        characterId ===
        state.currentCharacterId
      ) {
        return;
      }


      const character =
        getCharacter(characterId);

      if (!character) return;


      const button =
        document.createElement("button");

      button.className =
        "character-option-btn";


      button.innerHTML = `

        <img
          src="${character.image}"
          alt="${character.name}"
        >

        <span>
          ${character.name}
        </span>

      `;


      button.addEventListener(
        "click",
        () => {

          assignCharacterToRole(
            characterId,
            targetRole
          );

          closeCharacterModal();

        }
      );


      container.appendChild(button);

    }
  );

}


// ---------- Modal ----------

function closeRoleModal() {

  const modal =
    document.getElementById(
      "role-modal"
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
  }

}


function closeCharacterModal() {

  const modal =
    document.getElementById(
      "character-modal"
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
  }

}


// ---------- Utility ----------

function capitalize(text) {

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );

}


// ---------- Navigation ----------

document
  .querySelectorAll(".nav-item")
  .forEach((item) => {

    item.addEventListener(
      "click",
      () => {

        const page =
          item.dataset.page;

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
      await loadUserData(
        user.uid
      );


    if (!data) {

      console.error(
        "User data not found."
      );

      return;

    }


    state = {

      currentCharacterId:
        data.currentCharacterId,

      unlockedCharacters:
        data.unlockedCharacters ?? [],

      crew:
        data.crew ?? {
          swordsman: null,
          cook: null,
          navigator: null,
          sniper: null
        }

    };


    renderCrew();


    document
      .getElementById(
        "loading-screen"
      )
      .classList.add(
        "hidden"
      );


    document
      .getElementById(
        "crew-app"
      )
      .classList.remove(
        "hidden"
      );


  } catch (error) {

    console.error(
      "Failed to load crew:",
      error
    );

  }

});
