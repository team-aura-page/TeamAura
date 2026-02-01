// ==========================================
// 1. IMPORTAR FIREBASE (Database + Auth)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// 👇 Importamos las funciones de autenticación
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ==========================================
// 2. CONFIGURACIÓN
// ==========================================
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
const auth = getAuth(app); // 👈 Iniciamos el sistema de Auth

// REFERENCIAS DOM
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

// Variables globales
let globalUsersData = {}; 
let displayedCaptures = [];
let isAdmin = false;

// Estado de la fecha actual
let currentTrackerDate = new Date(); // Empieza hoy

// ==========================================
// 🔐 SISTEMA DE SEGURIDAD REAL (LOGIN MANUAL)
// ==========================================
const urlParams = new URLSearchParams(window.location.search);

// 1. Escuchar si ya estamos logueados (para no pedir pass cada vez que recargues)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Si Firebase dice que hay usuario, activamos modo Admin
        enableAdminMode();
    }
});

// 2. Si ponen ?admin=true en la URL y NO están logueados, pedimos CREDENCIALES
if (urlParams.get('admin') === 'true') {
    // Esperamos un poco para no chocar con la carga inicial
    setTimeout(() => {
        if (!auth.currentUser) {
            
            // PASO A: Pedir Correo
            const email = prompt("📧 ZONA ADMIN\nIntroduce tu CORREO de administrador:");
            
            if (email) {
                // PASO B: Pedir Contraseña (solo si escribió correo)
                const password = prompt("🔒 ZONA ADMIN\nIntroduce tu CONTRASEÑA:");
                
                if (password) {
                    // PASO C: Intentar Login con lo que ha escrito
                    signInWithEmailAndPassword(auth, email, password)
                        .then(() => {
                            alert("✅ Acceso concedido. Conectado a la base de datos.");
                            // El onAuthStateChanged de arriba activará la interfaz
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
    if (isAdmin) return; // Si ya es admin, no hacemos nada
    isAdmin = true;
    if (adminBtn) adminBtn.style.display = 'block';
    console.log("🔓 MODO ADMIN ACTIVADO (Usuario Autenticado)");
    
    // Recargamos la interfaz para que aparezcan los bordes de edición, etc.
    updateMonthUI(); 
}

// ==========================================
// 📅 LÓGICA DE NAVEGACIÓN DE MESES
// ==========================================

function updateMonthUI() {
    // 1. PINTAR EL TÍTULO (Mes y Año)
    const monthName = currentTrackerDate.toLocaleDateString('es-ES', { month: 'long' });
    const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = currentTrackerDate.getFullYear();

    if (monthDisplay) {
        monthDisplay.innerHTML = `${monthCapitalized} <span style="margin-left: 10px;">${year}</span>`;
    }

    // ====================================================
    // 🛑 ZONA DE LÍMITES (BLOQUEO DE BOTONES)
    // ====================================================
    
    // --- LÍMITE 1: EL PASADO (Enero 2026) ---
    // Si estamos en Enero (0) de 2026, bloqueamos ir atrás.
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
           // Esperamos
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

// ==========================================
// 3. CARGAR DATOS
// ==========================================

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

        updateMonthUI();

    } catch (error) {
        console.error("Error cargando:", error);
        if (normalGrid) normalGrid.innerHTML = '<p>Error cargando datos.</p>';
    }
}

// ==========================================
// 4. PINTAR (MODO GOLD ACTIVADO 🏆)
// ==========================================
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

    // LEADERBOARD
    if (leaderboardDiv) {
        // 1. CONFIGURA AQUÍ TUS IMÁGENES
        const MEDAL_IMAGES = [
            "../icons/primer-puesto.png",   // Imagen para el 1º
            "../icons/segundo-puesto.png", // Imagen para el 2º
            "../icons/tercer-puesto.png"  // Imagen para el 3º
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

            // Asignamos clase y la imagen correspondiente según el índice (0, 1, 2)
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

            // Construimos el HTML
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

    // CARTAS
    let hasRares = false;

    filtered.forEach(capture => {
        const isRare = capture.rarity === 'rare';
        if (isRare) hasRares = true;

        const card = createCard(capture);
        
        // --- 1. ESTÉTICA (PARA TODOS) ---
        // Aquí aplicamos el borde dorado y la clase CSS para que TODOS lo vean
        if (isRare) {
            card.classList.add('is-rare'); // Activa el brillo del CSS
            card.style.border = "2px solid #ffd700"; // Borde dorado
        } else {
            card.style.border = "1px solid #333";
        }
        
        // --- 2. FUNCIONALIDAD (SOLO ADMIN) ---
        // Solo el admin puede hacer clic para editar
        if (isAdmin) {
            card.style.cursor = "pointer";
            card.title = "ADMIN: Clic para cambiar rareza";
            card.onclick = () => toggleRarity(capture, selectedMonth); 
        }

        // --- 3. COLOCACIÓN ---
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
    
    let fechaBonita = "??/??";
    if (capture.date && capture.date.includes('-')) {
        const parts = capture.date.split('-'); 
        fechaBonita = `${parts[2]}/${parts[1]}`;
    }

    card.innerHTML = `
        <img src="${spriteUrl}" alt="${pokeName}" class="tracker-poke-sprite" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
        <h3 style="text-transform: capitalize; margin: 0; color: white; font-size: 1.2rem;">${pokeName}</h3>
        <div class="tracker-trainer-text">${capture.trainer}</div>
        <div class="tracker-date-badge">📅 ${fechaBonita}</div>
    `;
    return card;
}

// ==========================================
// 5. FUNCIONES DE GUARDADO (ADMIN)
// ==========================================

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

if (adminBtn) {
    adminBtn.addEventListener('click', async () => {
        try {
            adminBtn.innerText = "⏳ Guardando...";
            adminBtn.style.background = "#9e9e9e";
            
            const updates = {};
            
            displayedCaptures.forEach(cap => {
                const rarityValue = cap.rarity === 'rare' ? 'rare' : null;
                updates[`${cap.refPath}/rarity`] = rarityValue;
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

// Arrancar
loadData();