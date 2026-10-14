import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * A password field with its own show/hide button, so two fields on one form toggle independently. The button is
 * 44px square for touch, and its label says what pressing it will do.
 */
export function PasswordInput({ className = '', ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`field-input pr-14 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={t(visible ? 'Hide password' : 'Show password')}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-xl px-3 text-slate-600 hover:text-orange-800"
      >
        {visible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </button>
    </span>
  );
}
