/** The phone page for a household code, as shown in the QR. */
export const phoneUrl = (siteUrl: string, code: string) => `${siteUrl.replace(/\/$/, '')}/phone.html?code=${encodeURIComponent(code)}`;
