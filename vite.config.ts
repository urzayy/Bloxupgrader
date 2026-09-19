import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withdrawChatPlugin } from './vite-withdraw-chat-plugin';
import { inventoryGrantsPlugin } from './vite-inventory-grants-plugin';
import { balanceGrantsPlugin } from './vite-balance-grants-plugin';
import { levelGrantsPlugin } from './vite-level-grants-plugin';
import { siteStatePlugin } from './vite-site-state-plugin';
import { userDbPlugin } from './vite-user-db-plugin';
import { promoCodesPlugin } from './vite-promo-codes-plugin';
import { giveawaysPlugin } from './vite-giveaways-plugin';
import { caseBattlesPlugin } from './vite-case-battles-plugin';
import { announcementPlugin } from './vite-announcement-plugin';
import { adminEmailsPlugin } from './vite-admin-emails-plugin';
import { presencePlugin } from './vite-presence-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local Vite must not block on Supabase timeouts (keeps localhost snappy).
process.env.BLOX_LOCAL_FILE_ONLY ??= '1';
process.env.DURABLE_JSON ??= '0';

const userDbDir = path.resolve(__dirname, 'user-db');
const withdrawChatsDir = path.resolve(__dirname, 'withdraw-chats');
const inventoryGrantsDir = path.resolve(__dirname, 'inventory-grants');
const balanceGrantsDir = path.resolve(__dirname, 'balance-grants');
const levelGrantsDir = path.resolve(__dirname, 'level-grants');
const siteStateDir = path.resolve(__dirname, 'site-state');
const promoCodesDir = path.resolve(__dirname, 'promo-codes');
const giveawaysDir = path.resolve(__dirname, 'giveaways');
const caseBattlesDir = path.resolve(__dirname, 'case-battles');
const announcementsDir = path.resolve(__dirname, 'announcements');

export default defineConfig({
  appType: 'spa',
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
  },
  plugins: [
    react(),
    userDbPlugin(userDbDir, siteStateDir),
    promoCodesPlugin(promoCodesDir, userDbDir),
    giveawaysPlugin(giveawaysDir, userDbDir, inventoryGrantsDir),
    caseBattlesPlugin(caseBattlesDir),
    announcementPlugin(announcementsDir, userDbDir),
    withdrawChatPlugin(withdrawChatsDir, { giveawaysDir, grantsDir: inventoryGrantsDir }),
    inventoryGrantsPlugin(inventoryGrantsDir),
    balanceGrantsPlugin(balanceGrantsDir),
    levelGrantsPlugin(levelGrantsDir),
    siteStatePlugin(siteStateDir, userDbDir),
    adminEmailsPlugin(siteStateDir),
    presencePlugin(siteStateDir),
  ],
  server: {
    port: 5173,
    open: false,
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/DevApp.tsx',
        './src/components/layout/Header.tsx',
        './src/pages/MainPage.tsx',
        './src/pages/UpgradePage.tsx',
      ],
    },
    watch: {
      ignored: [
        '**/src/lib/feedBot.mjs',
        '**/site-state/**',
        '**/user-db/**',
        '**/player-state/**',
        '**/user-logs/**',
        '**/withdraw-chats/**',
        '**/inventory-grants/**',
        '**/balance-grants/**',
        '**/level-grants/**',
        '**/giveaways/**',
        '**/case-battles/**',
        '**/promo-codes/**',
        '**/announcements/**',
        '**/account-resets/**',
        '**/public/images/free-cases/iron-case-base.png',
        '**/public/images/free-cases/m4a1s-orchids.png',
        '**/public/images/free-cases/iron-chest-original.png',
        '**/public/images/free-cases/iron-chest.jpg',
        '**/public/images/free-cases/iron-vault.png',
        '**/public/images/free-cases/copper-chest.png',
        '**/public/images/free-cases/copper-treasure.png',
        '**/public/images/free-cases/silver-case.png',
        '**/public/images/free-cases/gold-treasure.png',
        '**/public/images/free-cases/gold-chest-v2.png',
        '**/public/images/free-cases/platinum-treasure.png',
        '**/public/images/free-cases/emerald-treasure.png',
        '**/public/images/free-cases/ruby-treasure.png',
        '**/public/images/free-cases/sapphire-treasure.png',
        '**/public/images/free-cases/diamond-treasure.png',
        '**/public/images/free-cases/master-treasure.png',
        '**/public/images/free-cases/challenger-treasure.png',
      ],
    },
  },
});
