/**
 * Точка входа воркера pdf.js. Сначала полифиллы для Safari, затем сам воркер.
 * Vite собирает файл через `?worker` в классический .js с относительным путём.
 */
import '../utils/pdfCompat.js';
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
