package com.mvmsolo.mvmbrowser

import java.util.Locale

/**
 * Small, offline host-based filter used by WebView's resource interception callback.
 * This is a starter list, not a full EasyList-compatible parser.
 */
internal object AdBlocker {
    private val blockedHosts: Set<String> = setOf(
        "ad.doubleclick.net",
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "googleads.g.doubleclick.net",
        "adservice.google.com",
        "adnxs.com",
        "adsrvr.org",
        "scorecardresearch.com",
        "taboola.com",
        "outbrain.com",
        "amazon-adsystem.com",
        "criteo.com",
        "pubmatic.com",
        "openx.net",
        "moatads.com",
        "advertising.com",
        "smartadserver.com",
        "casalemedia.com",
        "rubiconproject.com",
        "yieldmo.com",
        "33across.com",
        "bidswitch.net",
        "bluekai.com",
        "contextweb.com",
        "demdex.net",
        "eyeota.net",
        "agkn.com",
        "lijit.com",
        "sharethrough.com",
        "sovrn.com",
        "spotx.tv",
        "teads.tv",
        "undertone.com",
        "zemanta.com",
        "mgid.com",
        "revcontent.com",
        "inmobi.com",
        "applovin.com",
        "adjust.com",
        "appsflyer.com",
        "branch.io",
        "mixpanel.com",
        "amplitude.com"
    )

    fun shouldBlock(host: String?): Boolean {
        val normalized = host?.trim()?.trimEnd('.')?.lowercase(Locale.ROOT).orEmpty()
        if (normalized.isBlank()) return false
        return blockedHosts.any { blocked -> normalized == blocked || normalized.endsWith(".$blocked") }
    }
}
