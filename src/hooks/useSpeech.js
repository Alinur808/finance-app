import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Распознавание речи (Web Speech API, ru-RU): Safari на iOS 14.5+, Chrome.
 *
 *   const speech = useSpeech({ onFinal: (text) => … });
 *   speech.supported, speech.listening, speech.interim, speech.error
 *   speech.start(), speech.stop()
 *
 * Звук обрабатывает сам браузер/система (Apple или Google), приложение
 * получает только текст фразы и ничего никуда не отправляет.
 */
const getRecognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

const ERRORS = {
  'not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках браузера',
  'service-not-allowed': 'Голосовой ввод выключен в настройках устройства',
  'no-speech': 'Не расслышал. Нажмите и скажите, например: «Такси две пятьсот»',
  'audio-capture': 'Микрофон недоступен',
  network: 'Для распознавания речи нужен интернет',
};

export function useSpeech({ onFinal, onStart } = {}) {
  const Recognition = getRecognition();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => () => recRef.current?.abort?.(), []);

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return false;
    setError('');
    setInterim('');
    const rec = new Recognition();
    rec.lang = 'ru-RU';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let delivered = false;
    rec.onresult = (e) => {
      let text = '';
      let isFinal = false;
      for (let i = 0; i < e.results.length; i += 1) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      setInterim(text);
      if (isFinal && !delivered) {
        delivered = true;
        finalRef.current?.(text);
      }
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Не удалось распознать речь');
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    try {
      onStart?.();
      rec.start();
      recRef.current = rec;
      setListening(true);
      return true;
    } catch {
      setError('Не удалось включить микрофон');
      return false;
    }
  }, [Recognition, onStart]);

  const stop = useCallback(() => recRef.current?.stop?.(), []);

  return { supported: Boolean(Recognition), listening, interim, error, start, stop, setError };
}
