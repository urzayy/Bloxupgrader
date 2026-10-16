import type { NavItemId } from '../lib/navItems';
import type { MessageKey } from './messages';

export const NAV_LABEL_KEYS: Record<NavItemId, MessageKey> = {
  cases: 'nav.cases',
  upgrades: 'nav.upgrade',
  'case-battle': 'nav.caseBattles',
  giveaways: 'nav.giveaways',
  'free-cases': 'nav.dailyCases',
  profile: 'nav.profile',
  admin: 'nav.admin',
};
