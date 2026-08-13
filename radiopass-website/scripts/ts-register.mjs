/* Registers ./ts-resolve.mjs, so `node --import ./scripts/ts-register.mjs x.ts`
   can import the app's extensionless TypeScript modules. */
import { register } from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
