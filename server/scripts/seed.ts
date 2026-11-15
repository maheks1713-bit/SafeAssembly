// npm run seed  -> wipes the demo event's live data and re-inserts 1 event, 3 zones, 9 volunteers.
import { resetDemo } from "../src/seed";

resetDemo()
  .then((r) => { console.log("Seeded:", r); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
