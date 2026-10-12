import { writeFileSync } from 'node:fs';
import { creditsPath, formattedCredits, libraryFiles } from './photo-library';

libraryFiles();
writeFileSync(creditsPath, await formattedCredits());
console.log(`Wrote ${creditsPath}`);
