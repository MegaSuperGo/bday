#!/usr/bin/env node
// Prints a random 256-bit key (base64) for the ENCRYPTION_KEY Worker Secret.
import { randomBytes } from 'node:crypto';
console.log(randomBytes(32).toString('base64'));
