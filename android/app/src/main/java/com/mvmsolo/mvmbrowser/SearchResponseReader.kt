package com.mvmsolo.mvmbrowser

import java.io.IOException
import java.io.Reader

/**
 * Reads text responses with a hard character ceiling to prevent a malformed or
 * unexpectedly large search page from consuming unbounded memory.
 */
internal object SearchResponseReader {
    fun readLimited(reader: Reader, maxChars: Int): String {
        require(maxChars >= 0) { "maxChars must not be negative" }

        val result = StringBuilder(minOf(maxChars, 8192))
        val buffer = CharArray(8192)

        while (true) {
            val count = reader.read(buffer)
            if (count < 0) break
            if (count == 0) continue

            if (count > maxChars - result.length) {
                throw IOException("Search response exceeds the $maxChars character limit.")
            }
            result.append(buffer, 0, count)
        }

        return result.toString()
    }
}
