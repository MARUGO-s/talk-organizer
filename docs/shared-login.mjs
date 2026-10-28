export const SHARED_ACCOUNT_EMAIL = 'talk-organizer-marugo@example.com';

export function isSharedLoginId(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'marugo';
}
