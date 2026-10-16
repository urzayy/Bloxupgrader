import { useAuth } from '../../context/AuthContext';
import { useAppRoute } from '../../hooks/useAppRoute';
import {
  ADMIN_NAV_ITEM,
  NAV_ITEMS,
  isNavItemActive,
  navigateNavItem,
  type NavItem,
} from '../../lib/navItems';
import { AdminChatsNavButton } from './AdminChatsNavButton';

interface Props {
  compact?: boolean;
  adminInboxOpen?: boolean;
  adminChatAttentionCount?: number;
  onOpenAdminInbox?: () => void;
}

export function HeaderNavMenu({
  compact = false,
  adminInboxOpen = false,
  adminChatAttentionCount = 0,
  onOpenAdminInbox,
}: Props) {
  const route = useAppRoute();
  const { isAdmin } = useAuth();
  const items = isAdmin
    ? [...NAV_ITEMS.filter(item => item.id !== 'profile'), ADMIN_NAV_ITEM]
    : NAV_ITEMS.filter(item => item.id !== 'profile');

  const handleClick = (item: NavItem) => {
    navigateNavItem(item);
  };

  return (
    <nav
      aria-label="Main navigation"
      className={`flex min-w-0 max-w-full items-center ${
        compact
          ? 'gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] xl:gap-1 2xl:gap-2 [&::-webkit-scrollbar]:hidden'
      }`}
    >
      {items.map(item => {
        const active = isNavItemActive(item, route);
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.available}
            title={item.available ? item.label : `${item.label} — coming soon`}
            onClick={() => handleClick(item)}
            className={`group relative flex shrink-0 items-center rounded-lg px-2 py-2 transition 2xl:gap-2 2xl:px-3 ${
              item.available ? 'cursor-pointer' : 'cursor-default opacity-50'
            } ${active ? '' : 'hover:bg-white/[0.03]'}`}
          >
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7">
              {item.icon}
            </span>
            <span
              className={`relative z-10 whitespace-nowrap font-display font-bold uppercase tracking-wide transition ${
                compact ? 'text-[10px]' : 'hidden text-[11px] 2xl:inline 2xl:text-xs'
              } ${
                active
                  ? 'text-white'
                  : 'text-white/40 group-hover:text-white/65'
              }`}
            >
              {item.label}
            </span>
            {active && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 -bottom-0.5 h-[2px] rounded-full bg-[#c084fc] shadow-[0_0_8px_2px_rgba(192,132,252,0.85),0_0_18px_4px_rgba(168,85,247,0.55)]"
              />
            )}
          </button>
        );
      })}
      {isAdmin && onOpenAdminInbox && (
        <AdminChatsNavButton
          compact={compact}
          active={adminInboxOpen}
          attentionCount={adminChatAttentionCount}
          onOpen={onOpenAdminInbox}
        />
      )}
    </nav>
  );
}
