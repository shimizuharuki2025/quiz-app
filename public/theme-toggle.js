/**
 * Theme Toggle Utility
 * Handles light/dark mode switching and persistence.
 */
(function () {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', initialTheme);

    window.toggleTheme = function () {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateToggleIcons(newTheme);
    };

    function updateToggleIcons(theme) {
        const icons = document.querySelectorAll('.theme-toggle-icon');
        icons.forEach(icon => {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        });
        const texts = document.querySelectorAll('.theme-toggle-text');
        texts.forEach(text => {
            text.textContent = theme === 'dark' ? 'ライトモード' : 'ダークモード';
        });
    }

    // Initialize icons once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        updateToggleIcons(document.documentElement.getAttribute('data-theme'));
    });
})();
