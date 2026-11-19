#!/usr/bin/env node
// Creates the ADMIN_PASSWORD_HASH secret value (PBKDF2-SHA256, 100k iterations – the Workers maximum).
// Usage: node scripts/hash-password.mjs              -> prompts for the password
//        node scripts/hash-password.mjs "password"   -> avoid: ends up in shell history
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import readline from 'node:readline';

function ask() {
  if (process.argv[2]) return Promise.resolve(process.argv[2]);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question('Admin-Passwort (mind. 12 Zeichen): ', (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

const password = await ask();
if (!password || password.length < 12) {
  console.error('Bitte ein Passwort mit mindestens 12 Zeichen verwenden.');
  process.exit(1);
}
const iterations = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(`pbkdf2-sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`);
