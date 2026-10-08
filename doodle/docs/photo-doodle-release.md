# Photo input release notes

Status: implementation and verification in an isolated local branch. No production deployment or store submission authorized.

## Configuration cleanup

Removed three unreferenced paid image runners that required the retired Mini model: compare-render-quality, compare-detail-render-matrix and generate-showcase. Historical review builders and approved artwork remain as provenance. Local environment and its example now use Flare and MEDIUM. The new paid verification runner refuses other models before making a request. No credentials were changed. Historical rollback notes describe past deployments and are not current defaults.

## Data flow

One selected photo is normalized locally, maximum 600px edge and 512,000 bytes. Browser and Android output JPEG with transparency composited onto white. The iOS fallback preserves transparency in WebP until the server composites it. Source files are limited to 20 MB and 64 MP; browser non-JPEG and the iOS fallback have a tighter 24 MP bound because they can require full decoding. Android samples decoding with the existing Glide engine, applies camera orientation, and encodes its preview and payload once. Browser JPEG preparation requests a proportional, oriented thumbnail before canvas encoding. No crop or enlargement is applied.

Only Create sends the prepared image over HTTPS to Doodle and OpenAI Images edits. Server decoding independently validates actual JPEG/PNG/WebP content, limits pixels, rejects animated submitted images, re-encodes and strips metadata. Photos are not logged or stored in account records. Native integrity binds a domain-separated SHA-256 of the exact submitted payload and selected detail. Existing allowance, rate limit and credit hold/finalization apply.

The web keeps a temporary local draft for sign-in/checkout return, with a 30-minute expiration and cleanup on the next store access. Remove and a new doodle delete it. Android uses private cache and in-memory state. Abrupt process termination can leave an OS-managed cache file. Photo conversion uses the separately frozen v3 experiment prompts. Standard text prompt/generation source is unchanged.

## Before store release

Review the current Google Play Data safety answers against this final flow. Photos are optional user-provided input for app functionality, transmitted securely to a service provider and processed ephemerally on Doodle's server. Include provider retention accurately; do not claim zero retention. Update the existing Photos and videos / Photos declaration as applicable before publishing. No Data safety answers have been saved by this work.

The system picker does not require broad gallery access. CAMERA, RECORD_AUDIO, READ_MEDIA_IMAGES and READ_MEDIA_VISUAL_USER_SELECTED are blocked. Build a new Android binary to include expo-image-picker and the local doodle-photo module. Fixture builds simulate account/billing/generation and are unsuitable for Play integrity verification. A Play-installed real generation and independent release review remain release gates. HEIC/AVIF depend on installed device/browser codecs and are not universally supported. iOS preparation has unit coverage but no device verification in this change. See [photo preparation verification](qa/photo-preparation-2026-10-08/verification.md).

Authoritative references checked October 8, 2026: [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [Android photo picker](https://developer.android.com/training/data-storage/shared/photo-picker), [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
