package com.mvmsolo.mvmbrowser.cefriumproof

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Resolves the address field to an HTTP(S) URL or a DuckDuckGo search URL.
 * Arbitrary schemes (javascript:, data:, intent:, file:, etc.) are rejected.
 */
internal object BrowserUrlResolver {
    fun resolve(raw: String): String? {
        val value = raw.trim()
        if (value.isEmpty()) return null

        val candidate = when {
            value.startsWith("https://", ignoreCase = true) ||
                value.startsWith("http://", ignoreCase = true) -> value

            value.contains("://") -> return null

            looksLikeUnsupportedScheme(value) -> return null

            value.any(Char::isWhitespace) ->
                "https://duckduckgo.com/?q=" +
                    URLEncoder.encode(value, StandardCharsets.UTF_8)

            else -> "https://$value"
        }

        val uri = try {
            URI(candidate)
        } catch (_: Exception) {
            return null
        }

        val scheme = uri.scheme?.lowercase()
        val host = uri.host
        if (scheme !in setOf("http", "https") || host.isNullOrBlank()) return null
        if (uri.rawUserInfo != null || uri.port == 0 || uri.port > 65535) return null

        return uri.toASCIIString()
    }

    private fun looksLikeUnsupportedScheme(value: String): Boolean {
        val colon = value.indexOf(':')
        if (colon <= 0) return false

        val prefix = value.substring(0, colon)
        if (!prefix.matches(Regex("[A-Za-z][A-Za-z0-9+.-]*"))) return false

        // Keep common host:port inputs valid while rejecting non-web schemes.
        return !prefix.contains('.') && !prefix.equals("localhost", ignoreCase = true)
    }
}
