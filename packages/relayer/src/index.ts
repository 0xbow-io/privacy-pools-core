import { app } from "./app.js";
import { db } from "./providers/db.provider.js";

const port = 3000;

async function main() {
  await db.init();
  // Start the server
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
