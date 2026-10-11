package com.mvmsolo.mvmbrowser

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdBlockerTest {
    @Test
    fun blocksExactListedHost() {
        assertTrue(AdBlocker.shouldBlock("doubleclick.net"))
    }

    @Test
    fun blocksSubdomainsOfListedHost() {
        assertTrue(AdBlocker.shouldBlock("secure.adsrvr.org"))
    }

    @Test
    fun hostMatchingIsCaseInsensitiveAndIgnoresTrailingDot() {
        assertTrue(AdBlocker.shouldBlock("ADS.TABOOLA.COM."))
    }

    @Test
    fun blocksAdditionalTrackerHosts() {
        assertTrue(AdBlocker.shouldBlock("cdn.demdex.net"))
        assertTrue(AdBlocker.shouldBlock("ads.applovin.com"))
        assertTrue(AdBlocker.shouldBlock("agkn.com"))
    }

    @Test
    fun doesNotBlockLookalikeDomain() {
        assertFalse(AdBlocker.shouldBlock("doubleclick.net.example.org"))
    }

    @Test
    fun allowsUnlistedHostAndNull() {
        assertFalse(AdBlocker.shouldBlock("example.com"))
        assertFalse(AdBlocker.shouldBlock(null))
    }

    @Test
    fun allowsBlankHost() {
        assertFalse(AdBlocker.shouldBlock("  "))
    }
}
