import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBmRZZTNfGDaDkHCuf-DMtogH9RNSf_QTU",
    authDomain: "page-aura.firebaseapp.com",
    databaseURL: "https://page-aura-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "page-aura",
    storageBucket: "page-aura.firebasestorage.app",
    messagingSenderId: "466722575466",
    appId: "1:466722575466:web:29583cefae1320c2cc6613"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const prevBtn = document.getElementById('prevMonthBtn');
const nextBtn = document.getElementById('nextMonthBtn');
const monthDisplay = document.getElementById('currentMonthDisplay');

const normalGrid = document.getElementById('trackerGrid');
const rareGrid = document.getElementById('rareGrid');
const rareZone = document.getElementById('rareZone');
const normalTitle = document.getElementById('normalTitle');
const statsContainer = document.getElementById('statsContainer');
const totalCount = document.getElementById('totalCount');
const adminBtn = document.getElementById('adminSaveBtn');

let globalUsersData = {};
let displayedCaptures = [];
let isAdmin = false;

let currentTrackerDate = new Date();
const urlParams = new URLSearchParams(window.location.search);

onAuthStateChanged(auth, (user) => {
    if (user) {
        enableAdminMode();
    }
});

if (urlParams.get('admin') === 'true') {
    setTimeout(() => {
        if (!auth.currentUser) {

            const email = prompt("📧 ZONA ADMIN\nIntroduce tu CORREO de administrador:");

            if (email) {
                const password = prompt("🔒 ZONA ADMIN\nIntroduce tu CONTRASEÑA:");

                if (password) {
                    signInWithEmailAndPassword(auth, email, password)
                        .then(() => {
                            alert("✅ Acceso concedido. Conectado a la base de datos.");
                        })
                        .catch((error) => {
                            console.error("Error Auth:", error);
                            alert("❌ Error: Correo o contraseña incorrectos.");
                        });
                }
            }
        }
    }, 500);
}

function enableAdminMode() {
    if (isAdmin) return;
    isAdmin = true;
    if (adminBtn) adminBtn.style.display = 'block';
    console.log("🔓 MODO ADMIN ACTIVADO (Usuario Autenticado)");

    updateMonthUI();
}

function updateMonthUI() {
    const monthName = currentTrackerDate.toLocaleDateString('es-ES', { month: 'long' });
    const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = currentTrackerDate.getFullYear();

    if (monthDisplay) {
        monthDisplay.innerHTML = `${monthCapitalized} <span style="margin-left: 10px;">${year}</span>`;
    }
    const isStartLimit = (year === 2026 && currentTrackerDate.getMonth() === 0);

    if (prevBtn) {
        if (isStartLimit) {
            prevBtn.style.opacity = "0.2";
            prevBtn.style.pointerEvents = "none";
        } else {
            prevBtn.style.opacity = "1";
            prevBtn.style.pointerEvents = "auto";
        }
    }

    const realDate = new Date();
    const isFutureLimit = (
        year === realDate.getFullYear() &&
        currentTrackerDate.getMonth() === realDate.getMonth()
    );

    if (nextBtn) {
        if (isFutureLimit) {
            nextBtn.style.opacity = "0.2";
            nextBtn.style.pointerEvents = "none";
        } else {
            nextBtn.style.opacity = "1";
            nextBtn.style.pointerEvents = "auto";
        }
    }
    const monthNum = String(currentTrackerDate.getMonth() + 1).padStart(2, '0');
    const formattedDateKey = `${year}-${monthNum}`;

    if (displayedCaptures.length > 0 || Object.keys(globalUsersData).length > 0) {
        if (displayedCaptures.length === 0 && Object.keys(globalUsersData).length === 0) {
        } else {
            renderMonth(formattedDateKey);
        }
    }
}

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
        currentTrackerDate.setMonth(currentTrackerDate.getMonth() - 1);
        updateMonthUI();
    });
    nextBtn.addEventListener('click', () => {
        currentTrackerDate.setMonth(currentTrackerDate.getMonth() + 1);
        updateMonthUI();
    });
}
async function loadData() {
    try {
        console.log("📡 Cargando datos...");
        const snapshot = await get(ref(db, 'users'));
        const data = snapshot.val();

        if (!data) return;

        globalUsersData = data;
        displayedCaptures = [];

        Object.keys(data).forEach(userKey => {
            const user = data[userKey];
            if (user && user.equipo) {
                Object.keys(user.equipo).forEach(pokeKey => {
                    const poke = user.equipo[pokeKey];
                    if (poke) {
                        const captureData = {
                            ...poke,
                            trainer: user.nombre || 'Anónimo',
                            refPath: `users/${userKey}/equipo/${pokeKey}`
                        };

                        if (!captureData.date) {
                            captureData.date = "2024-01-01";
                            captureData.isLegacy = true;
                        }

                        displayedCaptures.push(captureData);
                    }
                });
            }
        });

        window.firstCaptureDates = {};

        displayedCaptures.forEach(cap => {
            const species = (cap.pokemon || 'unown').toLowerCase().trim();
            const capDate = new Date(cap.date);

            if (!window.firstCaptureDates[species]) {
                window.firstCaptureDates[species] = capDate;
            } else {
                if (capDate < window.firstCaptureDates[species]) {
                    window.firstCaptureDates[species] = capDate;
                }
            }
        });

        updateMonthUI();

    } catch (error) {
        console.error("Error cargando:", error);
        if (normalGrid) normalGrid.innerHTML = '<p>Error cargando datos.</p>';
    }
}
function renderMonth(selectedMonth) {
    const filtered = displayedCaptures.filter(c => c.date && c.date.startsWith(selectedMonth));
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (totalCount) totalCount.innerText = filtered.length;
    if (statsContainer) statsContainer.style.display = 'flex';

    if (normalGrid) normalGrid.innerHTML = '';
    if (rareGrid) rareGrid.innerHTML = '';
    const leaderboardDiv = document.getElementById('leaderboard');
    if (leaderboardDiv) leaderboardDiv.innerHTML = '';

    if (filtered.length === 0) {
        if (rareZone) rareZone.style.display = 'none';
        if (normalTitle) normalTitle.style.display = 'none';

        if (normalGrid) normalGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; opacity: 0.6; color: #ccc;">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201-question.png" style="width:100px; margin-bottom: 20px;">
                <p style="font-size: 1.2rem;">Ningún shiny registrado en este mes... </p>
            </div>
        `;
        return;
    }

    if (leaderboardDiv) {
        const MEDAL_IMAGES = [
            "../icons/primer-puesto.png",
            "../icons/segundo-puesto.png",
            "../icons/tercer-puesto.png"
        ];

        const counts = {};
        filtered.forEach(cap => {
            const trainer = cap.trainer || "Anónimo";
            counts[trainer] = (counts[trainer] || 0) + 1;
        });

        const sortedRanking = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        let rankHTML = '';

        sortedRanking.forEach((item, index) => {
            let medalContent = '';
            let rankClass = '';

            if (index === 0) {
                rankClass = 'rank-1';
                medalContent = `<img src="${MEDAL_IMAGES[0]}" class="custom-medal" alt="1º">`;
            }
            else if (index === 1) {
                rankClass = 'rank-2';
                medalContent = `<img src="${MEDAL_IMAGES[1]}" class="custom-medal" alt="2º">`;
            }
            else if (index === 2) {
                rankClass = 'rank-3';
                medalContent = `<img src="${MEDAL_IMAGES[2]}" class="custom-medal" alt="3º">`;
            }

            rankHTML += `
                <div class="leaderboard-item ${rankClass}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${medalContent}
                        <span style="font-weight: bold;">${item.name}</span>
                    </div>
                    <span class="rank-count">${item.count}</span>
                </div>
            `;
        });
        leaderboardDiv.innerHTML = rankHTML;
    }

    let hasRares = false;

    filtered.forEach(capture => {
        const isRare = capture.rarity === 'rare';
        if (isRare) hasRares = true;

        const card = createCard(capture);

        if (isRare) {
            card.classList.add('is-rare');
            card.style.border = "2px solid #ffd700";
        } else {
            card.style.border = "1px solid #333";
        }
        if (isAdmin) {
            card.title = "ADMIN: Clic Izd = Rareza | Clic Der = Shinydex Nuevo";
            card.onclick = () => toggleRarity(capture, selectedMonth);
            card.oncontextmenu = (e) => {
                e.preventDefault();
                toggleNuevoShinydex(capture, selectedMonth);
            };
        }

        if (isRare) {
            if (rareGrid) rareGrid.appendChild(card);
        } else {
            if (normalGrid) normalGrid.appendChild(card);
        }
    });

    if (hasRares || isAdmin) {
        if (rareZone) rareZone.style.display = 'block';
        if (normalTitle) normalTitle.style.display = 'block';
    } else {
        if (rareZone) rareZone.style.display = 'none';
        if (normalTitle) normalTitle.style.display = 'none';
    }
}

function createCard(capture) {
    const card = document.createElement('div');
    card.className = 'tracker-poke-card';

    const pokeName = (capture.pokemon || 'unown').toLowerCase();
    const spriteUrl = `https://play.pokemonshowdown.com/sprites/gen5ani-shiny/${pokeName}.gif`;

    const SPECIAL_ICONS = {
        'secret': '../icons/secretshiny.png',
        'alpha': '../icons/alfa.png',
        'fossil': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/helix-fossil.png',
        'safari': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/safari-ball.png',
        'egg': '../icons/eggshiny.png'
    };

    let specialIconHTML = '';

    if (capture.icono && SPECIAL_ICONS[capture.icono]) {
        const iconUrl = SPECIAL_ICONS[capture.icono];
        specialIconHTML += `
            <img src="${iconUrl}" class="tracker-special-icon" alt="${capture.icono}" title="Shiny Especial: ${capture.icono}">
        `;
    }

    const species = (capture.pokemon || 'unown').toLowerCase().trim();
    const isAutoNew = window.firstCaptureDates &&
        window.firstCaptureDates[species] &&
        capture.date &&
        (new Date(capture.date).getTime() === window.firstCaptureDates[species].getTime());

    if (capture.newShinydex === true || (isAutoNew && capture.newShinydex !== false)) {
        specialIconHTML += `
            <img src="../icons/new.png" class="new-shinydex-icon" alt="Nuevo Shinydex" title="¡Nuevo en la Shinydex!">
        `;
    }
    // -------------------------------------

    let fechaBonita = "??/??";
    if (capture.date && capture.date.includes('-')) {
        const parts = capture.date.split('-');
        fechaBonita = `${parts[2]}/${parts[1]}`;
    }

    card.innerHTML = `
        ${specialIconHTML} <img src="${spriteUrl}" alt="${pokeName}" class="tracker-poke-sprite" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
        <h3 style="text-transform: capitalize; margin: 0; color: white; font-size: 1.2rem;">${pokeName}</h3>
        <div class="tracker-trainer-text">${capture.trainer}</div>
        <div class="tracker-date-badge">📅 ${fechaBonita}</div>
    `;
    return card;
}
function toggleRarity(capture, selectedMonth) {
    if (capture.rarity === 'rare') {
        delete capture.rarity;
    } else {
        capture.rarity = 'rare';
    }

    renderMonth(selectedMonth);

    if (adminBtn) {
        adminBtn.innerText = "💾 HAY CAMBIOS SIN GUARDAR";
        adminBtn.style.background = "#ff9800";
    }
}

function toggleNuevoShinydex(capture, selectedMonth) {
    if (capture.newShinydex) {
        delete capture.newShinydex;
    } else {
        capture.newShinydex = true;
    }

    renderMonth(selectedMonth);

    if (adminBtn) {
        adminBtn.innerText = "💾 HAY CAMBIOS SIN GUARDAR";
        adminBtn.style.background = "#ff9800";
    }
}

if (adminBtn) {
    adminBtn.addEventListener('click', async () => {
        try {
            adminBtn.innerText = "⏳ Guardando...";
            adminBtn.style.background = "#9e9e9e";

            const updates = {};

            displayedCaptures.forEach(cap => {
                const rarityValue = cap.rarity === 'rare' ? 'rare' : null;
                updates[`${cap.refPath}/rarity`] = rarityValue;
                const newShinydexValue = cap.newShinydex ? true : null;
                updates[`${cap.refPath}/newShinydex`] = newShinydexValue;
            });

            await update(ref(db), updates);

            adminBtn.innerText = "✅ CAMBIOS GUARDADOS";
            adminBtn.style.background = "#4caf50";

            setTimeout(() => {
                adminBtn.innerText = "💾 GUARDAR CAMBIOS";
                adminBtn.style.background = "#e91e63";
            }, 2000);

        } catch (error) {
            console.error("Error guardando:", error);
            alert("❌ Error: No tienes permiso de escritura. ¿Estás logueado como Admin?");
            adminBtn.innerText = "❌ ERROR PERMISO";
            adminBtn.style.background = "#f44336";
        }
    });
}
loadData();