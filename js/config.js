/* Google OAuth client ID (public, not a secret). Empty = app runs local-only, no sync. */
window.HIFZ_CONFIG = { appVersion: 'v143 · 14 Nov 2026', googleClientId: '821072899008-ca195enamr9si60pr3s3ruu6q4qa98u1.apps.googleusercontent.com' };

/* v143: Page quality, kept per phone in localStorage hifz.look.pq — 'hd' = sharper 2× pages (pages/, default since v141),
   'std' = the original PDF-size pages (pages1x/), so the two can be compared. */
window.pgQ = function () { try { return (JSON.parse(localStorage.getItem('hifz.look')) || {}).pq === 'std' ? 'std' : 'hd'; } catch (e) { return 'hd'; } };
window.pgSrc = function (p) { return (pgQ() === 'std' ? 'pages1x/p' : 'pages/p') + String(p).padStart(3, '0') + '.jpg'; };
