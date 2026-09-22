import { rmSync } from 'node:fs';
export default function cleanup() {
  if (process.env.MADATOURS_E2E_DB)
    for (const suffix of ['', '-wal', '-shm'])
      rmSync(process.env.MADATOURS_E2E_DB + suffix, { force: true });
}
