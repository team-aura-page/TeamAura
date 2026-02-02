import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
const firebaseConfig = {
    apiKey: "AIzaSyBmRZZTNFgDaDkHCuF-DMtogH9RNSf_QTU",
    authDomain: "page-aura.firebaseapp.com",
    databaseURL: "https://page-aura-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "page-aura",
    storageBucket: "page-aura.firebasestorage.app",
    messagingSenderId: "466722575466",
    appId: "1:466722575466:web:29583cefae1320c2cc6613"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const usersRef = ref(db, 'users');
const warsRef = ref(db, 'wars');

let globalUsers = [];
let globalWars = {};

onValue(usersRef, (snap) => {
    const val = snap.val();
    globalUsers = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    if (globalWars.activeWarId) initWar(globalUsers, globalWars);
});

onValue(warsRef, (snap) => {
    const val = snap.val();
    globalWars = val || {};
    if (globalUsers.length > 0) initWar(globalUsers, globalWars);
});

function initWar(mainData, warsData) {
    let warsList = [];
    if (warsData.wars && Array.isArray(warsData.wars)) {
        warsList = warsData.wars;
    } else if (warsData.wars) {
        warsList = Object.values(warsData.wars);
    }
    
    const activeWar = warsList.find(w => w.id === warsData.activeWarId);

    if (!activeWar) {
        console.warn("No hay guerra activa configurada en la base de datos.");
        return;
    }

    const containerA = document.getElementById('col-team-a');
    const containerB = document.getElementById('col-team-b');
    
    if (containerA) containerA.innerHTML = '';
    if (containerB) containerB.innerHTML = '';

    const processTeam = (teamList, teamLetter) => {
        let teamTotalScore = 0;
        
        const roster = teamList.map(trainerName => {
            
            const profile = mainData.find(p => p.nombre.toLowerCase() === trainerName.toLowerCase());
            let avatar = '../icons/unown.png'; 

            if (profile) {
                avatar = profile.avatar;
            } else {
                const guests = activeWar.guests || {};
                const guestKey = Object.keys(guests).find(k => k.toLowerCase() === trainerName.toLowerCase());
                if (guestKey) {
                    avatar = guests[guestKey];
                }
            }

            let allCaptures = [];
            if (activeWar.captures) {
                allCaptures = Array.isArray(activeWar.captures) 
                    ? activeWar.captures 
                    : Object.values(activeWar.captures);
            }

            const validCaptures = allCaptures.filter(c => {
                if (!c.trainer || !c.team) return false;
                const isTrainer = c.trainer.toLowerCase() === trainerName.toLowerCase();
                const isTeam = c.team === teamLetter;
                const isValidDate = c.date >= activeWar.startDate && c.date <= activeWar.endDate;
                return isTrainer && isTeam && isValidDate;
            });

            const score = validCaptures.reduce((total, capture) => {
                return total + (capture.points || 0);
            }, 0);

            teamTotalScore += score;

            return { 
                nombre: trainerName, 
                avatar, 
                score, 
                captures: validCaptures,
                team: teamLetter 
            };
        });

        roster.sort((a, b) => b.score - a.score);

        roster.forEach(player => {
            const card = document.createElement('div');
            card.className = 'war-card';
            card.onclick = () => openModal(player);

            card.innerHTML = `
                <img src="${player.avatar}" class="war-avatar" alt="${player.nombre}">
                <div class="war-info">
                    <span class="war-name">${player.nombre}</span>
                    <span class="war-count">Puntos: <strong>${player.score}</strong></span>
                </div>
            `;
            
            if (teamLetter === 'A' && containerA) containerA.appendChild(card);
            else if (teamLetter === 'B' && containerB) containerB.appendChild(card);
        });

        return teamTotalScore;
    };

    const scoreA = processTeam(activeWar.teams.A || [], 'A');
    const scoreB = processTeam(activeWar.teams.B || [], 'B');

    const scoreElA = document.getElementById('score-team-a');
    const scoreElB = document.getElementById('score-team-b');
    
    if (scoreElA) animateNumber(scoreElA, scoreA);
    if (scoreElB) animateNumber(scoreElB, scoreB);
    
    updateWarBar(scoreA, scoreB);
}

function updateWarBar(scoreA, scoreB) {
    const bar = document.getElementById('war-bar');
    if (!bar) return;

    const total = scoreA + scoreB;
    if (total === 0) {
        bar.style.width = '50%';
        return;
    }
    const percentA = (scoreA / total) * 100;
    bar.style.width = `${percentA}%`;
}

function animateNumber(element, finalValue) {
    const currentVal = parseInt(element.innerText) || 0;
    if (currentVal === finalValue) return;

    let startValue = currentVal;
    const duration = 1500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        
        const current = Math.floor(startValue + (finalValue - startValue) * ease);
        element.innerText = current;

        if (progress < 1) requestAnimationFrame(update);
        else element.innerText = finalValue;
    }
    requestAnimationFrame(update);
}

window.openModal = function(player) {
    const modal = document.getElementById('war-modal');
    if (!modal) return;

    const listContainer = document.getElementById('modal-list');
    
    const modalName = document.getElementById('modal-name');
    modalName.innerText = player.nombre;
    
    const modalAvatar = document.getElementById('modal-avatar');
    modalAvatar.src = player.avatar || '../icons/unown.png';
    modalAvatar.onerror = function() { this.src = '../icons/unown.png'; };

    const teamColor = player.team === 'A' ? '#2ed573' : '#ce5cff';
    modalName.style.color = teamColor;

    listContainer.innerHTML = '';

    if (!player.captures || player.captures.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#666; padding: 20px;">Sin capturas registradas.</p>';
    } else {
        const sortedCaptures = [...player.captures].reverse();

        sortedCaptures.forEach(cap => {
            const row = document.createElement('div');
            row.className = 'capture-row';
            row.style.borderLeftColor = teamColor;

            const pokeName = cap.pokemon || 'unknown';
            const pokeIcon = `https://play.pokemonshowdown.com/sprites/gen5ani-shiny/${pokeName.toLowerCase()}.gif`;

            let details = `${cap.method || 'Single'} | ${cap.date}`;
            if (cap.bonuses) {
                if (cap.bonuses.secret) details += ' | ✨ Secret';
                if (cap.bonuses.newDex) details += ' | 🆕 New';
                if (cap.bonuses.dateBonus) details += ' | 📅 Bonus Día';
            }

            row.innerHTML = `
                <img src="${pokeIcon}" class="cap-icon" onerror="this.src='../icons/unown.png'">
                <div class="cap-info">
                    <span class="cap-poke">${pokeName}</span>
                    <span class="cap-method">${details}</span>
                </div>
                <div class="cap-points" style="color: ${teamColor}; background: rgba(255,255,255,0.05);">+${cap.points}</div>
            `;
            listContainer.appendChild(row);
        });
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeModal = function() {
    const modal = document.getElementById('war-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

const modalElement = document.getElementById('war-modal');
if (modalElement) {
    modalElement.addEventListener('click', (e) => {
        if (e.target.id === 'war-modal') window.closeModal();
    });
}

document.getElementById('modal-close-btn')?.addEventListener('click', window.closeModal);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeModal();
});