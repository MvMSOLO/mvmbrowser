package com.mvmsolo.mvmbrowser.cefriumproof

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BrowserUrlResolverTest {
    @Test
    fun acceptsSecureAndExplicitHttpUrls() {
        assertEquals("https://example.com/path", BrowserUrlResolver.resolve("https://example.com/path"))
        assertEquals("http://example.com:8080/", BrowserUrlResolver.resolve("http://example.com:8080/"))
    }

    @Test
    fun addsHttpsToBareHosts() {
        assertEquals("https://example.com", BrowserUrlResolver.resolve("example.com"))
        assertEquals("https://example.com:8443", BrowserUrlResolver.resolve("example.com:8443"))
    }

    @Test
    fun treatsNaturalLanguageAsSearch() {
        assertEquals(
            "https://duckduckgo.com/?q=hello+world",
            BrowserUrlResolver.resolve("hello world")
        )
    }

    @Test
    fun rejectsBlankAndNonWebSchemes() {
        assertNull(BrowserUrlResolver.resolve(""))
        assertNull(BrowserUrlResolver.resolve("   "))
        assertNull(BrowserUrlResolver.resolve("javascript:alert(1)"))
        assertNull(BrowserUrlResolver.resolve("data:text/html,test"))
        assertNull(BrowserUrlResolver.resolve("intent://example.com"))
        assertNull(BrowserUrlResolver.resolve("file:///etc/passwd"))
        assertNull(BrowserUrlResolver.resolve("https://user:pass@example.com"))
    }

    @Test
    fun rejectsMalformedUrlsAndInvalidPorts() {
        assertNull(BrowserUrlResolver.resolve("https://"))
        assertNull(BrowserUrlResolver.resolve("https://example.com:99999"))
        assertNull(BrowserUrlResolver.resolve("https://example.com path"))
    }
}
