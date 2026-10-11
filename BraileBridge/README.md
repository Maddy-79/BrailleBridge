# BrailleBridge (HTML + CSS + JavaScript)

A simple standalone website. No Flask, Python server, Tailwind, or build tools required.

## Open it

1. Unzip the download.
2. Open `BrailleBridge-Fixed/index.html` in Chrome, Edge, or Safari.
3. Use the **Switch** button to change between translator pages.

## Files

- `index.html` — HTML structure for both pages.
- `style.css` — plain CSS for the blue/silver responsive styling.
- `script.js` — plain JavaScript for image uploads, dot detection, translation, text-to-speech, downloads, and the bench simulator.

## Braille to Text

The previous build had a JavaScript bug: it called an undefined `decodeCells()` function. This build corrects it and improves dark-dot detection, dot clustering, and cell decoding. Use straight, tightly cropped, high-contrast pictures of **printed Grade 1 English Braille with dark dots on a light background**. The code is experimental image recognition, not a trained OCR system. It may misread dots or spaces, and **embossed Braille photographs are not reliable**. Always check/edit the resulting text. Unsupported symbols can appear as `�`.

## Text to Braille / bench

Supports basic Grade 1 English letters, capitals, digits, and selected punctuation. A moving six-pin **visual simulation** represents the current cell; no real ESP32 or solenoid connection is made. `Download Braille` saves Unicode text; `.brf` saves basic Braille ASCII.
