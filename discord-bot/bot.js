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
// 👇 NUEVO: Importamos la autenticación
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

// INICIALIZAR FIREBASE
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // 👈 Iniciamos Auth

// ==========================================
// 🔐 AUTO-LOGIN DEL BOT (NUEVO BLOQUE)
// ==========================================
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

// Ejecutamos el login nada más arrancar
loginBot();

// ==========================================
// LISTA DE ICONOS VÁLIDOS
// ==========================================
const VALID_ICONS = [
    'alpha', 'egg', 'fossil', 
    'safari', 'swarm', 'secret'
];

// INICIALIZAR DISCORD
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// 2. FUNCIONES DE AYUDA (DATABASE)
// ==========================================

// Función para leer datos de una ruta específica
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

// Función para guardar datos
async function saveData(path, data) {
    try {
        await set(ref(db, path), data);
        return true;
    } catch (error) {
        console.error("❌ Error guardando en Firebase:", error);
        return false;
    }
}

// ==========================================
// 3. EVENTOS DEL BOT
// ==========================================

client.once('ready', () => {
    console.log(`✅ Bot Aura (Firebase + Manual Mode) conectado como ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    // Separar argumentos respetando comillas si las hubiera
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
                        '`!shiny <Nombre> <Pokemon>` - Solo Dex (sin war).'
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

        // LEER usuarios actuales
        let users = await getData('users');
        if (!users) users = []; // Si está vacía, iniciamos array
        
        // Convertir objeto a array si Firebase devolvió objeto
        let usersArray = Array.isArray(users) ? users : Object.values(users);

        if (usersArray.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
            return message.reply(`⚠️ **${nombre}** ya está registrado.`);
        }

        // Añadir nuevo usuario
        usersArray.push({ 
            id: Date.now(), // ID único simple
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
            
            // 1. Validaciones Básicas
            if (!nombreEntrenador || !pokemon || !puntosArg) {
                return message.reply('❌ Uso: `!shinywar <Trainer> <Pokemon> <Puntos> [Icono] <Texto>`\nEj: `!shinywar Ash Eevee 15 egg Masuda`');
            }

            const puntos = parseInt(puntosArg);
            if (isNaN(puntos)) return message.reply('❌ Los puntos deben ser un número.');

            // =======================================================
            // 🛡️ VALIDACIÓN DE POKÉMON (PokeAPI)
            // =======================================================
            const pokemonApiName = pokemon.toLowerCase().replace(/ /g, '-').replace(/['.]/g, '');
            
            try {
                const checkPoke = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonApiName}`);
                if (!checkPoke.ok) {
                    return message.reply(`❌ El Pokémon **"${pokemon}"** no existe o está mal escrito.`);
                }
            } catch (e) {
                console.warn("⚠️ PokeAPI no responde, saltando validación.");
            }

            // 2. Detección Inteligente de Icono
            let detectedIcon = null;
            let startIndexTexto = 3; 
            const posibleIcono = args[3] ? args[3].toLowerCase() : '';

            // Asegúrate de que VALID_ICONS esté definido arriba en tu bot.js
            if (typeof VALID_ICONS !== 'undefined' && VALID_ICONS.includes(posibleIcono)) {
                detectedIcon = posibleIcono;
                startIndexTexto = 4; // Saltamos la palabra del icono
            }

            const textoMetodo = args.slice(startIndexTexto).join(' ');
            if (!textoMetodo) return message.reply('❌ Falta el texto del método.');

            // 3. CARGAR DATOS
            let users = await getData('users') || [];
            let wars = await getData('wars') || {};
            
            let usersArray = Array.isArray(users) ? users : Object.values(users);
            
            // Buscar guerra activa
            let warsList = [];
            if (wars.wars) {
                warsList = Array.isArray(wars.wars) ? wars.wars : Object.values(wars.wars);
            }

            const activeWarId = wars.activeWarId;
            const activeWarIndex = warsList.findIndex(w => w && w.id === activeWarId);
            
            if (activeWarIndex === -1) return message.reply('❌ No hay War activa configurada en la nube.');
            
            const activeWar = warsList[activeWarIndex];

            // 4. Buscar Jugador
            let realName = nombreEntrenador;
            let isGuest = false;
            
            let playerIndex = usersArray.findIndex(p => p.nombre && p.nombre.toLowerCase() === nombreEntrenador.toLowerCase());

            if (playerIndex !== -1) {
                realName = usersArray[playerIndex].nombre;
            } else {
                // Buscar en invitados
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

            // 5. Verificar Equipo
            let team = null;
            if (activeWar.teams?.A?.includes(realName)) team = 'A';
            else if (activeWar.teams?.B?.includes(realName)) team = 'B';

            if (!team) return message.reply(`⚠️ **${realName}** no tiene equipo asignado.`);

            // =======================================================
            // 📅 DEFINIR FECHA AQUÍ (Para que la usen AMBOS sitios)
            // =======================================================
            const today = new Date().toISOString().split('T')[0];

            // 6. GUARDAR EN DEX PERSONAL (Si no es invitado)
            if (!isGuest && playerIndex !== -1) {
                const dexShiny = { 
                    pokemon: pokemon.toLowerCase(),
                    date: today, // <--- ✅ AHORA SÍ SE GUARDA LA FECHA EN EL USUARIO
                    method: textoMetodo
                };
                
                if (detectedIcon) dexShiny.icono = detectedIcon;
                
                // Lógica especial de puntos 0
                if (puntos === 0) dexShiny.live = 'no'; 
                if (puntos === 0 && detectedIcon === 'safari') dexShiny.safari = 'flee';

                // Guardamos el equipo que tenía en ese momento
                dexShiny.team = team; 

                if (!usersArray[playerIndex].equipo) usersArray[playerIndex].equipo = [];
                usersArray[playerIndex].equipo.push(dexShiny);
                
                await saveData('users', usersArray);
            }

            // 7. GUARDAR EN WAR (Historial de Guerra)
            if (!activeWar.captures) activeWar.captures = [];

            activeWar.captures.push({
                trainer: realName,
                team: team,
                pokemon: pokemon.toLowerCase(),
                date: today, // <--- También se guarda aquí
                method: textoMetodo,
                points: puntos,
                iconKey: detectedIcon
            });

            wars.wars = warsList; 
            await saveData('wars', wars);

            // 8. FEEDBACK (Mensaje bonito)
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
        
        // Recogemos todos los argumentos extra (args[2], args[3]...)
        const argumentosExtra = args.slice(2).map(arg => arg.toLowerCase());

        if (!nombre || !pokemon) return message.reply('❌ Uso: `!shiny <Entrenador> <Pokemon> [tipo] [flee]`\nEj: `!shiny Ash Abra safari flee`');

        // 1. VALIDACIÓN DE POKÉMON
        const pokemonApiName = pokemon.toLowerCase().replace(/ /g, '-').replace(/['.]/g, '');
        try {
            const checkPoke = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonApiName}`);
            if (!checkPoke.ok) {
                return message.reply(`❌ El Pokémon **"${pokemon}"** no existe (o está mal escrito).`);
            }
        } catch (e) {
            console.warn("⚠️ PokeAPI no responde, saltando validación.");
        }

        // 2. BUSCAR USUARIO
        let users = await getData('users') || [];
        let usersArray = Array.isArray(users) ? users : Object.values(users);
        
        const index = usersArray.findIndex(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        if (index === -1) return message.reply('❌ Entrenador no encontrado. Usa `!registrar` primero.');

        // 3. DETECTAR TIPO Y ESTADO (FLEE) 🕵️‍♂️
        let iconoGuardar = null;
        let esFlee = false;
        let infoTexto = "";

        // Diccionario de Tipos
        const validTypes = {
            'safari': 'safari',
            'alpha': 'alpha', 'alfa': 'alpha',
            'secret': 'secret', 'secreto': 'secret',
            'fossil': 'fossil', 'fosil': 'fossil',
            'swarm': 'swarm', 'plaga': 'swarm',
            'egg': 'egg', 'huevo': 'egg'
        };

        // Diccionario de "Muerte/Huida"
        const fleeKeywords = ['flee', 'huido', 'escapo', 'escapado', 'muerto', 'fail', 'f'];

        // Analizamos los argumentos extra uno a uno
        argumentosExtra.forEach(arg => {
            if (validTypes[arg]) {
                iconoGuardar = validTypes[arg];
            } else if (fleeKeywords.includes(arg)) {
                esFlee = true;
            }
        });

        // 4. PREPARAR DATOS
        if (!usersArray[index].equipo) usersArray[index].equipo = [];
        
        const today = new Date().toISOString().split('T')[0]; 

        const nuevoShiny = { 
            pokemon: pokemon.toLowerCase(),
            date: today
        };

        // Añadimos las propiedades si existen
        if (iconoGuardar) {
            nuevoShiny.icono = iconoGuardar;
            infoTexto += ` (Tipo: ${iconoGuardar.toUpperCase()})`;
        }

        if (esFlee) {
            nuevoShiny.safari = "flee"; // 👈 ESTO HACE QUE SALGA TACHADO/GRIS EN LA WEB
            infoTexto += ` 💀 **(HUIDO)**`;
        }

        usersArray[index].equipo.push(nuevoShiny);
        
        // 5. GUARDAR Y RESPONDER
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
        
        // Inicializar arrays si no existen
        if (!activeWar.teams) activeWar.teams = { A: [], B: [] };
        if (!activeWar.teams.A) activeWar.teams.A = [];
        if (!activeWar.teams.B) activeWar.teams.B = [];

        // Limpiar equipo contrario
        const other = equipo === 'A' ? 'B' : 'A';
        const idx = activeWar.teams[other].indexOf(nombre);
        if (idx !== -1) activeWar.teams[other].splice(idx, 1);

        // Añadir al nuevo
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

        // Cargar datos
        let users = await getData('users') || [];
        let wars = await getData('wars') || {};
        
        let usersArray = Array.isArray(users) ? users : Object.values(users);
        let warsList = wars.wars ? (Array.isArray(wars.wars) ? wars.wars : Object.values(wars.wars)) : [];
        const activeIndex = warsList.findIndex(w => w.id === wars.activeWarId);

        if (activeIndex === -1) return message.reply('❌ No hay War activa.');
        const activeWar = warsList[activeIndex];

        // Inicializar arrays
        if (!activeWar.teams) activeWar.teams = { A: [], B: [] };
        if (!activeWar.teams.A) activeWar.teams.A = [];
        if (!activeWar.teams.B) activeWar.teams.B = [];

        const added = [];
        args.forEach(name => {
            const profile = usersArray.find(p => p.nombre.toLowerCase() === name.toLowerCase());
            if (profile) {
                const realName = profile.nombre;
                // Quitar del otro
                const idxOther = activeWar.teams[otherTeam].indexOf(realName);
                if (idxOther !== -1) activeWar.teams[otherTeam].splice(idxOther, 1);
                // Poner en el nuevo
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

// 1. Comprobamos si el TOKEN existe
if (!TOKEN) {
    console.error("🔴 ERROR FATAL: La variable 'DISCORD_TOKEN' está vacía o no existe en Render.");
} else {
    // 2. Intentamos conectar y capturamos cualquier error
    client.login(TOKEN)
        .then(() => {
            console.log("🔵 Login enviado... Esperando confirmación de Discord.");
        })
        .catch(error => {
            console.error("🔴 ERROR CRÍTICO AL CONECTAR:");
            console.error(error); // Esto imprimirá el error exacto en la consola
        });
}