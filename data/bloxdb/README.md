# BloxDB local skin import

Source used by the importer (verified in network/JS of bloxdb.net):

- Catalog API: `GET https://www.bloxdb.net/api/skins.php` (full JSON array)
- Images: `https://www.bloxdb.net/assets/img/skins/<slug>.png`

## Commands (localhost only)

```bash
# Preview without writing
npm run import:bloxdb:dry

# Full import (catalog + images, no BloxDB prices)
npm run import:bloxdb

# Later — your custom prices only
npm run prices:apply:dry -- --file data/bloxdb/prices.json
npm run prices:apply -- --file data/bloxdb/prices.json
```

Prices are never taken from BloxDB. New skins are stored with `price: 0` until you provide a list.
