package com.mvmsolo.mvmbrowser

import java.io.File
import java.io.IOException

/**
 * Allows a WebView to open only MHTML archives saved inside the app's private
 * offline-pages directory. Canonical paths prevent traversal and symlink escapes.
 */
internal object LocalFilePolicy {
    fun isAllowedBundledAssetPath(path: String): Boolean {
        if (!path.startsWith("/android_asset/")) return false
        return path.split('/').none { it == "." || it == ".." }
    }

    fun isAllowedOfflineArchive(filePath: String, savedDirectoryPath: String): Boolean {
        return try {
            val directory = File(savedDirectoryPath).canonicalFile
            val candidate = File(filePath).canonicalFile
            candidate.isFile &&
                candidate.extension.equals("mhtml", ignoreCase = true) &&
                candidate.path.startsWith(directory.path + File.separator)
        } catch (_: IOException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
}
