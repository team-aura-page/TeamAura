// ==========================================
// 1. IMPORTAR FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ==========================================
// 2. CONFIGURACIÓN
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBmRZZTNFgDaDkHCuF-DMtogH9RNSf_QTU",
    authDomain: "page-aura.firebaseapp.com",
    databaseURL: "https://page-aura-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "page-aura",
    storageBucket: "page-aura.firebasestorage.app",
    messagingSenderId: "466722575466",
    appId: "1:466722575466:web:29583cefae1320c2cc6613"
};

// ==========================================
// 3. CONSTANTES Y UTILIDADES
// ==========================================
const REPO_URL = "https://raw.githubusercontent.com/team-aura-page/TeamAura/main/";

// ==========================================
// 4. INICIAR LA APP
// ==========================================
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// REFERENCIAS DOM
const monthSelector = document.getElementById('monthSelector');
const grid = document.getElementById('trackerGrid');
const statsContainer = document.getElementById('statsContainer');
const totalCount = document.getElementById('totalCount');

// CONFIGURACIÓN INICIAL DEL CALENDARIO
const now = new Date();
const currentMonth = now.toISOString().slice(0, 7); 
if (monthSelector) {
    monthSelector.value = currentMonth;
    monthSelector.addEventListener('change', (e) => {
        renderMonth(e.target.value);
    });
}

// VARIABLE GLOBAL
let allCaptures = [];

// ==========================================
// 5. LÓGICA DEL TRACKER (CORREGIDA ✅)
// ==========================================

async function loadData() {
    try {
        console.log("📡 Conectando a Firebase...");
        
        const snapshot = await get(ref(db, 'users'));
        const data = snapshot.val();

        if (!data) {
            grid.innerHTML = '<h3 style="grid-column: 1/-1; text-align:center;">No hay datos en la base de datos.</h3>';
            return;
        }

        allCaptures = [];
        const warsList = Array.isArray(data) ? data : Object.values(data);
        
        // --- 🛡️ AQUÍ ESTÁ EL ARREGLO DE SEGURIDAD ---
        warsList.forEach(war => {
            if (war && war.captures) { // Verificamos que 'war' existe
                const capturesList = Array.isArray(war.captures) ? war.captures : Object.values(war.captures);
                
                // Limpiamos los nulos antes de guardarlos
                capturesList.forEach(cap => {
                    // Solo guardamos si la captura existe (no es null) Y tiene fecha
                    if (cap && cap.date) {
                        allCaptures.push(cap);
                    }
                });
            }
        });
        // ---------------------------------------------

        console.log(`✅ Datos limpios cargados: ${allCaptures.length} capturas.`);
        
        if (monthSelector) {
            renderMonth(monthSelector.value);
        }

    } catch (error) {
        console.error("❌ Error:", error);
        if (grid) grid.innerHTML = `<h3 style="color: red; text-align:center;">Error: ${error.message}</h3>`;
    }
}

function renderMonth(selectedMonth) {
    if (!grid) return;
    
    // Filtramos usando la fecha limpia
    const filtered = allCaptures.filter(c => c.date.startsWith(selectedMonth));
    
    // Ordenamos
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // UI Updates
    if (statsContainer) statsContainer.style.display = 'flex';
    if (totalCount) totalCount.innerText = filtered.length;

    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 50px; opacity: 0.6;">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201-question.png" style="width:100px;">
                <p>Ningún shiny registrado este mes... 😴</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(capture => {
        const card = document.createElement('div');
        card.className = 'shiny-card';
        
        const fechaParts = capture.date.split('-');
        const fechaBonita = `${fechaParts[2]}/${fechaParts[1]}`;

        const spriteUrl = `https://play.pokemonshowdown.com/sprites/gen5ani-shiny/${capture.pokemon}.gif`;

        card.innerHTML = `
            <div class="team-badge">
                ${capture.team === 'A' ? '🌿' : '🟣'}
            </div>
            <img src="${spriteUrl}" alt="${capture.pokemon}" class="shiny-sprite" 
                 onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
            
            <h3 style="text-transform: capitalize; margin:0;">${capture.pokemon}</h3>
            <div class="trainer-name">${capture.trainer}</div>
            
            <div style="font-size: 0.8rem; color: #aaa; margin-top:5px; font-style: italic;">
                ${capture.method || 'Método desconocido'}
            </div>
            
            <div class="capture-date">📅 ${fechaBonita}</div>
        `;
        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
}

loadData();