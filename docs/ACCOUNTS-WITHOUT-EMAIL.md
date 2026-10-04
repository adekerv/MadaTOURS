# Accounts without email

MadaTours has no email provider, so nothing in the app sends mail. Accounts use Supabase Auth with email and
password (or Google), and a forgotten password is reset with a one-time recovery code instead of an email link.

## What you must set up in Supabase (once)

1. **Turn off email confirmation.** Dashboard → Authentication → Sign In / Providers
   ([direct link](https://supabase.com/dashboard/project/_/auth/providers), pick the project) → **Email** →
   switch **Confirm email** off and **Secure email change** off, then Save. With "Confirm email" on, nobody could
   finish signing up, because the confirmation mail can never arrive. As an alternative to the toggle,
   `npm run auth:signup -- --apply` turns off confirmation through the Management API (it needs
   `SUPABASE_ACCESS_TOKEN`); "Secure email change" is dashboard only.
2. **Apply the recovery SQL.** Dashboard → SQL Editor → paste `database/schema/recovery.sql` (also included in
   `supabase/setup.sql`) and run it. It adds the recovery code table, the functions the server uses to check and
   spend codes, and a trigger that clears an account's verified flag when its email address changes.
3. No SMTP settings are needed. Leave custom SMTP unset.

## How it works

- **Signup** signs the person in at once and returns eight codes, shown once in a window that stays open until
  they confirm the codes are saved (copy and download are offered). Only bcrypt hashes are stored.
- **Reset**: "Forgot password?" takes the email, one code and a new password. Each code works once (the database
  claims a code atomically), a failed password update gives the code back, and every session of the account is
  signed out after a reset. All failures read the same, so the screen never says whether an email exists.
- **Rate limit**: five reset attempts per email and `AUTH_ATTEMPTS_PER_IP` (default 30) per address, per 15 minutes.
  Refused attempts never reach the code check.
- **New codes**: Settings → Account recovery, with the current password. They replace the whole old set.
- **Email change**: Settings → Email address. The current password is the proof and the address changes at once.
  An unchecked address cannot count as verified, so a verified account loses that status (the database does this in
  the same step as the change).
- **Meet-ups** need a verified email. With no email, the only proof is Google's: an account that continues with
  Google using its address is verified. Password accounts see a notice that explains this. Note that continuing
  with Google on an account that has an unverified password replaces that password (a safety rule from the Google
  sign-in work), after which the person signs in with Google, and their recovery codes can set a password again.
- **Lost password and every code**: run `php artisan account:reset-password someone@example.com`
  (add `--new-codes` to also print a fresh set). It asks for the new password twice, replaces it and signs the
  account out everywhere. Check the person yourself first.

## Settings

| Variable               | Default | Meaning                                                                               |
| ---------------------- | ------- | ------------------------------------------------------------------------------------- |
| `AUTH_ATTEMPTS_PER_IP` | 30      | Sign-in, sign-up and recovery attempts allowed per address per 15 minutes (1 to 100). |
| `RECOVERY_CODE_COST`   | 10      | bcrypt cost for hashing recovery codes (4 to 14).                                     |

## Bringing email back later

The old email flows (confirmation codes, reset links) were removed from the app, and `scripts/configure-auth-email.ts`
(`npm run auth:configure`) still sets up SMTP and templates in Supabase. Restoring them is a code change, not a setting.
