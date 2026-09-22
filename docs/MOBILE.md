# Native mobile setup and release preparation

MadaTours now includes Capacitor projects in `ios/` and `android/`. They package `dist/web`; the Express API runs on a separately hosted HTTPS server. Server code, databases, and environment secrets are not copied into the native app.

## Build configuration

1. Install dependencies with `npm ci`.
2. Set `VITE_API_URL` to your real hosted API origin, without `/api` or a trailing slash. This is public build-time configuration. Changing it requires rebuilding and syncing the app.
3. Set the hosted API's `APP_ORIGIN` to its HTTPS origin. Add `capacitor://localhost,https://localhost` to `ALLOWED_ORIGINS` if the native client sends an origin header.
4. Run `npm run mobile:sync` after each web change.
5. Open the native project with `npm run mobile:ios` or `npm run mobile:android`.

The generated bundle ID is `com.madatours.app`, a development identifier with ownership not verified. Before signing, choose an identifier you own and update `capacitor.config.ts`/`CAPACITOR_APP_ID`, Xcode's bundle identifier, and Android's application ID, namespace, package directory, and strings together. `cap sync` alone does not rename an existing native project.

## Supported targets

- The iOS project targets **iOS 16.4+**, matching the modern CSS features used by Tailwind 4. It supports portrait, landscape, iPhone, and iPad layouts.
- The Android project targets SDK 36 and permits Android API 24+. Users need a current Android System WebView for the app's modern CSS/JavaScript.
- Browser layouts are checked at 320, 360, 390, 667, 768, 1024, and 1440 pixels. This is representative responsive coverage, not certification for every device.

[Capacitor 8's environment guide](https://capacitorjs.com/docs/getting-started/environment-setup) requires Node 22+, Xcode 26+, and Android Studio 2025.2.1+ for the respective native targets. iOS uses Swift Package Manager. This review machine has command-line tools but no selected full Xcode installation; no iOS binary or simulator build was produced.

## Native behavior implemented

- Location is requested only after a user taps **Use my location**. Manual map selection and browsing the whole island remain available.
- iOS usage descriptions are included. The additional Always-and-When-in-Use string is required by the plugin dependency; the app does not request background location or enable a background location mode. See the [Geolocation plugin](https://capacitorjs.com/docs/apis/geolocation).
- Android declares approximate location only; the app requests low-accuracy location and does not require GPS hardware. Android cloud backup is disabled for app-private state.
- Native API requests use [CapacitorHttp](https://capacitorjs.com/docs/apis/http), with explicit connection/read timeouts and platform-managed cookies. Session tokens are never placed in localStorage or Preferences. Validate cookie persistence, logout, and deletion on physical devices before release.
- Android Back closes the top dialog, returns exploration to the home screen, then minimizes the app from home.
- Dynamic viewport height, safe-area padding, 44-pixel controls, 16-pixel form fields, scrollable dialogs, focus trapping, focus restoration, reduced-motion support, and map resize observation are implemented.
- The initial catalogue is included in the app for a failed API request. This is **not** a complete offline map or offline account-sync feature. External map tiles, photos, and weather require connectivity.

## Release work still required

1. **Production service:** deploy the API and persistent database, run initialization, configure HTTPS/origins, and verify real-device sessions. Add email verification and password recovery before inviting the public.
2. **Content:** verify venue identities, coordinates, opening status, hours, ratings, and permissions to use photography. Supplied ratings have no review source, and the stock photos are illustrative. Add provenance and last-verified timestamps.
3. **Privacy and support:** publish a truthful privacy policy and support page with the operator's contact details. Document email, saved-place storage, session retention, location use, and requests to map/photo/weather providers. Complete App Store privacy disclosures and audit the built app's SDK privacy manifests.
4. **Store assets:** review the development app icon and launch artwork, produce final screenshots for supported devices, choose age/category settings, and write accurate store copy. Original development artwork is included in `native-assets/`; regenerate it with `npm run mobile:assets` after installing Playwright Chromium. Review it as part of your final brand design before submission.
5. **Distribution:** select the correct developer team and bundle ID, set signing and version/build numbers, configure App Store Connect, then test through TestFlight. The native projects have not been signed or uploaded.
6. **Device testing:** test a small iPhone, a large iPhone, an iPad in split view, a small Android phone, and an Android tablet. Cover portrait/landscape, the on-screen keyboard, text scaling, VoiceOver/TalkBack, location denied/approximate/granted, slow/offline networks, app suspension/resume, external directions, account deletion, and an API outage.
7. **Review readiness:** keep guest exploration accessible and verify the account deletion flow in the shipped build. Apple requires in-app deletion initiation for apps that create accounts; see [Apple's account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app). Assess whether the finished app offers sufficient native value under [App Review Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality). A wrapper alone does not guarantee approval.

## Useful next mobile features

A trip itinerary with saved day plans, native sharing, locally available saved places, and thoughtfully permissioned reminders would make this useful beyond the browser. Offline map downloads require a provider and license that permit them; do not bulk-download public OpenStreetMap tiles.
