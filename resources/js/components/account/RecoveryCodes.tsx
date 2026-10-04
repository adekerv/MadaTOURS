import { useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
/**
 * The one moment a person sees their recovery codes. They are only ever shown here, so the panel asks for a
 * confirmation that they were saved before it lets go, and offers copy and download.
 */
export function RecoveryCodes({
  codes,
  email,
  onDone,
  warn = false,
}: {
  codes: string[];
  email: string;
  onDone: () => void;
  /** Raised when the person tried to close without confirming. */
  warn?: boolean;
}) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const text = () =>
    [
      t('MadaTours recovery codes'),
      email,
      new Date().toISOString().slice(0, 10),
      '',
      ...codes,
      '',
      t('Each code works once. Keep this file private.'),
    ].join('\n');
  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'madatours-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        {t(
          'If you forget your password, one of these codes lets you reset it. We do not send email, so this is the only way back in. Each code works once, and they are shown only now.',
        )}
      </p>
      <ol
        aria-label={t('Save your recovery codes')}
        className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-4 font-mono text-base font-semibold tracking-wider text-slate-900"
      >
        {codes.map((code) => (
          <li key={code} data-recovery-code>
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="secondary-button flex items-center gap-2" onClick={copy}>
          <Copy size={18} aria-hidden="true" />
          {t(copied ? 'Copied' : 'Copy codes')}
        </button>
        <button
          type="button"
          className="secondary-button flex items-center gap-2"
          onClick={download}
        >
          <Download size={18} aria-hidden="true" />
          {t('Download codes')}
        </button>
      </div>
      {copyFailed && (
        <p role="alert" className="error-message">
          {t('Could not copy. Select the codes and copy them by hand.')}
        </p>
      )}
      <label className="flex min-h-11 items-start gap-3 text-sm font-semibold text-slate-900">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        {t('I have saved these codes')}
      </label>
      {warn && !saved && (
        <p role="alert" className="error-message">
          {t('Save your codes first, then tick the box.')}
        </p>
      )}
      <button type="button" disabled={!saved} className="primary-button w-full" onClick={onDone}>
        {t('Done')}
      </button>
    </div>
  );
}
