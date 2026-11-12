/**
 * Чтение PDF-выписки в браузере. pdf.js (~1,8 МБ вместе с воркером) грузится
 * только в момент выбора PDF — на скорость открытия приложения он не влияет.
 * Файл не покидает устройство: нет ни одного сетевого запроса с его содержимым.
 */
export async function readFreedomPdf(file) {
  const [pdfjs, worker, parser] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    import('./freedomParser.js'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  let pages;
  try {
    pages = await parser.extractPdfPages(new Uint8Array(await file.arrayBuffer()), pdfjs);
  } catch (e) {
    if (e?.name === 'PasswordException') throw new Error('PDF защищён паролем. Скачайте выписку без пароля и попробуйте снова.');
    throw new Error('Не удалось открыть PDF. Проверьте, что файл не повреждён.');
  }
  return parser.parseFreedomStatement(pages);
}
