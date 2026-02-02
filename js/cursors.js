document.addEventListener("DOMContentLoaded", () => {
    const TOTAL_CURSORS = 701; 
    const randomNumber = Math.floor(Math.random() * TOTAL_CURSORS) + 1;
    const selectedCursor = `../cursor/${randomNumber}.png`;
    document.documentElement.style.setProperty('--cursor-random', `url('${selectedCursor}')`);
    console.log(`🎰 Cursor cargado: ${randomNumber}.png`);
});