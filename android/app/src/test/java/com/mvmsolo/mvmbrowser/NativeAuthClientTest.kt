package com.mvmsolo.mvmbrowser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NativeAuthClientTest {
    @Test
    fun acceptsHttpsOriginAndCanonicalizesIt() {
        assertEquals("https://example.com", NativeAuthClient.normalizeBaseUrl(" HTTPS://Example.COM/ "))
        assertEquals("https://example.com:8443", NativeAuthClient.normalizeBaseUrl("https://Example.com:8443"))
    }

    @Test
    fun rejectsInsecureOrNonOriginUrls() {
        assertNull(NativeAuthClient.normalizeBaseUrl("http://example.com"))
        assertNull(NativeAuthClient.normalizeBaseUrl("https://example.com/app"))
        assertNull(NativeAuthClient.normalizeBaseUrl("https://example.com/?x=1"))
        assertNull(NativeAuthClient.normalizeBaseUrl("https://user:pass@example.com"))
        assertNull(NativeAuthClient.normalizeBaseUrl("https://example.com/#fragment"))
        assertNull(NativeAuthClient.normalizeBaseUrl("not a url"))
    }
}
