package com.mvmsolo.mvmbrowser

import java.io.IOException
import java.io.StringReader
import org.junit.Assert.assertEquals
import org.junit.Test

class SearchResponseReaderTest {
    @Test
    fun readsResponseWithinConfiguredLimit() {
        assertEquals("search results", SearchResponseReader.readLimited(StringReader("search results"), 14))
    }

    @Test
    fun acceptsResponseExactlyAtLimit() {
        assertEquals("12345", SearchResponseReader.readLimited(StringReader("12345"), 5))
    }

    @Test(expected = IOException::class)
    fun rejectsResponseAboveLimit() {
        SearchResponseReader.readLimited(StringReader("123456"), 5)
    }

    @Test
    fun permitsEmptyResponseWithZeroLimit() {
        assertEquals("", SearchResponseReader.readLimited(StringReader(""), 0))
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsNegativeLimit() {
        SearchResponseReader.readLimited(StringReader("abc"), -1)
    }
}
