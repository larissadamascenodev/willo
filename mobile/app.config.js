/**
 * app.json, with one thing decided at build time: which runtime an update belongs to.
 *
 * An update published for testing is opened in Expo Go, which only accepts one that
 * names Expo Go's own runtime — the SDK's — so that is what `eas update` stamps on
 * it. A build made for the stores is different: its native code is its own, and an
 * update must only reach a build it can run on, which is what the app version
 * answers. The build profiles in eas.json set WILLO_STORE_BUILD, and EAS applies it both
 * on this machine and on its servers — EAS_BUILD is only set on the servers, so the two
 * worked out different runtimes and the first build stopped on the mismatch.
 */
/**
 * The store builds' runtime, named outright rather than taken from the app version: 1.0.0
 * was approved and 1.0.1 only changes the launch screen (an image), so both run the same
 * native code and one update must reach both. Raise this — and make a new build — only when
 * the native side changes (a new native module, a new permission, a plugin), never for a
 * version bump alone.
 */
const STORE_RUNTIME = "1.0.0";

module.exports = ({ config }) => ({
  ...config,
  runtimeVersion: process.env.WILLO_STORE_BUILD ? STORE_RUNTIME : { policy: "sdkVersion" },
});
