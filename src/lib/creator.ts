/** Site creator — only this account can gift balance/skins/levels and publish notices. */
export const CREATOR_EMAIL = 'urzay1v1@gmail.com';

export function isSiteCreatorEmail(email: string | null | undefined): boolean {
  return String(email || '').trim().toLowerCase() === CREATOR_EMAIL;
}
