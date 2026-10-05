import { translate, type Language } from '../i18n/core';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * What the browser's own form checks (required, minlength, type=email, ...) say, in the app's language. Browsers
 * word those pop-ups in their own language, which is often not the one chosen in the app. Returns null for a
 * problem it has no wording for, which then keeps the browser's message.
 */
export function validationMessage(field: Field, language: Language): string | null {
  const t = (message: string, values?: Record<string, string | number>) =>
    translate(language, message, values);
  const { validity } = field;
  const type = field instanceof HTMLInputElement ? field.type : field.tagName.toLowerCase();
  if (validity.valueMissing) {
    if (type === 'checkbox' || type === 'radio') return t('Please tick this box to continue.');
    if (type === 'select') return t('Please choose an option.');
    return t('Please fill in this field.');
  }
  if (validity.typeMismatch) {
    if (type === 'email') return t('Enter an email address, for example name@example.com.');
    if (type === 'url') return t('Enter a web address starting with https://.');
    return t('Enter a valid value.');
  }
  if (validity.tooShort)
    return t('Use at least {min} characters (you have {count}).', {
      min: (field as HTMLInputElement).minLength,
      count: field.value.length,
    });
  if (validity.tooLong)
    return t('Use at most {max} characters.', { max: (field as HTMLInputElement).maxLength });
  if (validity.patternMismatch) return field.title || t('Use the format shown.');
  if (validity.rangeUnderflow)
    return t('Enter {min} or more.', { min: (field as HTMLInputElement).min });
  if (validity.rangeOverflow)
    return t('Enter {max} or less.', { max: (field as HTMLInputElement).max });
  if (validity.stepMismatch || validity.badInput) return t('Enter a valid number.');
  return null;
}

/**
 * Installs the wording on every form in the page; returns the function that removes it. The message is set while the
 * browser shows its pop-up and cleared straight after (and on the next edit), so a field whose value is later set in
 * code is not left invalid by a stale message.
 */
export function explainFormErrors(language: Language): () => void {
  const explain = (event: Event) => {
    const field = event.target as Field;
    const message = validationMessage(field, language);
    if (!message) return;
    field.setCustomValidity(message);
    setTimeout(() => field.setCustomValidity(''), 0);
  };
  const clear = (event: Event) => (event.target as Field).setCustomValidity?.('');
  document.addEventListener('invalid', explain, true);
  document.addEventListener('input', clear, true);
  document.addEventListener('change', clear, true);
  return () => {
    document.removeEventListener('invalid', explain, true);
    document.removeEventListener('input', clear, true);
    document.removeEventListener('change', clear, true);
  };
}
