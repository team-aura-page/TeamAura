// ==========================================
// 1. IMPORTAR FIREBASE & CONSTANTES
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// --- TU CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBmRZZTNFgDaDkHCuF-DMtogH9RNSf_QTU",
    authDomain: "page-aura.firebaseapp.com",
    databaseURL: "https://page-aura-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "page-aura",
    storageBucket: "page-aura.firebasestorage.app",
    messagingSenderId: "466722575466",
    appId: "1:466722575466:web:29583cefae1320c2cc6613"
};

// INICIAR FIREBASE
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// CONSTANTES VISUALES
const URL_SHINY = "https://play.pokemonshowdown.com/sprites/gen5ani-shiny/";
const main = document.getElementById("shinydex-main");
const index = document.getElementById("shinydex-index");
const counterGlobal = document.getElementById("shiny-counter");
const searchInput = document.getElementById("search");

const GENERATIONS = [
    { label: "Generación 1", short: "01", min: 1, max: 151 },
    { label: "Generación 2", short: "02", min: 152, max: 251 },
    { label: "Generación 3", short: "03", min: 252, max: 386 },
    { label: "Generación 4", short: "04", min: 387, max: 493 },
    { label: "Generación 5", short: "05", min: 494, max: 649 }
];

let globalCaptured = 0;
let generationBlocks = [];
let tooltipElement = null;

// ==========================================
// 2. CONEXIÓN EN TIEMPO REAL (REEMPLAZA AL FETCH)
// ==========================================
const usersRef = ref(db, 'users');

onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    
    // Si no hay datos, salimos
    if (!data) return;

    // Convertimos a array si es necesario
    const playersData = Array.isArray(data) ? data : Object.values(data);
    
    // PROCESAMIENTO DE DATOS (Igual que antes, pero dentro del listener)
    const dexData = new Map();

    playersData.forEach(jugador => {
        // Aseguramos que tenga equipo
        const equipo = jugador.equipo || [];
        
        equipo.forEach(poke => {
            // Ignorar flees
            if (poke.safari === 'flee') return;

            const name = (poke.pokemon || 'unknown').toLowerCase().trim();
            
            if (!dexData.has(name)) {
                dexData.set(name, { status: null, owners: [] });
            }

            const entry = dexData.get(name);

            // 1. Añadir dueño si no está
            if (!entry.owners.includes(jugador.nombre)) {
                entry.owners.push(jugador.nombre);
            }

            // 2. Lógica de estado (Verde gana a Amarillo)
            if (poke.live === 'no') {
                if (entry.status !== 'normal') entry.status = 'non-live';
            } else {
                entry.status = 'normal';
            }
        });
    });

    // ¡PINTAMOS LA DEX CON LOS DATOS FRESCOS!
    createGlobalTooltip(); // Aseguramos que el tooltip exista
    initShinyDex(dexData);
});

// ==========================================
// 3. FUNCIONES DE UTILIDAD (TU LÓGICA VISUAL)
// ==========================================

function formatName(name) {
    const fixes = { 
        nidoranf: "Nidoran♀", nidoranm: "Nidoran♂", 
        mrmime: "Mr. Mime", farfetchd: "Farfetch'd", 
        hooh: "Ho-Oh", porygonz: "Porygon-Z" 
    };
    return fixes[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

function getColorByPercentage(percent) {
    const hue = (percent * 1.2); 
    const saturation = percent;
    const lightness = 60 - (percent * 0.1); 
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function animateValue(element, start, end, duration, isGlobal = false, currentObtained = 0, total = 0) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentPercent = Math.floor(progress * (end - start) + start);
        const currentColor = getColorByPercentage(currentPercent);
        
        if (isGlobal) {
            element.style.color = currentColor;
            element.innerHTML = `${currentObtained} / ${total} <span class="percentage-text" style="color: ${currentColor}">${currentPercent}%</span>`;
        } else {
            const wrapper = element.querySelector('.count-wrapper');
            const percSpan = element.querySelector('.percentage-text');
            if (wrapper) wrapper.style.color = currentColor;
            if (percSpan) percSpan.textContent = `${currentPercent}%`;
        }
        
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// === TOOLTIP GLOBAL ===
function createGlobalTooltip() {
    if (document.getElementById('global-tooltip')) return;
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'global-tooltip';
    document.body.appendChild(tooltipElement);
}

function showTooltip(e) {
    const ownersData = e.currentTarget.dataset.owners;
    if (!ownersData || !tooltipElement) return;

    const owners = JSON.parse(ownersData);
    const ownersList = owners.map(o => `<li>${o}</li>`).join("");
    const needsScroll = owners.length > 5;
    const scrollClass = needsScroll ? 'scrolling' : '';

    tooltipElement.innerHTML = `
        <span class="tooltip-title">Capturado por (${owners.length})</span>
        <div class="tooltip-scroll-mask">
            <ul class="tooltip-names ${scrollClass}">
                ${ownersList}
            </ul>
        </div>
    `;

    tooltipElement.classList.add('visible');
    moveTooltip(e); 
}

function moveTooltip(e) {
    if (!tooltipElement) return;
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    tooltipElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function hideTooltip() {
    if (tooltipElement) tooltipElement.classList.remove('visible');
}

// ==========================================
// 4. RENDERIZADO (INIT)
// ==========================================

function initShinyDex(dexData) {
    globalCaptured = 0;
    generationBlocks = [];
    main.innerHTML = ""; 
    index.innerHTML = "";

    GENERATIONS.forEach((gen, gIndex) => {
        const genPokemonList = GEN1_5_POKEMON.filter(p => p.id >= gen.min && p.id <= gen.max);
        let genCaptured = 0;

        const block = document.createElement("section");
        block.className = "gen-block";
        block.id = `gen-${gIndex}`;

        const grid = document.createElement("div");
        grid.className = "shinydex-grid";

        genPokemonList.forEach((pokeObj) => {
            const dataEntry = dexData.get(pokeObj.name);
            const status = dataEntry ? dataEntry.status : undefined;
            const owners = dataEntry ? dataEntry.owners : [];

            if (status !== undefined) { genCaptured++; globalCaptured++; }

            let statusClass = "missing";
            if (status === 'normal') statusClass = "captured";
            else if (status === 'non-live') statusClass = "captured-live-no";

            const card = document.createElement("div");
            card.className = `shiny-card ${statusClass}`;
            
            card.innerHTML = `
                <span class="poke-number">#${String(pokeObj.id).padStart(3, "0")}</span>
                <div class="sprite-wrapper">
                    <img src="${URL_SHINY}${pokeObj.name}.gif" loading="lazy" alt="${pokeObj.name}">
                </div>
                <span class="poke-name">${formatName(pokeObj.name)}</span>
            `;

            if (owners.length > 0 && status === 'normal') {
                card.dataset.owners = JSON.stringify(owners);
                card.addEventListener('mouseenter', showTooltip);
                card.addEventListener('mousemove', moveTooltip);
                card.addEventListener('mouseleave', hideTooltip);
            }

            grid.appendChild(card);
        });

        const title = document.createElement("h3");
        title.className = "gen-title";
        const percentGen = Math.round((genCaptured / genPokemonList.length) * 100);
        title.innerHTML = `${gen.label} <span class="count-wrapper">
            <span class="gen-count-badge">(${genCaptured} / ${genPokemonList.length})</span>
            <span class="percentage-text">0%</span></span>`;
        
        block.appendChild(title);
        block.appendChild(grid);
        main.appendChild(block);
        generationBlocks.push({ block, gen, title, percentGen });

        const link = document.createElement("a");
        link.href = `#gen-${gIndex}`;
        link.textContent = gen.short;
        index.appendChild(link);
    });

    // Animaciones
    setTimeout(() => {
        const totalPokes = GEN1_5_POKEMON.length;
        animateValue(counterGlobal, 0, Math.round((globalCaptured/totalPokes)*100), 1500, true, globalCaptured, totalPokes);
        generationBlocks.forEach(g => animateValue(g.title, 0, g.percentGen, 1500));
        index.querySelectorAll('a').forEach((l, idx) => setTimeout(() => l.classList.add('reveal'), idx * 100));
        
        initCardsReveal();
    }, 300);

    initScrollSpy();
}

// ==========================================
// 5. ANIMACIONES EXTRA Y LISTENERS
// ==========================================

function initCardsReveal() {
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.shiny-card').forEach(card => revealObserver.observe(card));
}

if (searchInput) {
    searchInput.addEventListener("input", () => {
        const value = searchInput.value.toLowerCase();
        generationBlocks.forEach(g => {
            let visible = 0;
            g.block.querySelectorAll(".shiny-card").forEach(card => {
                const match = card.innerText.toLowerCase().includes(value);
                card.style.display = match ? "flex" : "none";
                if (match) visible++;
            });
            g.block.style.display = visible > 0 ? "block" : "none";
        });
    });
}

function initScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.shinydex-index a').forEach(a => a.classList.remove('active'));
                const activeLink = document.querySelector(`.shinydex-index a[href="#${entry.target.id}"]`);
                if (activeLink) activeLink.classList.add('active');
            }
        });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.gen-block').forEach(section => observer.observe(section));
}