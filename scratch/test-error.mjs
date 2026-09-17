import { extractText } from 'unpdf';
import fs from 'fs';

// Let's create a minimal test or see what extractText returns on empty/dummy buffer
async function run() {
  try {
    const dummy = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    await extractText(dummy);
  } catch (e) {
    console.log('Error caught as expected for invalid pdf:', e.message);
  }
}
run();
