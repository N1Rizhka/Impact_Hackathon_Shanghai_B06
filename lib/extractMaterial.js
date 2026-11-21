'use client';

/**
 * Extract plain text from uploaded study files (txt/md/pdf/images).
 * Runs in the browser so Vercel doesn't need native PDF/OCR binaries.
 */
export async function extractTextFromFile(file, onProgress) {
  const name = file.name || 'upload';
  const type = (file.type || '').toLowerCase();
  const lower = name.toLowerCase();

  if (
    type.startsWith('text/') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.csv')
  ) {
    onProgress?.(`Reading ${name}…`);
    return file.text();
  }

  if (type === 'application/pdf' || lower.endsWith('.pdf')) {
    return extractPdf(file, onProgress);
  }

  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(lower)) {
    return extractImage(file, onProgress);
  }

  throw new Error(`Unsupported file type: ${name}. Use PDF, image, or text.`);
}

export async function extractTextFromFiles(files, onProgress) {
  const list = [...files];
  const chunks = [];
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i];
    onProgress?.(`File ${i + 1}/${list.length}: ${file.name}`);
    const text = (await extractTextFromFile(file, onProgress)).trim();
    if (text) {
      chunks.push(`--- ${file.name} ---\n${text}`);
    }
  }
  const joined = chunks.join('\n\n').trim();
  if (!joined) {
    throw new Error('Could not extract any text from those files.');
  }
  return joined;
}

async function extractPdf(file, onProgress) {
  onProgress?.(`Loading PDF ${file.name}…`);
  const pdfjs = await import('pdfjs-dist');
  // CDN worker stays version-matched and works on Vercel client bundles.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    onProgress?.(`PDF page ${pageNum}/${doc.numPages}…`);
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(line);
  }
  const text = pages.join('\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) {
    throw new Error(
      `No selectable text in ${file.name}. Try a text-based PDF, or upload a screenshot/photo instead.`,
    );
  }
  return text;
}

async function extractImage(file, onProgress) {
  onProgress?.(`OCR ${file.name}…`);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(`OCR ${file.name}… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    const cleaned = (text || '').trim();
    if (!cleaned) {
      throw new Error(`No text found in image ${file.name}.`);
    }
    return cleaned;
  } finally {
    await worker.terminate();
  }
}
