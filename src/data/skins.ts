import { GENERATED_SKIN_CATALOG } from './skinCatalog.generated';

export type RarityKey =
  | 'consumer'
  | 'industrial'
  | 'milspec'
  | 'restricted'
  | 'classified'
  | 'covert'
  | 'extraordinary';

export interface FairRollProofRef {
  clientSeed: string;
  serverSeed: string;
  secretSalt: string;
  nonce: number;
  serverSeedHash: string;
  roll: number;
  rollFloat: number;
  hash: string;
  gameType: string;
  gameMeta?: Record<string, unknown>;
  createdAt: number;
}

export interface Skin {
  id: string;
  name: string;
  weapon: string;
  rarity: RarityKey;
  wear: string;
  price: number;
  image: string;
  obtainedAt?: number;
  fairProof?: FairRollProofRef;
}

export interface FeedItem {
  id: string;
  username: string;
  inputSkin: string;
  targetSkin: string;
  inputImage?: string;
  targetImage?: string;
  probability: number;
  won: boolean;
  timestamp: number;
}

export const RARITY: Record<RarityKey, { label: string; color: string; glow: string }> = {
  consumer: { label: 'Consumer', color: '#b0c3d9', glow: 'rgba(176,195,217,0.35)' },
  industrial: { label: 'Industrial', color: '#5e98d9', glow: 'rgba(94,152,217,0.35)' },
  milspec: { label: 'Mil-Spec', color: '#4b69ff', glow: 'rgba(75,105,255,0.4)' },
  restricted: { label: 'Restricted', color: '#8847ff', glow: 'rgba(136,71,255,0.45)' },
  classified: { label: 'Classified', color: '#d32ce6', glow: 'rgba(211,44,230,0.45)' },
  covert: { label: 'Covert', color: '#eb4b4b', glow: 'rgba(235,75,75,0.5)' },
  extraordinary: { label: 'Extraordinary', color: '#ffd700', glow: 'rgba(255,215,0,0.55)' },
};

export function sortSkinsByPriceDesc(skins: Skin[]): Skin[] {
  return [...skins].sort((a, b) => {
    const byPrice = Number(b.price) - Number(a.price);
    if (byPrice !== 0) return byPrice;
    return a.name.localeCompare(b.name, 'es');
  });
}

/** Bloxstrike catalog — generated from BloxDB via scripts/import-bloxdb-skins.mjs */
const SKIN_CATALOG: Skin[] = GENERATED_SKIN_CATALOG as unknown as Skin[];

export const STARTER_INVENTORY: Skin[] = [];
export const TARGET_POOL: Skin[] = SKIN_CATALOG;
export const INVENTORY: Skin[] = [];
export const ALL_SKINS_CATALOG: Skin[] = SKIN_CATALOG;

const skinImageByName = new Map(SKIN_CATALOG.map(s => [s.name, s.image]));
const skinByName = new Map(SKIN_CATALOG.map(s => [s.name, s]));
const skinById = new Map(SKIN_CATALOG.map(s => [s.id, s]));

export function findSkinById(id: string): Skin | undefined {
  return skinById.get(id);
}

/** Resolve catalog skin from a display name (feed rows, legacy aliases). */
export function findSkinByName(name: string): Skin | undefined {
  const exact = skinByName.get(name);
  if (exact) return exact;

  const lower = name.toLowerCase();
  const caseInsensitive = SKIN_CATALOG.find(s => s.name.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive;

  const skinPart = lower.split('|').pop()?.trim();
  if (skinPart) {
    return SKIN_CATALOG.find(s => s.name.toLowerCase().includes(skinPart));
  }

  return undefined;
}

/** Resolve catalog image URL from a skin display name (legacy feed rows). */
export function findSkinImageByName(name: string): string | undefined {
  const exact = skinImageByName.get(name);
  if (exact) return exact;

  const lower = name.toLowerCase();
  const caseInsensitive = SKIN_CATALOG.find(s => s.name.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive.image;

  const skinPart = lower.split('|').pop()?.trim();
  if (skinPart) {
    const bySkinPart = SKIN_CATALOG.find(s => s.name.toLowerCase().includes(skinPart));
    if (bySkinPart) return bySkinPart.image;
  }

  return undefined;
}

export const FEED_USERS = [
  'NeonPulse', 'xKiller99', 'VortexAce', 'CyberWolf', 'BladeRunner',
  'GhostOps', 'TitanSlayer', 'NovaStrike', 'IronFist', 'DarkMatter',
];

export const USER = {
  username: 'ShadowViper',
  balance: 2847.5,
  inventoryValue: 12450,
};
