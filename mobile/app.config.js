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
module.exports = ({ config }) => ({
  ...config,
  runtimeVersion: process.env.WILLO_STORE_BUILD ? { policy: "appVersion" } : { policy: "sdkVersion" },
});
