# Google Account Linking Design

## Intent

Allow a signed-in password user to connect the Google identity that has the same verified email address, so later Google sign-in reaches the existing WordPress account instead of creating or silently merging identities.

## User Experience

- Only the owner of `/u/[username]` sees an **Hesap bağlantıları** card.
- A password account shows an explanation and the official Google Identity Services button.
- A Google-created or previously linked account shows **Google hesabı bağlı** and no action button.
- Successful linking updates the card without logging the user out or changing favorites, preferences, comments, username, or profile data.
- Failures are shown inside the card in Turkish. No unlink action is included in this version, because a Google-only account might otherwise lose its only usable sign-in method.

## Security Constraints

- Linking requires the existing httpOnly WordPress JWT session and a newly issued Google credential in the same request flow.
- Next.js verifies the Google credential server-side and sends the existing short-lived HMAC-signed assertion to WordPress.
- WordPress remains authoritative: it verifies the JWT again, requires the verified Google email to equal the signed-in user's email case-insensitively, and rejects a Google `sub` already owned by another user.
- A user already linked to another Google `sub` is rejected rather than overwritten.
- The existing `GOOGLE_AUTH_BRIDGE_SECRET`, Web Client ID, origins, JWT cookies, and Google metadata keys are reused. No new secret or Google Console setting is required.

## Architecture

`POST /api/auth/google/link` accepts the GIS credential, reads the current `auth_token` cookie, verifies the credential with `google-auth-library`, signs the normalized identity assertion, and forwards it with the JWT to `POST /wp-json/hizliulasim/v1/auth/google/link`. WordPress validates both trust boundaries before setting `_hizliulasim_google_sub` and the optional Google picture. `hizliulasim_format_user()` exposes only a `google_linked` boolean so the private `/auth/me` response and normal login responses can drive the profile UI without exposing the provider subject.

## Approaches

1. **Selected: authenticated signed bridge.** Reuses the current Google verification and WordPress JWT boundaries, performs the link where identity data already lives, and keeps the browser unaware of provider identifiers.
2. **Rejected: ask for the site password again after Google popup.** Adds password handling to a second UI and still needs the same authenticated CMS mutation.
3. **Rejected: store the link in Next.js only.** Splits identity from WordPress and would not let the current WordPress Google login resolve the account.

## Failure Behavior

Missing or expired site sessions return `401`. Malformed or unverifiable Google credentials fail before WordPress. Email mismatch, provider identity already in use, or an account already linked to a different Google identity return safe `409` messages. CMS/network/configuration failures do not change the account and return a generic temporary failure.

