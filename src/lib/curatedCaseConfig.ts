import type { FreeCaseLootTable } from './freeCaseLoot';
import { FIFTY_FIFTY_Z_SLUG_SET } from './caseCatalogFilters';

export type CuratedCaseTier = 'budget' | 'mid' | 'premium' | 'elite' | 'knife' | 'glove';

export interface CuratedCaseOverride {
  name?: string;
  tier?: CuratedCaseTier;
  price: number;
  loot: FreeCaseLootTable;
}

/** +20% on all cases except the 50/50 row. */
const CASE_PRICE_MARKUP = 1.2;

function withCasePriceMarkup(slug: string, price: number): number {
  if (FIFTY_FIFTY_Z_SLUG_SET.has(slug)) return price;
  return Math.round(price * CASE_PRICE_MARKUP * 100) / 100;
}

/** Hand-configured case prices and loot — survives catalog regeneration. */
export const CURATED_CASE_SLUGS = [
  'apex-cache',
  'arctic-ops',
  'blade-roulette',
  'chrome-factory',
  'classified-hub',
  'covert-reactor',
  'cutlass-box',
  'driver-lane',
  'edge-protocol',
  'ember-core',
  'gold-reserve',
  'hand-wraps-box',
  'inferno-rush',
  'kings-gambit',
  'midnight-run',
  'mystery-hex',
  'neon-district',
  'night-market',
  'operator-wrap',
  'overdrive',
  'phantom-grid',
  'riot-zone',
  'ruby-raid',
  'sapphire-code',
  'sharpened',
  'shadow-vault',
  'sport-palm',
  'striker-knife',
  'street-cache',
  'toxic-alley',
  'violet-storm',
] as const;

export const CURATED_CASE_OVERRIDES: Record<string, CuratedCaseOverride> = {
  'apex-cache': {
    name: 'Gut Party',
    price: 200,
    loot: {
      featuredSkinId: 'skin_129_gut_whiteout',
      entries: [
        { skinId: 'skin_129_gut_whiteout', chance: 1 },
        { skinId: 'skin_229_p250_glacial', chance: 1 },
        { skinId: 'skin_159_awp_tekko', chance: 3 },
        { skinId: 'skin_141_package_mp_9_anodized_red', chance: 5 },
        { skinId: 'skin_179_m4a1_s_orchids', chance: 50 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'arctic-ops': {
    price: 220,
    loot: {
      featuredSkinId: 'skin_145_m4a1_s_anodized_red',
      entries: [
        { skinId: 'skin_129_gut_whiteout', chance: 0.3 },
        { skinId: 'skin_137_gut_safari', chance: 0.3 },
        { skinId: 'skin_145_m4a1_s_anodized_red', chance: 0.4 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 2 },
        { skinId: 'skin_163_ak_47_midas', chance: 2 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 5 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 7 },
        { skinId: 'skin_141_package_mp_9_anodized_red', chance: 5 },
        { skinId: 'skin_bloxdb_306_m4a4_freedom', chance: 8 },
        { skinId: 'skin_193_awp_railgun', chance: 10 },
        { skinId: 'skin_193_awp_railgun', chance: 9 },
        { skinId: 'skin_205_glock_18_fade', chance: 11 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 10 },
        { skinId: 'skin_188_galil_ar_irid', chance: 8 },
        { skinId: 'skin_244_famas_arctic_camo', chance: 7 },
        { skinId: 'skin_210_dual_berettas_choking_hazard', chance: 5 },
        { skinId: 'skin_191_tec_9_medal_tv', chance: 10 },
      ],
    },
  },
  'blade-roulette': {
    name: 'Sakura',
    tier: 'mid',
    price: 310,
    loot: {
      featuredSkinId: 'skin_bloxdb_307_ak_47_lore',
      entries: [
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 50 },
        { skinId: 'skin_236_aug_predator', chance: 50 },
      ],
    },
  },
  'chrome-factory': {
    name: 'High Octane',
    tier: 'knife',
    price: 30,
    loot: {
      featuredSkinId: 'skin_142_gut_woodland',
      entries: [
        { skinId: 'skin_142_gut_woodland', chance: 0.01 },
        { skinId: 'skin_168_package_glock_18_midas', chance: 5 },
        { skinId: 'skin_220_sg_553_frostline', chance: 4.99 },
        { skinId: 'skin_219_sg_553_dynasty', chance: 20 },
        { skinId: 'skin_236_aug_predator', chance: 70 },
      ],
    },
  },
  'classified-hub': {
    price: 1699,
    loot: {
      featuredSkinId: 'skin_009_karambit_fade',
      entries: [
        { skinId: 'skin_009_karambit_fade', chance: 0.2 },
        { skinId: 'skin_010_karambit_tiger_stripes', chance: 0.3 },
        { skinId: 'skin_024_operator_gloves_fade', chance: 0.5 },
        { skinId: 'skin_047_karambit_whiteout', chance: 1 },
        { skinId: 'skin_028_karambit_rusted', chance: 2 },
        { skinId: 'skin_092_stiletto_damascus', chance: 3 },
        { skinId: 'skin_056_skeleton_vanilla', chance: 7 },
        { skinId: 'skin_109_flip_naval', chance: 4 },
        { skinId: 'skin_106_flip_rusted', chance: 5 },
        { skinId: 'skin_129_gut_whiteout', chance: 10 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 8 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 12 },
        { skinId: 'skin_159_awp_tekko', chance: 10 },
        { skinId: 'skin_163_ak_47_midas', chance: 7 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 8 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 14.5 },
        { skinId: 'skin_168_package_glock_18_midas', chance: 7.5 },
      ],
    },
  },
  'covert-reactor': {
    price: 800,
    loot: {
      featuredSkinId: 'skin_022_karambit_vanilla',
      entries: [
        { skinId: 'skin_022_karambit_vanilla', chance: 0.2 },
        { skinId: 'skin_066_hand_wraps_aztec', chance: 0.2 },
        { skinId: 'skin_029_karambit_blackwidow', chance: 0.2 },
        { skinId: 'skin_030_stiletto_tiger_stripes', chance: 0.2 },
        { skinId: 'skin_025_karambit_damascus', chance: 0.2 },
        { skinId: 'skin_092_stiletto_damascus', chance: 0.5 },
        { skinId: 'skin_067_bayonet_naval', chance: 0.5 },
        { skinId: 'skin_098_flip_vanilla', chance: 2 },
        { skinId: 'skin_126_gut_blackwidow', chance: 3 },
        { skinId: 'skin_151_awp_high_octane', chance: 3 },
        { skinId: 'skin_151_awp_high_octane', chance: 7.5 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 7.5 },
        { skinId: 'skin_162_ak_47_pinpoint', chance: 7 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 15 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 10 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 5 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 12 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 11 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 10 },
        { skinId: 'skin_206_m4a1_s_castroil', chance: 5 },
      ],
    },
  },
  'cutlass-box': {
    name: 'Sakura Battle',
    price: 20,
    loot: {
      featuredSkinId: 'skin_bloxdb_307_ak_47_lore',
      entries: [
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 0.5 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 0.5 },
        { skinId: 'skin_244_famas_arctic_camo', chance: 9 },
        { skinId: 'skin_227_zeus_x27_overcharge', chance: 55 },
        { skinId: 'skin_236_aug_predator', chance: 35 },
      ],
    },
  },
  'driver-lane': {
    name: 'Butterfly Lane',
    price: 350,
    loot: {
      featuredSkinId: 'skin_062_hand_wraps_bandage',
      entries: [
        { skinId: 'skin_062_hand_wraps_bandage', chance: 1 },
        { skinId: 'skin_092_stiletto_damascus', chance: 1 },
        { skinId: 'skin_067_bayonet_naval', chance: 1 },
        { skinId: 'skin_137_gut_safari', chance: 2 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 5 },
        { skinId: 'skin_168_package_glock_18_midas', chance: 50 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'edge-protocol': {
    name: 'FiveSeven',
    tier: 'budget',
    price: 6,
    loot: {
      featuredSkinId: 'skin_236_aug_predator',
      entries: [
        { skinId: 'skin_236_aug_predator', chance: 50 },
        { skinId: 'skin_228_dual_berettas_gilded', chance: 50 },
      ],
    },
  },
  'ember-core': {
    name: 'Gloves Hunter',
    tier: 'glove',
    price: 250,
    loot: {
      featuredSkinId: 'skin_145_m4a1_s_anodized_red',
      entries: [
        { skinId: 'skin_151_awp_high_octane', chance: 4 },
        { skinId: 'skin_229_p250_glacial', chance: 3 },
        { skinId: 'skin_145_m4a1_s_anodized_red', chance: 3 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 6 },
        { skinId: 'skin_236_aug_predator', chance: 84 },
      ],
    },
  },
  'gold-reserve': {
    tier: 'mid',
    price: 50,
    loot: {
      featuredSkinId: 'skin_168_package_glock_18_midas',
      entries: [
        { skinId: 'skin_168_package_glock_18_midas', chance: 1 },
        { skinId: 'skin_207_mac_10_midas', chance: 4 },
        { skinId: 'skin_206_m4a1_s_castroil', chance: 15 },
        { skinId: 'skin_188_galil_ar_irid', chance: 10 },
        { skinId: 'skin_207_mac_10_midas', chance: 30 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'hand-wraps-box': {
    name: 'Stiletto Box',
    price: 500,
    loot: {
      featuredSkinId: 'skin_049_karambit_midnight',
      entries: [
        { skinId: 'skin_049_karambit_midnight', chance: 1 },
        { skinId: 'skin_046_butterfly_doodle', chance: 1 },
        { skinId: 'skin_098_flip_vanilla', chance: 3 },
        { skinId: 'skin_126_gut_blackwidow', chance: 5 },
        { skinId: 'skin_159_awp_tekko', chance: 10 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 20 },
        { skinId: 'skin_236_aug_predator', chance: 60 },
      ],
    },
  },
  'inferno-rush': {
    price: 450,
    loot: {
      featuredSkinId: 'skin_106_flip_rusted',
      entries: [
        { skinId: 'skin_106_flip_rusted', chance: 0.5 },
        { skinId: 'skin_132_hand_wraps_snakeskin', chance: 0.5 },
        { skinId: 'skin_131_driver_gloves_tartan', chance: 1 },
        { skinId: 'skin_126_gut_blackwidow', chance: 1 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 2 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 2 },
        { skinId: 'skin_162_ak_47_pinpoint', chance: 3 },
        { skinId: 'skin_159_awp_tekko', chance: 4 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 6 },
        { skinId: 'skin_167_m4a4_tekko', chance: 5 },
        { skinId: 'skin_174_mp9_high_octane', chance: 5 },
        { skinId: 'skin_233_ak_47_red_baron', chance: 4 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 10 },
        { skinId: 'skin_194_ssg_08_mindspill', chance: 6 },
        { skinId: 'skin_208_ak_47_aniki', chance: 10 },
        { skinId: 'skin_220_sg_553_frostline', chance: 10 },
        { skinId: 'skin_193_awp_railgun', chance: 10 },
        { skinId: 'skin_208_ak_47_aniki', chance: 10 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 5 },
        { skinId: 'skin_200_m4a4_ignition', chance: 5 },
      ],
    },
  },
  'kings-gambit': {
    name: 'Anodized Red',
    price: 75,
    loot: {
      featuredSkinId: 'skin_151_awp_high_octane',
      entries: [
        { skinId: 'skin_151_awp_high_octane', chance: 1 },
        { skinId: 'skin_233_ak_47_red_baron', chance: 4 },
        { skinId: 'skin_205_glock_18_fade', chance: 5 },
        { skinId: 'skin_206_m4a1_s_castroil', chance: 50 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'midnight-run': {
    name: 'Scarlet Risk',
    tier: 'knife',
    price: 500,
    loot: {
      featuredSkinId: 'skin_012_butterfly_fade',
      entries: [
        { skinId: 'skin_012_butterfly_fade', chance: 0.2 },
        { skinId: 'skin_022_karambit_vanilla', chance: 0.3 },
        { skinId: 'skin_064_sports_gloves_blackout', chance: 1.5 },
        { skinId: 'skin_056_skeleton_vanilla', chance: 3 },
        { skinId: 'skin_236_aug_predator', chance: 95 },
      ],
    },
  },
  'mystery-hex': {
    price: 199,
    loot: {
      featuredSkinId: 'skin_bloxdb_251_sports_gloves_the_ambassador',
      entries: [
        { skinId: 'skin_bloxdb_251_sports_gloves_the_ambassador', chance: 0.1 },
        { skinId: 'skin_085_butterfly_safari', chance: 0.1 },
        { skinId: 'skin_065_bayonet_violet', chance: 0.1 },
        { skinId: 'skin_056_skeleton_vanilla', chance: 0.2 },
        { skinId: 'skin_106_flip_rusted', chance: 0.5 },
        { skinId: 'skin_151_awp_high_octane', chance: 1 },
        { skinId: 'skin_159_awp_tekko', chance: 2 },
        { skinId: 'skin_167_m4a4_tekko', chance: 2 },
        { skinId: 'skin_141_package_mp_9_anodized_red', chance: 3.5 },
        { skinId: 'skin_174_mp9_high_octane', chance: 4 },
        { skinId: 'skin_181_m4a4_b_hop', chance: 5 },
        { skinId: 'skin_247_galil_ar_feral', chance: 15 },
        { skinId: 'skin_205_glock_18_fade', chance: 10 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 10 },
        { skinId: 'skin_200_m4a4_ignition', chance: 12 },
        { skinId: 'skin_206_m4a1_s_castroil', chance: 10 },
        { skinId: 'skin_246_famas_wallpaper', chance: 10 },
        { skinId: 'skin_246_famas_wallpaper', chance: 14.5 },
      ],
    },
  },
  'neon-district': {
    price: 120,
    loot: {
      featuredSkinId: 'skin_106_flip_rusted',
      entries: [
        { skinId: 'skin_106_flip_rusted', chance: 0.1 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 0.4 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 1.5 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 3 },
        { skinId: 'skin_167_m4a4_tekko', chance: 3 },
        { skinId: 'skin_154_package_usp_s_tekko', chance: 2 },
        { skinId: 'skin_194_ssg_08_mindspill', chance: 8 },
        { skinId: 'skin_247_galil_ar_feral', chance: 12 },
        { skinId: 'skin_193_awp_railgun', chance: 7 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 8 },
        { skinId: 'skin_200_m4a4_ignition', chance: 8 },
        { skinId: 'skin_206_m4a1_s_castroil', chance: 7 },
        { skinId: 'skin_246_famas_wallpaper', chance: 15 },
        { skinId: 'skin_246_famas_wallpaper', chance: 10 },
        { skinId: 'skin_244_famas_arctic_camo', chance: 15 },
      ],
    },
  },
  'night-market': {
    price: 325,
    loot: {
      featuredSkinId: 'skin_106_flip_rusted',
      entries: [
        { skinId: 'skin_106_flip_rusted', chance: 0.2 },
        { skinId: 'skin_132_hand_wraps_snakeskin', chance: 0.2 },
        { skinId: 'skin_116_sports_gloves_hunter', chance: 0.2 },
        { skinId: 'skin_122_awp_metamorphosis', chance: 0.2 },
        { skinId: 'skin_122_awp_metamorphosis', chance: 0.2 },
        { skinId: 'skin_151_awp_high_octane', chance: 1 },
        { skinId: 'skin_159_awp_tekko', chance: 1 },
        { skinId: 'skin_163_ak_47_midas', chance: 2 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 3 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 10 },
        { skinId: 'skin_167_m4a4_tekko', chance: 7 },
        { skinId: 'skin_233_ak_47_red_baron', chance: 5 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 13 },
        { skinId: 'skin_168_package_glock_18_midas', chance: 9 },
        { skinId: 'skin_194_ssg_08_mindspill', chance: 11 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 18 },
        { skinId: 'skin_bloxdb_293_glock_18_yurei', chance: 19 },
      ],
    },
  },
  'operator-wrap': {
    name: 'Checkers',
    price: 950,
    loot: {
      featuredSkinId: 'skin_137_gut_safari',
      entries: [
        { skinId: 'skin_137_gut_safari', chance: 50 },
        { skinId: 'skin_236_aug_predator', chance: 50 },
      ],
    },
  },
  'overdrive': {
    price: 1250,
    loot: {
      featuredSkinId: 'skin_010_karambit_tiger_stripes',
      entries: [
        { skinId: 'skin_010_karambit_tiger_stripes', chance: 0.1 },
        { skinId: 'skin_022_karambit_vanilla', chance: 0.4 },
        { skinId: 'skin_064_sports_gloves_blackout', chance: 1.5 },
        { skinId: 'skin_062_hand_wraps_bandage', chance: 1.5 },
        { skinId: 'skin_092_stiletto_damascus', chance: 2.5 },
        { skinId: 'skin_039_awp_beta', chance: 6 },
        { skinId: 'skin_127_gut_violet', chance: 8 },
        { skinId: 'skin_137_gut_safari', chance: 10 },
        { skinId: 'skin_151_awp_high_octane', chance: 8 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 7 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 13 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 20 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 10 },
        { skinId: 'skin_167_m4a4_tekko', chance: 12 },
      ],
    },
  },
  'phantom-grid': {
    price: 500,
    loot: {
      featuredSkinId: 'skin_106_flip_rusted',
      entries: [
        { skinId: 'skin_106_flip_rusted', chance: 2 },
        { skinId: 'skin_159_awp_tekko', chance: 8 },
        { skinId: 'skin_163_ak_47_midas', chance: 20 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 20 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 10 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'riot-zone': {
    price: 1000,
    loot: {
      featuredSkinId: 'skin_010_karambit_tiger_stripes',
      entries: [
        { skinId: 'skin_010_karambit_tiger_stripes', chance: 2 },
        { skinId: 'skin_032_operator_gloves_black_widow', chance: 3 },
        { skinId: 'skin_092_stiletto_damascus', chance: 5 },
        { skinId: 'skin_056_skeleton_vanilla', chance: 5 },
        { skinId: 'skin_126_gut_blackwidow', chance: 10 },
        { skinId: 'skin_137_gut_safari', chance: 10 },
        { skinId: 'skin_145_m4a1_s_anodized_red', chance: 10 },
        { skinId: 'skin_236_aug_predator', chance: 55 },
      ],
    },
  },
  'ruby-raid': {
    tier: 'mid',
    price: 150,
    loot: {
      featuredSkinId: 'skin_159_awp_tekko',
      entries: [
        { skinId: 'skin_159_awp_tekko', chance: 1 },
        { skinId: 'skin_bloxdb_306_m4a4_freedom', chance: 4 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 5 },
        { skinId: 'skin_194_ssg_08_mindspill', chance: 10 },
        { skinId: 'skin_181_m4a4_b_hop', chance: 20 },
        { skinId: 'skin_220_sg_553_frostline', chance: 20 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'sapphire-code': {
    tier: 'mid',
    price: 250,
    loot: {
      featuredSkinId: 'skin_151_awp_high_octane',
      entries: [
        { skinId: 'skin_151_awp_high_octane', chance: 1.5 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 3.5 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 5 },
        { skinId: 'skin_165_mp9_anodized_red', chance: 10 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 20 },
        { skinId: 'skin_168_package_glock_18_midas', chance: 20 },
        { skinId: 'skin_236_aug_predator', chance: 40 },
      ],
    },
  },
  'sharpened': {
    price: 70,
    loot: {
      featuredSkinId: 'skin_046_butterfly_doodle',
      entries: [
        { skinId: 'skin_046_butterfly_doodle', chance: 0.02 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 0.067 },
        { skinId: 'skin_159_awp_tekko', chance: 0.05 },
        { skinId: 'skin_208_ak_47_aniki', chance: 0.17 },
        { skinId: 'skin_187_m4a4_bubblepop', chance: 4 },
        { skinId: 'skin_208_ak_47_aniki', chance: 3 },
        { skinId: 'skin_193_awp_railgun', chance: 2 },
        { skinId: 'skin_247_galil_ar_feral', chance: 2 },
        { skinId: 'skin_206_m4a1_s_castroil', chance: 5 },
        { skinId: 'skin_188_galil_ar_irid', chance: 17 },
        { skinId: 'skin_bloxdb_293_glock_18_yurei', chance: 35 },
        { skinId: 'skin_214_ssg_08_racer8', chance: 31.693 },
      ],
    },
  },
  'shadow-vault': {
    price: 450,
    loot: {
      featuredSkinId: 'skin_092_stiletto_damascus',
      entries: [
        { skinId: 'skin_092_stiletto_damascus', chance: 0.02 },
        { skinId: 'skin_106_flip_rusted', chance: 0.05 },
        { skinId: 'skin_126_gut_blackwidow', chance: 0.13 },
        { skinId: 'skin_159_awp_tekko', chance: 0.6 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 1.2 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 2.5 },
        { skinId: 'skin_199_usp_s_ajax', chance: 4.5 },
        { skinId: 'skin_161_awp_overdrive', chance: 7 },
        { skinId: 'skin_154_package_usp_s_tekko', chance: 9 },
        { skinId: 'skin_199_usp_s_ajax', chance: 10 },
        { skinId: 'skin_233_ak_47_red_baron', chance: 10 },
        { skinId: 'skin_bloxdb_306_m4a4_freedom', chance: 15 },
        { skinId: 'skin_148_package_tec_9_medal_tv', chance: 16 },
        { skinId: 'skin_188_galil_ar_irid', chance: 10 },
        { skinId: 'skin_244_famas_arctic_camo', chance: 8 },
        { skinId: 'skin_bloxdb_293_glock_18_yurei', chance: 6 },
      ],
    },
  },
  'sport-palm': {
    name: 'Castroil',
    tier: 'mid',
    price: 125,
    loot: {
      featuredSkinId: 'skin_220_sg_553_frostline',
      entries: [
        { skinId: 'skin_220_sg_553_frostline', chance: 50 },
        { skinId: 'skin_236_aug_predator', chance: 50 },
      ],
    },
  },
  'street-cache': {
    price: 600,
    loot: {
      featuredSkinId: 'skin_010_karambit_tiger_stripes',
      entries: [
        { skinId: 'skin_010_karambit_tiger_stripes', chance: 0.1 },
        { skinId: 'skin_106_flip_rusted', chance: 0.25 },
        { skinId: 'skin_126_gut_blackwidow', chance: 0.5 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 1.5 },
        { skinId: 'skin_063_package_m4a1_s_anodized_red', chance: 5.75 },
        { skinId: 'skin_107_package_aug_anodized_red', chance: 5.75 },
        { skinId: 'skin_162_ak_47_pinpoint', chance: 5.5 },
        { skinId: 'skin_159_awp_tekko', chance: 5.5 },
        { skinId: 'skin_163_ak_47_midas', chance: 6.5 },
        { skinId: 'skin_190_ssg_08_onyx', chance: 8 },
        { skinId: 'skin_bloxdb_307_ak_47_lore', chance: 9.5 },
        { skinId: 'skin_199_usp_s_ajax', chance: 10.5 },
        { skinId: 'skin_161_awp_overdrive', chance: 10 },
        { skinId: 'skin_154_package_usp_s_tekko', chance: 8.8 },
        { skinId: 'skin_199_usp_s_ajax', chance: 7.95 },
        { skinId: 'skin_188_galil_ar_irid', chance: 4.5 },
        { skinId: 'skin_244_famas_arctic_camo', chance: 9.9 },
      ],
    },
  },
  'striker-knife': {
    name: 'MIDAS',
    tier: 'budget',
    price: 30,
    loot: {
      featuredSkinId: 'skin_236_aug_predator',
      entries: [
        { skinId: 'skin_236_aug_predator', chance: 50 },
        { skinId: 'skin_244_famas_arctic_camo', chance: 50 },
      ],
    },
  },
  'toxic-alley': {
    name: 'Knife Risk',
    tier: 'knife',
    price: 300,
    loot: {
      featuredSkinId: 'skin_100_skeleton_safari',
      entries: [
        { skinId: 'skin_100_skeleton_safari', chance: 2 },
        { skinId: 'skin_090_stiletto_doodle', chance: 2 },
        { skinId: 'skin_074_operator_gloves_bumblebee', chance: 2 },
        { skinId: 'skin_076_stiletto_vanilla', chance: 2 },
        { skinId: 'skin_094_operator_gloves_agent', chance: 2 },
        { skinId: 'skin_070_gut_tiger_stripes', chance: 1 },
        { skinId: 'skin_236_aug_predator', chance: 89 },
      ],
    },
  },
  'violet-storm': {
    price: 225,
    loot: {
      featuredSkinId: 'skin_041_stiletto_blackwidow',
      entries: [
        { skinId: 'skin_041_stiletto_blackwidow', chance: 0.5 },
        { skinId: 'skin_092_stiletto_damascus', chance: 0.5 },
        { skinId: 'skin_109_flip_naval', chance: 1 },
        { skinId: 'skin_088_skeleton_naval', chance: 1 },
        { skinId: 'skin_094_operator_gloves_agent', chance: 1 },
        { skinId: 'skin_076_stiletto_vanilla', chance: 1 },
        { skinId: 'skin_070_gut_tiger_stripes', chance: 2 },
        { skinId: 'skin_236_aug_predator', chance: 93 },
      ],
    },
  },
};

export function applyCuratedCaseOverrides<
  T extends { slug: string; name: string; tier: CuratedCaseTier; price: number; loot: FreeCaseLootTable },
>(catalog: T[]): T[] {
  return catalog.map(item => {
    const override = CURATED_CASE_OVERRIDES[item.slug];
    if (!override) {
      return {
        ...item,
        price: withCasePriceMarkup(item.slug, item.price),
      };
    }
    return {
      ...item,
      ...(override.name != null ? { name: override.name } : {}),
      ...(override.tier != null ? { tier: override.tier } : {}),
      price: withCasePriceMarkup(item.slug, override.price),
      loot: override.loot,
    };
  });
}
