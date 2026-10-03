import type { ReactNode } from 'react';
import {
  Accessibility,
  CalendarCheck,
  Clock,
  CreditCard,
  Facebook,
  Globe,
  Instagram,
  Languages,
  MapPin,
  Sparkles,
  Phone,
  CircleParking,
  Tag,
  Utensils,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Place } from '../../types';
import { telHref, hasHours, type PlaceFacts } from '../../lib/place-details';
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-orange-700">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-slate-800">{children}</dd>
      </div>
    </div>
  );
}
const link = 'inline-flex min-h-11 items-center font-medium text-orange-800 underline';
function hostname(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
}
export function PracticalInfo({ place, facts }: { place: Place; facts: PlaceFacts }) {
  const { t, language } = useI18n();
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2026, 8, 27 + day)));
  const rows: ReactNode[] = [];
  const size = 20;
  if (facts.address)
    rows.push(
      <Row key="address" icon={<MapPin size={size} />} label={t('Address')}>
        {facts.address}
      </Row>,
    );
  if (place.openingPeriods?.length)
    rows.push(
      <Row key="hours" icon={<Clock size={size} />} label={t('Opening hours')}>
        <ul className="space-y-0.5">
          {Array.from({ length: 7 }, (_, day) => {
            const periods = place.openingPeriods!.filter((period) => period.day === day);
            return periods.length ? (
              <li key={day}>
                {weekday(day)} ·{' '}
                {periods
                  .map((period) => `${clock(period.opens)}–${clock(period.closes)}`)
                  .join(', ')}
              </li>
            ) : null;
          })}
        </ul>
        {place.hoursSource && (
          <a className={link} href={place.hoursSource} target="_blank" rel="noopener noreferrer">
            {t('Source hours')}
          </a>
        )}
      </Row>,
    );
  else if (facts.hoursText)
    rows.push(
      <Row key="hours" icon={<Clock size={size} />} label={t('Opening hours')}>
        <span className="whitespace-pre-line">{facts.hoursText}</span>
        <span className="mt-1 block text-xs text-slate-500">{t('As listed by the source.')}</span>
      </Row>,
    );
  if (facts.phone)
    rows.push(
      <Row key="phone" icon={<Phone size={size} />} label={t('Telephone')}>
        <a className={link} href={telHref(facts.phone)}>
          {facts.phone}
        </a>
      </Row>,
    );
  if (facts.website)
    rows.push(
      <Row key="website" icon={<Globe size={size} />} label={t('Website')}>
        <a className={link} href={facts.website} target="_blank" rel="noopener noreferrer">
          {hostname(facts.website)}
        </a>
      </Row>,
    );
  if (facts.facebook || facts.instagram)
    rows.push(
      <Row
        key="social"
        icon={facts.instagram ? <Instagram size={size} /> : <Facebook size={size} />}
        label={t('Social media')}
      >
        <span className="flex flex-wrap gap-x-4">
          {facts.facebook && (
            <a className={link} href={facts.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
          )}
          {facts.instagram && (
            <a className={link} href={facts.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
        </span>
      </Row>,
    );
  if (facts.priceRange)
    rows.push(
      <Row key="price" icon={<Tag size={size} />} label={t('Price range')}>
        {facts.priceRange}
      </Row>,
    );
  if (facts.kind?.length)
    rows.push(
      <Row key="kind" icon={<Utensils size={size} />} label={t('Type')}>
        {facts.kind.map((item) => t(item)).join(', ')}
      </Row>,
    );
  if (facts.payment?.length)
    rows.push(
      <Row key="payment" icon={<CreditCard size={size} />} label={t('Payment')}>
        {facts.payment.map((item) => t(item)).join(', ')}
      </Row>,
    );
  if (facts.languages?.length)
    rows.push(
      <Row key="languages" icon={<Languages size={size} />} label={t('Languages spoken')}>
        {facts.languages.map((item) => t(item)).join(', ')}
      </Row>,
    );
  if (facts.services?.length)
    rows.push(
      <Row key="services" icon={<Sparkles size={size} />} label={t('Services')}>
        {facts.services.map((item) => t(item)).join(', ')}
      </Row>,
    );
  if (facts.reservations)
    rows.push(
      <Row key="reservations" icon={<CalendarCheck size={size} />} label={t('Reservations')}>
        {facts.reservations}
      </Row>,
    );
  if (facts.accessibility)
    rows.push(
      <Row key="accessibility" icon={<Accessibility size={size} />} label={t('Accessibility')}>
        {facts.accessibility
          .split(', ')
          .map((item) => t(item))
          .join(', ')}
      </Row>,
    );
  if (facts.parking)
    rows.push(
      <Row key="parking" icon={<CircleParking size={size} />} label={t('Parking')}>
        {facts.parking}
      </Row>,
    );
  if (!hasHours(place, facts))
    rows.push(
      <Row key="hours-missing" icon={<Clock size={size} />} label={t('Opening hours')}>
        {t('Check with the venue for current hours')}
      </Row>,
    );
  return (
    <section aria-labelledby="practical-info" className="rounded-2xl bg-slate-50 p-4 sm:p-5">
      <h3 id="practical-info" className="mb-3 text-lg font-bold">
        {t('Practical information')}
      </h3>
      <dl className="grid gap-4 sm:grid-cols-2">{rows}</dl>
    </section>
  );
}
