// Leaders portal access settings.
//
// Change PORTAL_PASSWORD and redeploy to rotate. Anyone who already
// unlocked the portal in the previous 4 hours stays unlocked until
// their session expires; new visitors need the new password.
//
// SECURITY NOTE: this is a static-site password gate. The password is
// shipped to the browser and is visible in the JS bundle. It keeps
// casual visitors out of the portal page; it does NOT protect the
// resources behind the buttons (those are public Google Drive / Sheet
// URLs, accessible to anyone with the link).

export const PORTAL_PASSWORD = 'Leaders@2026';
export const PORTAL_TTL_HOURS = 4;
