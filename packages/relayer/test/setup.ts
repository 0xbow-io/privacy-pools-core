import { writeFile } from 'node:fs/promises';
import { originalConfig } from './inputs/originalConfig.js';

// reset config.test.json to original state at the start of each test run
await writeFile('./test/inputs/config.test.json', JSON.stringify(originalConfig, null, 2));