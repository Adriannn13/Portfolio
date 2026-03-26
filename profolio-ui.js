// Initialize Icons
lucide.createIcons();

const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;
const darkIcon = document.getElementById('dark-icon');
const lightIcon = document.getElementById('light-icon');

// Check for saved user preference
if (localStorage.getItem('theme') === 'dark') {
    htmlElement.classList.add('dark');
    updateIcons(true);
}

themeToggle.addEventListener('click', () => {
    const isDark = htmlElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateIcons(isDark);
});

function updateIcons(isDark) {
    if (isDark) {
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
    } else {
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
    }
}