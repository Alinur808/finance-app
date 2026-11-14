/**
 * Совместимость pdf.js с Safari / JavaScriptCore.
 *
 * pdf.js 6.x (даже legacy-сборка) рассчитывает на два API, которых нет в части
 * версий Safari и которые не покрыты встроенными полифиллами core-js:
 *   1. асинхронный итератор у ReadableStream (`for await (… of stream)`) —
 *      на нём построены getTextContent() и распаковка потоков; в Safari это
 *      падает с «TypeError: undefined is not a function»;
 *   2. Promise.withResolvers (Safari < 17.4).
 * Модуль подключается и на главном потоке (pdfImport.js), и первым импортом
 * в воркере (workers/pdf.worker.js). Повторный вызов ничего не меняет.
 */

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new this((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof ReadableStream !== 'undefined' && typeof ReadableStream.prototype[Symbol.asyncIterator] !== 'function') {
  const values = function values({ preventCancel = false } = {}) {
    const reader = this.getReader();
    return {
      async next() {
        try {
          const result = await reader.read();
          if (result.done) reader.releaseLock();
          return result;
        } catch (error) {
          reader.releaseLock();
          throw error;
        }
      },
      async return(value) {
        if (!preventCancel) {
          const cancelled = reader.cancel(value);
          reader.releaseLock();
          await cancelled;
        } else {
          reader.releaseLock();
        }
        return { done: true, value };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
  try {
    Object.defineProperty(ReadableStream.prototype, 'values', { value: values, writable: true, configurable: true });
    Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
  } catch {
    // свойство заблокировано движком — текст всё равно читается вручную (readTextContent)
  }
}

export const PDF_COMPAT_INSTALLED = true;
