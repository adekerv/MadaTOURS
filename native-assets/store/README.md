# MadaTours release assets

The copy, icon and feature/share artwork are prepared in English and French. The original rust-and-white M icon and warm splash have been retained as the release design; `npm run mobile:assets` regenerates the existing platform sizes from `native-assets/*.svg`.

| Asset                        | File / dimensions                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Store text                   | `metadata.json` — name, subtitle, short/long descriptions, keywords, support and policy URLs |
| Google Play icon             | `icon-512.png`, 512 × 512                                                                    |
| iOS icon                     | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`, 1024 × 1024             |
| Google Play feature graphics | `feature-en.png`, `feature-fr.png`, 1024 × 500                                               |
| Social share images          | `public/og-image.png`, `public/og-image-fr.png`, 1200 × 630                                  |
| iPhone previews              | `screenshots/iphone/{en,fr}`, 1320 × 2868                                                    |
| iPad previews                | `screenshots/ipad/{en,fr}`, 2064 × 2752                                                      |
| Android previews             | `screenshots/android/{en,fr}`, 1080 × 1920                                                   |

Each locale/device has Discover, Place details and Day planner captures. These show the application UI and public catalogue, using WebKit/Chromium at device scale. They are **webview previews**, not captures from a signed native binary. Re-capture the signed build on supported devices before submission, especially native permission prompts, status bars and safe areas. Nothing has been uploaded to either store.

[Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) include the iPhone/iPad dimensions above. The metadata keeps Apple subtitles within 30 characters, keywords within 100 and Google Play short descriptions within 80. Confirm store settings and privacy declarations against the final shipped build.

Regenerate artwork with `npm run store:assets`. For screenshots, start the isolated Laravel preview (`node --import tsx tests/support/start-laravel.ts` after `npm run build:web`), then run `npm run store:screenshots` in another terminal. The capture script accepts only a local origin (`SCREENSHOT_ORIGIN`, default `http://127.0.0.1:3100`). It does not sign in, create public accounts or submit suggestions.

The feature/share artwork uses the public-domain Jardin de Balata photograph by Box-Off-Dreams, Julie, cropped for layout. Screenshot photographs retain their original credits: Habitation Clément by Jeremy Gross (CC BY-SA 3.0), Jardin de Balata (public domain), and Étang des Salines by Hervé NICOLAS (CC BY-SA 4.0). See [photo credits](../../public/photos/CREDITS.md), preserve attribution when distributing screenshots, and apply the relevant share-alike license to adapted photograph content.

The policy/support URLs assume the Laravel release is deployed at `https://mada-tours.vercel.app`; verify or update them before uploading. Actual release still needs SMTP, an owned bundle ID, developer signing, native binaries, device QA and store submission. See [the release pass](../../docs/UX-RELEASE-PASS.md).
