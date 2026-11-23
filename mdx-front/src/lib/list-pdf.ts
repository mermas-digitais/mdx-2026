export type PdfTable = {
  heading: string;
  columns: { label: string; width: number }[];
  rows: string[][];
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const WIN_EXTRA: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

export function buildPdf(input: { title: string; subtitle?: string; tables: PdfTable[] }): ArrayBuffer {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const freshPage = () => {
    if (commands.length > 0) pages.push(commands);
    commands = ["0.85 0.8 0.9 RG", "0.6 w"];
    y = PAGE_HEIGHT - MARGIN;
  };

  const write = (font: "F1" | "F2", size: number, x: number, baseline: number, value: string) => {
    commands.push(
      `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${pdfString(value)}) Tj ET`,
    );
  };

  const paint = (cells: string[], font: "F1" | "F2", columns: { width: number }[]) => {
    const wrapped = columns.map((column, index) => wrap(cells[index] ?? "", charsIn(column.width - 8, 10)));
    const lines = Math.max(1, ...wrapped.map((item) => item.length));
    const height = lines * 13 + 4;
    if (y - height < MARGIN) freshPage();
    let x = MARGIN;
    wrapped.forEach((cell, index) => {
      cell.forEach((line, lineIndex) => {
        write(font, 10, x, y - 12 - lineIndex * 13, line);
      });
      x += columns[index]?.width ?? 0;
    });
    y -= height;
  };

  freshPage();
  write("F2", 16, MARGIN, y - 16, input.title);
  y -= 24;
  if (input.subtitle) {
    for (const line of wrap(input.subtitle, charsIn(CONTENT_WIDTH, 10))) {
      write("F1", 10, MARGIN, y - 10, line);
      y -= 14;
    }
    y -= 6;
  }

  const tables = input.tables.filter((table) => table.rows.length > 0);
  if (tables.length === 0) {
    write("F1", 11, MARGIN, y - 12, "Nada para exportar com esses filtros.");
  }

  for (const table of tables) {
    const columns = fitColumns(table.columns);
    const labels = table.columns.map((column) => column.label);
    if (y - 46 < MARGIN) freshPage();
    write("F2", 13, MARGIN, y - 13, table.heading);
    y -= 20;
    paint(labels, "F2", columns);
    commands.push(`${MARGIN} ${y + 4} m ${PAGE_WIDTH - MARGIN} ${y + 4} l S`);
    y -= 4;
    for (const row of table.rows) paint(row, "F1", columns);
    y -= 12;
  }

  if (commands.length > 0) pages.push(commands);
  return serialize(pages).buffer;
}

export function downloadPdf(filename: string, bytes: ArrayBuffer) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fitColumns(columns: { label: string; width: number }[]) {
  const total = columns.reduce((sum, column) => sum + column.width, 0) || 1;
  return columns.map((column) => ({ width: (column.width / total) * CONTENT_WIDTH }));
}

function charsIn(width: number, size: number) {
  return Math.max(8, Math.floor(width / (size * 0.5)));
}

function wrap(value: string, maxChars: number): string[] {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const lines: string[] = [];
  let rest = clean;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < 1) cut = maxChars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
    if (lines.length === 3) {
      const last = lines[2] ?? "";
      lines[2] = `${last.slice(0, Math.max(0, maxChars - 3))}...`;
      return lines;
    }
  }
  if (rest) lines.push(rest);
  return lines;
}

function byteOf(char: string): number {
  const extra = WIN_EXTRA[char];
  if (extra) return extra;
  const code = char.codePointAt(0) ?? 63;
  if (code >= 32 && code <= 255 && !(code >= 0x80 && code <= 0x9f)) return code;
  return 63;
}

function pdfString(value: string): string {
  let out = "";
  for (const char of value) {
    const byte = byteOf(char);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function serialize(pages: string[][]): Uint8Array<ArrayBuffer> {
  const chunks: { id: number; body: string }[] = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 3, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
    { id: 4, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>" },
  ];
  const kids: number[] = [];
  let nextId = 5;
  for (const commands of pages) {
    const pageId = nextId++;
    const streamId = nextId++;
    kids.push(pageId);
    const stream = commands.join("\n");
    chunks.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
    });
    chunks.push({
      id: streamId,
      body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    });
  }
  chunks.push({
    id: 2,
    body: `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`,
  });
  chunks.sort((left, right) => left.id - right.id);

  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const chunk of chunks) {
    offsets[chunk.id] = output.length;
    output += `${chunk.id} 0 obj\n${chunk.body}\nendobj\n`;
  }
  const xrefAt = output.length;
  output += `xref\n0 ${chunks.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let id = 1; id <= chunks.length; id += 1) {
    output += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${chunks.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  const bytes = new Uint8Array(new ArrayBuffer(output.length));
  for (let index = 0; index < output.length; index += 1) bytes[index] = output.charCodeAt(index);
  return bytes;
}
