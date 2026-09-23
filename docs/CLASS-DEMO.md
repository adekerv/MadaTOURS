# Demonstrate a real remote backend

Use the public Vercel website on a computer and a separate phone/browser. Do not use the test server on port 3100: it deliberately has a fake Auth provider.

1. Open `/api/health` on the deployed URL. Show `status: ok` and `database: supabase`.
2. Register an account with an inbox you own, receive its verification code, and enter it in the app.
3. Save Jardin de Balata as a favorite and add another place to the revisit list.
4. Open the website on the other device and sign in with the same account. The same saved places must load. This is the persistence demonstration; localStorage alone cannot produce this result across devices.
5. Sign in to a different account. It must not show the first account's saved places.
6. In Supabase Table Editor, show the corresponding `mt_saved_places` rows and UUID ownership. Keep keys, passwords and other users' information off the projected screen.
7. Remove a favorite, reload both devices and verify the removal persists.
8. Sign out, request a password recovery code, change the password and sign in with the new password. Confirm the old password is rejected.
9. Switch to French, make a day plan, change stop order, and reload. Explain that day plans are currently stored on that device.
10. Save a place while online, wait for the production app shell to cache, then disconnect and reload. Open **Offline copy**. Maps, weather and account changes need a connection.
11. Optionally use your admin account to add a clearly labeled demonstration place and delete it afterward. Check it appears in another browser's refreshed catalogue.
12. Delete your disposable test account using its password and check its saved rows are gone. Keep your real admin account.

Before class: check that Supabase is awake, email delivery works, Vercel is publicly accessible, and the deployed commit includes the latest code. Keep a screenshot of a successful cross-device demonstration as evidence, but do not substitute it for a working live application.
