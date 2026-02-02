const express = require('express');
const server = express(); 
const port = process.env.PORT || 3000;

server.get('/', (req, res) => { 
  res.send('🤖 El Bot Team Aura está ONLINE y vigilando.');
});

server.listen(port, () => { 
  console.log(`🔗 Servidor web escuchando en el puerto ${port}`);
});

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set } = require("firebase/database");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");


require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;
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

async function loginBot() {
    try {
        const email = process.env.FIREBASE_EMAIL;
        const password = process.env.FIREBASE_PASSWORD;

        if (!email || !password) {
            console.error("🔴 [Config Error] Faltan FIREBASE_EMAIL o FIREBASE_PASSWORD en el archivo .env");
            return;
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log("🟢 [Firebase] Bot autenticado correctamente. Permiso de escritura concedido.");
    } catch (error) {
        console.error("🔴 [Firebase] Error de autenticación:", error.message);
    }
}

loginBot();

// ==========================================
// LISTA DE ICONOS VÁLIDOS
// ==========================================
const VALID_ICONS = [
    'alpha', 'egg', 'fossil', 
    'safari', 'swarm', 'secret'
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

async function getData(path) {
    try {
        const snapshot = await get(ref(db, path));
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return null;
        }
    } catch (error) {
        console.error("❌ Error leyendo Firebase:", error);
        return null;
    }
}

async function saveData(path, data) {
    try {
        await set(ref(db, path), data);
        return true;
    } catch (error) {
        console.error("❌ Error guardando en Firebase:", error);
        return false;
    }
}

client.once('ready', () => {
    console.log(`✅ Bot Aura (Firebase + Manual Mode) conectado como ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).match(/(?:[^\s"]+|"[^"]*")+/g)?.map(arg => arg.replace(/^"|"$/g, '')) || [];
    if (args.length === 0) return;
    
    const command = args.shift().toLowerCase();

    // =========================================================
    // COMANDO AYUDA
    // =========================================================
    if (command === 'comandos' || command === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('☁️ AuraBot - Comandos Nube')
            .setDescription('Sistema conectado a Firebase con modo manual.')
            .addFields(
                { 
                    name: '⚔️ ShinyWar (Modo Manual)', 
                    value: [
                        '`!shinywar <Trainer> <Pokemon> <Puntos> [Icono] <Texto>`',
                        'Ej con icono: `!shinywar Ash Charmander 15 egg Masuda Method`',
                        'Ej sin icono: `!shinywar Ash Rattata 8 Random Encounter`',
                        '*El bot detecta si la 4ª palabra es un icono válido.*'
                    ].join('\n')
                },
                { 
                    name: '🗂️ Gestión', 
                    value: [
                        '`!registrar <Nombre> <Avatar>` - Crear perfil.',
                        '`!invitado <Nombre> <A/B>` - Añadir invitado a la guerra.',
                        '`!equipoa <Nombres>` / `!equipob <Nombres>` - Asignar bandos.',
                        '`!shiny <Nombre> <Pokemon> <Icono> <Flee o no>` - Solo Dex (sin war).'
                    ].join('\n')
                }
            )
            .setFooter({ text: 'v3.0 - Firebase Edition' });
        return message.channel.send({ embeds: [embed] });
    }

    // =========================================================
    // COMANDO 1: !registrar
    // =========================================================
    if (command === 'registrar') {
        const nombre = args[0];
        const avatar = args[1];

        if (!nombre || !avatar) return message.reply('❌ Uso: `!registrar <Nombre> <URL_Avatar>`');

        let users = await getData('users');
        if (!users) users = [];
        
        let usersArray = Array.isArray(users) ? users : Object.values(users);

        if (usersArray.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
            return message.reply(`⚠️ **${nombre}** ya está registrado.`);
        }

        usersArray.push({ 
            id: Date.now(),
            nombre: nombre, 
            avatar: avatar, 
            equipo: [] 
        });
        
        if (await saveData('users', usersArray)) {
            message.reply(`✅ **${nombre}** registrado correctamente en la nube.`);
        }
    }

    // =========================================================
    // COMANDO 2: !shinywar (MODO MANUAL + DETECCIÓN BLINDADA 🛡️)
    // =========================================================
    if (command === 'shinywar') {
        try {
            const nombreEntrenador = args[0];
            const pokemon = args[1];
            const puntosArg = args[2];
            
            if (!nombreEntrenador || !pokemon || !puntosArg) {
                return message.reply('❌ Uso: `!shinywar <Trainer> <Pokemon> <Puntos> [Icono] <Texto>`\nEj: `!shinywar Ash Eevee 15 egg Masuda`');
            }

            const puntos = parseInt(puntosArg);
            if (isNaN(puntos)) return message.reply('❌ Los puntos deben ser un número.');

            const pokemonApiName = pokemon.toLowerCase().replace(/ /g, '-').replace(/['.]/g, '');
            
            try {
                const checkPoke = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonApiName}`);
                if (!checkPoke.ok) {
                    return message.reply(`❌ El Pokémon **"${pokemon}"** no existe o está mal escrito.`);
                }
            } catch (e) {
                console.warn("⚠️ PokeAPI no responde, saltando validación.");
            }

            let detectedIcon = null;
            let startIndexTexto = 3; 
            const posibleIcono = args[3] ? args[3].toLowerCase() : '';

            if (typeof VALID_ICONS !== 'undefined' && VALID_ICONS.includes(posibleIcono)) {
                detectedIcon = posibleIcono;
                startIndexTexto = 4;
            }

            const textoMetodo = args.slice(startIndexTexto).join(' ');
            if (!textoMetodo) return message.reply('❌ Falta el texto del método.');

            let users = await getData('users') || [];
            let wars = await getData('wars') || {};
            
            let usersArray = Array.isArray(users) ? users : Object.values(users);
            
            let warsList = [];
            if (wars.wars) {
                warsList = Array.isArray(wars.wars) ? wars.wars : Object.values(wars.wars);
            }

            const activeWarId = wars.activeWarId;
            const activeWarIndex = warsList.findIndex(w => w && w.id === activeWarId);
            
            if (activeWarIndex === -1) return message.reply('❌ No hay War activa configurada en la nube.');
            
            const activeWar = warsList[activeWarIndex];

            let realName = nombreEntrenador;
            let isGuest = false;
            
            let playerIndex = usersArray.findIndex(p => p.nombre && p.nombre.toLowerCase() === nombreEntrenador.toLowerCase());

            if (playerIndex !== -1) {
                realName = usersArray[playerIndex].nombre;
            } else {
                const teamA = activeWar.teams?.A || [];
                const teamB = activeWar.teams?.B || [];
                const allPlayers = [...teamA, ...teamB];
                
                const foundName = allPlayers.find(n => n && n.toLowerCase() === nombreEntrenador.toLowerCase());
                
                if (foundName) {
                    realName = foundName;
                    isGuest = true;
                } else {
                    return message.reply(`❌ No encuentro al entrenador **${nombreEntrenador}**. Revisa el registro.`);
                }
            }

            let team = null;
            if (activeWar.teams?.A?.includes(realName)) team = 'A';
            else if (activeWar.teams?.B?.includes(realName)) team = 'B';

            if (!team) return message.reply(`⚠️ **${realName}** no tiene equipo asignado.`);

            const today = new Date().toISOString().split('T')[0];

            if (!isGuest && playerIndex !== -1) {
                const dexShiny = { 
                    pokemon: pokemon.toLowerCase(),
                    date: today,
                    method: textoMetodo
                };
                
                if (detectedIcon) dexShiny.icono = detectedIcon;
                
                if (puntos === 0) dexShiny.live = 'no'; 
                if (puntos === 0 && detectedIcon === 'safari') dexShiny.safari = 'flee';

                dexShiny.team = team; 

                if (!usersArray[playerIndex].equipo) usersArray[playerIndex].equipo = [];
                usersArray[playerIndex].equipo.push(dexShiny);
                
                await saveData('users', usersArray);
            }

            if (!activeWar.captures) activeWar.captures = [];

            activeWar.captures.push({
                trainer: realName,
                team: team,
                pokemon: pokemon.toLowerCase(),
                date: today,
                method: textoMetodo,
                points: puntos,
                iconKey: detectedIcon
            });

            wars.wars = warsList; 
            await saveData('wars', wars);

            const teamColor = team === 'A' ? '#2ed573' : '#9c27b0';
            const embed = new EmbedBuilder()
                .setColor(teamColor)
                .setTitle(`✨ ¡+${puntos} Puntos para el Equipo ${team === 'A' ? 'Archeops' : 'Aerodactyl'}!`)
                .setDescription(`**${realName}** ha registrado un **${pokemon}**.\n📝 **Método:** ${textoMetodo}`)
                .addFields(
                    { name: 'Puntos', value: `${puntos}`, inline: true },
                    { name: 'Icono', value: detectedIcon ? `✅ ${detectedIcon}` : 'Ninguno', inline: true },
                    { name: 'Fecha', value: today, inline: true }
                )
                .setThumbnail(`https://play.pokemonshowdown.com/sprites/gen5ani-shiny/${pokemon.toLowerCase()}.gif`);

            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error("🔥 Error crítico en shinywar:", error);
            message.reply("❌ Ocurrió un error inesperado.");
        }
    }

    // =========================================================
    // COMANDO 3: !shiny (Dex + Fecha + TIPO + ESTADO FLEE 🏃💨)
    // =========================================================
    if (command === 'shiny') {
        const nombre = args[0];
        const pokemon = args[1];
        
        const argumentosExtra = args.slice(2).map(arg => arg.toLowerCase());

        if (!nombre || !pokemon) return message.reply('❌ Uso: `!shiny <Entrenador> <Pokemon> [tipo] [flee]`\nEj: `!shiny Ash Abra safari flee`');

        const pokemonApiName = pokemon.toLowerCase().replace(/ /g, '-').replace(/['.]/g, '');
        try {
            const checkPoke = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonApiName}`);
            if (!checkPoke.ok) {
                return message.reply(`❌ El Pokémon **"${pokemon}"** no existe (o está mal escrito).`);
            }
        } catch (e) {
            console.warn("⚠️ PokeAPI no responde, saltando validación.");
        }

        let users = await getData('users') || [];
        let usersArray = Array.isArray(users) ? users : Object.values(users);
        
        const index = usersArray.findIndex(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        if (index === -1) return message.reply('❌ Entrenador no encontrado. Usa `!registrar` primero.');

        let iconoGuardar = null;
        let esFlee = false;
        let infoTexto = "";

        const validTypes = {
            'safari': 'safari',
            'alpha': 'alpha', 'alfa': 'alpha',
            'secret': 'secret', 'secreto': 'secret',
            'fossil': 'fossil', 'fosil': 'fossil',
            'swarm': 'swarm', 'plaga': 'swarm',
            'egg': 'egg', 'huevo': 'egg'
        };

        const fleeKeywords = ['flee', 'huido', 'escapo', 'escapado', 'muerto', 'fail', 'f'];

        argumentosExtra.forEach(arg => {
            if (validTypes[arg]) {
                iconoGuardar = validTypes[arg];
            } else if (fleeKeywords.includes(arg)) {
                esFlee = true;
            }
        });

        if (!usersArray[index].equipo) usersArray[index].equipo = [];
        
        const today = new Date().toISOString().split('T')[0]; 

        const nuevoShiny = { 
            pokemon: pokemon.toLowerCase(),
            date: today
        };

        if (iconoGuardar) {
            nuevoShiny.icono = iconoGuardar;
            infoTexto += ` (Tipo: ${iconoGuardar.toUpperCase()})`;
        }

        if (esFlee) {
            nuevoShiny.safari = "flee";
            infoTexto += ` 💀 **(HUIDO)**`;
        }

        usersArray[index].equipo.push(nuevoShiny);
        
        await saveData('users', usersArray);
        message.reply(`✨ **${pokemon}** registrado para **${usersArray[index].nombre}**${infoTexto}. 📅 ${today}`);
    }

    // =========================================================
    // COMANDO 4: !invitado
    // =========================================================
    if (command === 'invitado') {
        const nombre = args[0];
        const equipo = args[1]?.toUpperCase();
        if (!nombre || (equipo !== 'A' && equipo !== 'B')) return message.reply('❌ Uso: `!invitado <Nombre> <A/B>`');

        let wars = await getData('wars') || {};
        let warsList = wars.wars ? (Array.isArray(wars.wars) ? wars.wars : Object.values(wars.wars)) : [];
        const activeIndex = warsList.findIndex(w => w.id === wars.activeWarId);

        if (activeIndex === -1) return message.reply('❌ No hay War activa.');

        const activeWar = warsList[activeIndex];
        
        if (!activeWar.teams) activeWar.teams = { A: [], B: [] };
        if (!activeWar.teams.A) activeWar.teams.A = [];
        if (!activeWar.teams.B) activeWar.teams.B = [];

        const other = equipo === 'A' ? 'B' : 'A';
        const idx = activeWar.teams[other].indexOf(nombre);
        if (idx !== -1) activeWar.teams[other].splice(idx, 1);

        if (!activeWar.teams[equipo].includes(nombre)) activeWar.teams[equipo].push(nombre);
        
        wars.wars = warsList;
        await saveData('wars', wars);
        
        message.reply(`👋 **${nombre}** añadido como invitado al Equipo ${equipo}.`);
    }

    // =========================================================
    // COMANDO 5: !equipoa / !equipob
    // =========================================================
    if (command === 'equipoa' || command === 'equipob') {
        const targetTeam = command === 'equipoa' ? 'A' : 'B';
        const otherTeam = targetTeam === 'A' ? 'B' : 'A';
        
        if (args.length === 0) return message.reply(`❌ Uso: \`!${command} <Nombres...>\``);

        let users = await getData('users') || [];
        let wars = await getData('wars') || {};
        
        let usersArray = Array.isArray(users) ? users : Object.values(users);
        let warsList = wars.wars ? (Array.isArray(wars.wars) ? wars.wars : Object.values(wars.wars)) : [];
        const activeIndex = warsList.findIndex(w => w.id === wars.activeWarId);

        if (activeIndex === -1) return message.reply('❌ No hay War activa.');
        const activeWar = warsList[activeIndex];

        if (!activeWar.teams) activeWar.teams = { A: [], B: [] };
        if (!activeWar.teams.A) activeWar.teams.A = [];
        if (!activeWar.teams.B) activeWar.teams.B = [];

        const added = [];
        args.forEach(name => {
            const profile = usersArray.find(p => p.nombre.toLowerCase() === name.toLowerCase());
            if (profile) {
                const realName = profile.nombre;
                const idxOther = activeWar.teams[otherTeam].indexOf(realName);
                if (idxOther !== -1) activeWar.teams[otherTeam].splice(idxOther, 1);
                if (!activeWar.teams[targetTeam].includes(realName)) {
                    activeWar.teams[targetTeam].push(realName);
                    added.push(realName);
                }
            }
        });

        if (added.length > 0) {
            wars.wars = warsList;
            await saveData('wars', wars);
            message.reply(`✅ Movidos al Equipo ${targetTeam}: ${added.join(', ')}`);
        } else {
            message.reply('❌ No se encontraron esos entrenadores en la base de datos.');
        }
    }
});

console.log("⏳ Intentando conectar con Discord...");

fetch('https://discord.com/api/v10/gateway')
  .then(res => {
     console.log(`📡 TEST DE CONEXIÓN A DISCORD: Estado ${res.status} (${res.statusText})`);
     if (res.status === 429) console.error("⛔ ¡CONFIRMADO! Error 429: Too Many Requests (IP Bloqueada).");
  })
  .catch(err => console.error("❌ No se puede ni llegar a la web de Discord:", err.message));

if (!TOKEN) {
    console.error("🔴 ERROR FATAL: La variable 'DISCORD_TOKEN' está vacía o no existe en Render.");
} else {
    client.login(TOKEN)
        .then(() => {
            console.log("🔵 Login enviado... Esperando confirmación de Discord.");
        })
        .catch(error => {
            console.error("🔴 ERROR CRÍTICO AL CONECTAR:");
            console.error(error);
        });
}