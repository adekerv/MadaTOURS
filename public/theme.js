/* global localStorage, matchMedia, document */
// Runs before paint in the web and bundled native shells. No network dependencies.
(() => {
  let preference = 'system';
  try {
    preference = localStorage.getItem('madatours:theme:v1') || 'system';
  } catch {
    /* Optional storage. */
  }
  const dark =
    preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
