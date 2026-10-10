/** Built-in ad / tracker hosts. Extra lists are merged by the server. */

export type BlockLevel = "off" | "standard" | "strict";

const ADS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "google-analytics.com",
  "googletagservices.com",
  "adservice.google.com",
  "pagead2.googlesyndication.com",
  "ads.twitter.com",
  "ads.yahoo.com",
  "amazon-adsystem.com",
  "adnxs.com",
  "adsrvr.org",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "criteo.com",
  "criteo.net",
  "taboola.com",
  "outbrain.com",
  "moatads.com",
  "scorecardresearch.com",
  "quantserve.com",
  "bluekai.com",
  "exelator.com",
  "demdex.net",
  "omtrdc.net",
  "everesttech.net",
  "krxd.net",
  "rlcdn.com",
  "liadm.com",
  "casalemedia.com",
  "smartadserver.com",
  "teads.tv",
  "sharethrough.com",
  "3lift.com",
  "media.net",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "adsterra.com",
  "mgid.com",
  "revcontent.com",
  "zedo.com",
  "serving-sys.com",
  "adform.net",
  "adroll.com",
  "bidswitch.net",
  "contextweb.com",
  "mathtag.com",
  "turn.com",
  "eyeota.net",
  "tapad.com",
  "agkn.com",
  "chartbeat.com",
  "newrelic.com",
  "hotjar.com",
  "hotjar.io",
  "mouseflow.com",
  "crazyegg.com",
  "fullstory.com",
  "mixpanel.com",
  "segment.io",
  "segment.com",
  "optimizely.com",
  "branch.io",
  "appsflyer.com",
  "adjust.com",
  "kochava.com",
  "imrworldwide.com",
  "imdbads.com",
];

const SOCIAL = [
  "connect.facebook.net",
  "facebook.net",
  "pixel.facebook.com",
  "analytics.tiktok.com",
  "ads.linkedin.com",
  "px.ads.linkedin.com",
  "static.ads-twitter.com",
  "analytics.twitter.com",
  "tr.snapchat.com",
  "sc-static.net",
  "bat.bing.com",
  "googletagmanager.com",
];

const BAD_PATH =
  /(\/(pagead|adservice|adserver|advert|doubleclick|googlesyndication)\/|\/ads\/|\/pixel\.gif|\/tracker\.js)/i;

function listed(host: string, domains: readonly string[]): boolean {
  for (const domain of domains) {
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

export function shouldBlock(
  hostname: string,
  pathAndQuery: string,
  level: BlockLevel,
  extra: ReadonlySet<string> | null,
  isDocument: boolean,
): boolean {
  if (level === "off") return false;
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (listed(host, ADS)) return true;
  if (extra && listed(host, [...extra])) return true;
  if (level === "strict" && listed(host, SOCIAL)) return true;
  if (!isDocument && BAD_PATH.test(pathAndQuery)) return true;
  return false;
}

export const BUILTIN_FILTER_COUNT = ADS.length + SOCIAL.length;
