/**
 * Чтение PDF-выписки в браузере. pdf.js (~1,8 МБ вместе с воркером) грузится
 * только в момент выбора PDF — на скорость открытия приложения он не влияет.
 * Файл не покидает устройство: нет ни одного сетевого запроса с его содержимым.
 *
 * Воркер pdf.js собирается Vite через `?worker`: на выходе обычный .js-файл
 * с относительным путём (работает в подпапке GitHub Pages /finance-app/),
 * классический воркер без требований к MIME-типу .mjs и поддержке
 * module-воркеров (важно для старых iOS). Мы создаём его сами и передаём
 * в pdf.js через GlobalWorkerOptions.workerPort, поэтому pdf.js не ищет
 * воркер по URL и не уходит в «fake worker» на главном потоке.
 */
import { describePdfError, extractPdfPages, parseFreedomStatement } from './freedomParser.js';

const WORKER_TIMEOUT_MS = 30_000;

let workerPromise = null;

/** Один воркер на всё время работы приложения; при сбое — пересоздаём. */
function getWorker() {
  if (!workerPromise) {
    workerPromise = import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker').then(({ default: PdfWorker }) => {
      const worker = new PdfWorker({ name: 'pdfjs-worker' });
      worker.__lastError = null;
      worker.addEventListener('error', (e) => {
        // ErrorEvent при неудачной загрузке/запуске скрипта воркера
        worker.__lastError = e?.message || `Не удалось загрузить скрипт воркера (${e?.filename || 'нет имени файла'})`;
      });
      return worker;
    });
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

function resetWorker() {
  const pending = workerPromise;
  workerPromise = null;
  pending?.then((w) => w.terminate()).catch(() => {});
}

/** Ждёт `task`, но падает сразу при ошибке воркера и через 30 с без ответа. */
function watchWorker(worker, task) {
  return new Promise((resolve, reject) => {
    const fail = (error) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(error);
    };
    const timer = setTimeout(() => {
      const err = new Error(worker.__lastError || `нет ответа от воркера ${WORKER_TIMEOUT_MS / 1000} с`);
      err.name = 'PdfWorkerTimeout';
      fail(err);
    }, WORKER_TIMEOUT_MS);
    // ошибка загрузки скрипта воркера приходит событием, а не исключением
    const poll = setInterval(() => {
      if (worker.__lastError) {
        const err = new Error(worker.__lastError);
        err.name = 'PdfWorkerError';
        fail(err);
      }
    }, 200);
    task.then(
      (value) => {
        clearTimeout(timer);
        clearInterval(poll);
        resolve(value);
      },
      (error) => fail(error),
    );
  });
}

/**
 * Читает выписку Freedom Bank. Любая ошибка превращается в ImportError:
 * message — понятный текст, details — точная причина и этап (видны в интерфейсе).
 */
export async function readFreedomPdf(file) {
  let stage = 'loading-modules';
  let page;
  let pdfjs;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs');

    stage = 'starting-worker';
    const worker = await getWorker();
    if (worker.__lastError) throw Object.assign(new Error(worker.__lastError), { name: 'PdfWorkerError' });
    pdfjs.GlobalWorkerOptions.workerPort = worker;

    stage = 'reading-file';
    const data = new Uint8Array(await file.arrayBuffer());

    stage = 'opening';
    const pages = await watchWorker(
      worker,
      extractPdfPages(data, pdfjs, (s, n) => {
        stage = s;
        page = n;
      }),
    );

    stage = 'parsing';
    page = undefined;
    return parseFreedomStatement(pages);
  } catch (error) {
    if (['starting-worker', 'opening', 'extracting-text'].includes(stage) && error?.name !== 'PasswordException' && error?.name !== 'InvalidPDFException') {
      resetWorker(); // следующая попытка начнёт с чистого воркера
    }
    throw describePdfError(error, stage, { page, pdfjsVersion: pdfjs?.version });
  }
}
