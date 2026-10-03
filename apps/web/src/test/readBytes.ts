/** Read a file in Vitest (Node) without adding Node types to the web package. */
export function readBytes(url: URL): Uint8Array {
  const fs = (
    globalThis as unknown as {
      process: { getBuiltinModule(id: 'node:fs'): { readFileSync(p: URL): Uint8Array } };
    }
  ).process.getBuiltinModule('node:fs');
  return new Uint8Array(fs.readFileSync(url));
}

/** The three Crimson Text files the PDF renderer embeds. */
export function readPdfFonts() {
  const font = (name: string) =>
    readBytes(new URL(`../assets/fonts/crimson-text/CrimsonText-${name}.ttf`, import.meta.url));
  return { regular: font('Regular'), bold: font('Bold'), italic: font('Italic') };
}
