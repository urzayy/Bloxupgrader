import { CASE_CATALOG } from './caseCatalog';
import { getFreeCaseBySlug, slugForTier, FREE_CASE_TIERS } from './freeCaseTiers';
import {
  battleIdFromPathname,
  caseSlugFromPathname,
  freeCaseSlugFromPathname,
  giveawayPeriodFromPathname,
  isCreateCaseBattlePath,
  routeFromPathname,
  type AppRoute,
} from './appRoute';

const SITE_ORIGIN = 'https://bloxupgrader.com';
const SITE_NAME = 'BloxUpgrader.com';

export interface DocumentSeo {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
}

function absoluteUrl(path: string): string {
  if (path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path}`;
}

function titleFor(page: string): string {
  return `${page} | ${SITE_NAME}`;
}

const STATIC_SEO: Record<AppRoute, DocumentSeo | null> = {
  main: {
    title: `${SITE_NAME} — CS2 Skin Upgrade`,
    description:
      'BloxUpgrader.com — The premium CS2 skin upgrade platform. Open cases, upgrade skins, shop, deposit, and withdraw with live admin support.',
    canonicalPath: '/',
    robots: 'index, follow',
  },
  upgrade: {
    title: titleFor('CS2 Skin Upgrade'),
    description:
      'Upgrade your CS2 skins on BloxUpgrader. Choose your input, pick a target, and roll with provably fair odds.',
    canonicalPath: '/upgrade',
    robots: 'index, follow',
  },
  'free-cases': {
    title: titleFor('Free Daily Cases'),
    description:
      'Open free daily CS2 cases on BloxUpgrader. Level up to unlock Bronze through Challenger free cases.',
    canonicalPath: '/free-cases',
    robots: 'index, follow',
  },
  giveaways: {
    title: titleFor('Giveaways'),
    description:
      'Join daily, weekly, and monthly CS2 skin giveaways on BloxUpgrader. Free entries for active players.',
    canonicalPath: '/giveaways',
    robots: 'index, follow',
  },
  'case-battles': {
    title: titleFor('Case Battles'),
    description:
      'Create or join CS2 case battles on BloxUpgrader. Compete live and win the highest unboxed value.',
    canonicalPath: '/case-battles',
    robots: 'index, follow',
  },
  'terms-of-service': {
    title: titleFor('Terms of Service'),
    description: 'Read the Terms of Service for BloxUpgrader.com — rules, eligibility, and platform use.',
    canonicalPath: '/terms-of-service',
    robots: 'index, follow',
  },
  'privacy-policy': {
    title: titleFor('Privacy Policy'),
    description: 'How BloxUpgrader.com collects, uses, and protects your personal data.',
    canonicalPath: '/privacy-policy',
    robots: 'index, follow',
  },
  'cookie-policy': {
    title: titleFor('Cookie Policy'),
    description: 'Learn how BloxUpgrader.com uses cookies and similar technologies.',
    canonicalPath: '/cookie-policy',
    robots: 'index, follow',
  },
  'provably-fair': {
    title: titleFor('Provably Fair'),
    description:
      'Verify BloxUpgrader rolls with client and server seeds. Provably fair CS2 upgrade and case openings.',
    canonicalPath: '/provably-fair',
    robots: 'index, follow',
  },
  profile: {
    title: titleFor('Profile'),
    description: 'Your BloxUpgrader account, inventory, and stats.',
    canonicalPath: '/profile',
    robots: 'noindex, nofollow',
  },
  admin: {
    title: titleFor('Admin'),
    description: 'BloxUpgrader admin panel.',
    canonicalPath: '/admin',
    robots: 'noindex, nofollow',
  },
};

const GIVEAWAY_SEO: Record<string, DocumentSeo> = {
  daily: {
    title: titleFor('Daily Giveaway'),
    description: 'Enter the daily CS2 skin giveaway on BloxUpgrader and compete for free prizes.',
    canonicalPath: '/giveaways/daily',
    robots: 'index, follow',
  },
  weekly: {
    title: titleFor('Weekly Giveaway'),
    description: 'Enter the weekly CS2 skin giveaway on BloxUpgrader and compete for free prizes.',
    canonicalPath: '/giveaways/weekly',
    robots: 'index, follow',
  },
  monthly: {
    title: titleFor('Monthly Giveaway'),
    description: 'Enter the monthly CS2 skin giveaway on BloxUpgrader and compete for free prizes.',
    canonicalPath: '/giveaways/monthly',
    robots: 'index, follow',
  },
};

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveDocumentSeo(pathname = typeof window !== 'undefined' ? window.location.pathname : '/'): DocumentSeo {
  const route = routeFromPathname(pathname);
  const caseSlug = caseSlugFromPathname(pathname);
  const freeSlug = freeCaseSlugFromPathname(pathname);
  const giveawayPeriod = giveawayPeriodFromPathname(pathname);
  const battleId = battleIdFromPathname(pathname);
  const isCreate = isCreateCaseBattlePath(pathname);

  if (caseSlug) {
    const catalog = CASE_CATALOG.find(item => item.slug === caseSlug);
    const name = catalog?.name ?? humanizeSlug(caseSlug);
    const price = catalog ? ` from ${catalog.price} coins` : '';
    return {
      title: titleFor(`${name} Case`),
      description: `Open the ${name} CS2 case on BloxUpgrader${price}. Browse loot, odds, and unbox skins.`,
      canonicalPath: `/cases/${caseSlug}`,
      robots: 'index, follow',
    };
  }

  if (freeSlug) {
    const tier = getFreeCaseBySlug(freeSlug);
    const name = tier?.name ?? humanizeSlug(freeSlug.replace(/case$/i, ''));
    const known = FREE_CASE_TIERS.some(t => slugForTier(t) === freeSlug);
    return {
      title: titleFor(`${name} Free Case`),
      description: `Open the free ${name} daily case on BloxUpgrader. Level up to unlock more free CS2 cases.`,
      canonicalPath: `/free-cases/${freeSlug}`,
      robots: known ? 'index, follow' : 'noindex, follow',
    };
  }

  if (giveawayPeriod && GIVEAWAY_SEO[giveawayPeriod]) {
    return GIVEAWAY_SEO[giveawayPeriod];
  }

  if (isCreate) {
    return {
      title: titleFor('Create Case Battle'),
      description: 'Create a CS2 case battle on BloxUpgrader. Pick cases, mode, and challenge other players.',
      canonicalPath: '/case-battles/create',
      robots: 'index, follow',
    };
  }

  if (battleId) {
    return {
      title: titleFor('Case Battle'),
      description: 'Live CS2 case battle on BloxUpgrader.',
      canonicalPath: `/case-battles/${battleId}`,
      robots: 'noindex, nofollow',
    };
  }

  if (route === 'giveaways' && giveawayPeriod && !GIVEAWAY_SEO[giveawayPeriod]) {
    return {
      title: titleFor('Giveaways'),
      description: STATIC_SEO.giveaways!.description,
      canonicalPath: '/giveaways',
      robots: 'noindex, follow',
    };
  }

  return STATIC_SEO[route] ?? STATIC_SEO.main!;
}

function ensureMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function ensureCanonical(href: string): void {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Apply title, description, canonical, and robots for the current SPA route. */
export function applyDocumentSeo(pathname?: string): DocumentSeo {
  const seo = resolveDocumentSeo(pathname);
  const url = absoluteUrl(seo.canonicalPath);

  document.title = seo.title;
  ensureMeta('name', 'description', seo.description);
  ensureMeta('name', 'robots', seo.robots);
  ensureCanonical(url);
  ensureMeta('property', 'og:url', url);
  ensureMeta('property', 'og:title', seo.title);
  ensureMeta('property', 'og:description', seo.description);
  ensureMeta('name', 'twitter:title', seo.title);

  return seo;
}
