/**
 * page-transitions.js
 * Animaciones de deslizamiento al navegar entre páginas.
 * El orden del nav determina la dirección: izquierda ← index | showcase | shinywar | shinydex | tracker → derecha
 *
 * El inline script en cada <head> añade `html.pt-transitioning` antes del primer pintado
 * para evitar el FOUC (flash de contenido). Este script lo quita y arranca la animación.
 */

const NAV_ORDER = ['index.html', 'showcase.html', 'shinywar.html', 'shinydex.html', 'tracker.html'];

function getCurrentFile() {
    const path = window.location.pathname;
    const file = path.split('/').pop();
    return file || 'index.html';
}

function getIndex(href) {
    const file = (href || '').split('/').pop() || 'index.html';
    const idx = NAV_ORDER.indexOf(file);
    return idx === -1 ? 0 : idx;
}

// Selecciona los elementos de contenido a animar (main + header del logo si existe)
function getContentElements() {
    return [...document.querySelectorAll('main, header.main-header')];
}

function applyStyle(elements, styles) {
    elements.forEach(el => Object.assign(el.style, styles));
}

// Al cargar la página: animar la entrada
document.addEventListener('DOMContentLoaded', () => {
    const elements = getContentElements();
    if (!elements.length) return;

    const dir = sessionStorage.getItem('navDirection');
    sessionStorage.removeItem('navDirection');

    if (!dir) {
        // Sin transición pendiente: quitar la clase por si acaso y mostrar contenido normal
        document.documentElement.classList.remove('pt-transitioning');
        return;
    }

    // Aplicar posición inicial fuera de pantalla (la clase CSS ya los oculta con opacity:0)
    const translateX = dir === 'right' ? '50px' : '-50px';
    applyStyle(elements, { transform: `translateX(${translateX})` });

    // Quitar la clase ocultadora y animar a posición normal
    requestAnimationFrame(() => {
        document.documentElement.classList.remove('pt-transitioning');
        requestAnimationFrame(() => {
            applyStyle(elements, {
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: '1',
                transform: 'translateX(0)'
            });

            // Limpiar estilos inline al terminar
            elements[0].addEventListener('transitionend', () => {
                applyStyle(elements, { transition: '', opacity: '', transform: '' });
            }, { once: true });
        });
    });
});

// Al hacer clic en un nav-item: animar la salida y navegar
document.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-item');
    if (!link || link.classList.contains('active')) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    e.preventDefault();

    // Actualizar la clase active inmediatamente para que CSS anime la transición en el propio botón
    document.querySelectorAll('.main-nav .nav-item.active').forEach(item => {
        item.classList.remove('active');
    });
    link.classList.add('active');

    const currentIdx = getIndex(getCurrentFile());
    const targetIdx = getIndex(href);

    // Si vamos a la derecha en el nav, el contenido sale a la izquierda (y entra desde la derecha)
    const exitDir = targetIdx >= currentIdx ? 'left' : 'right';
    const enterDir = exitDir === 'left' ? 'right' : 'left';

    sessionStorage.setItem('navDirection', enterDir);

    const elements = getContentElements();
    if (!elements.length) { window.location.href = href; return; }

    applyStyle(elements, {
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        opacity: '0',
        transform: exitDir === 'left' ? 'translateX(-50px)' : 'translateX(50px)'
    });

    setTimeout(() => {
        window.location.href = href;
    }, 260);
});
