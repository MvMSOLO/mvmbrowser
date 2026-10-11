package com.mvmsolo.mvmbrowser

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalFilePolicyTest {
    @Test
    fun allowsBundledAssetSubpathsWithoutTraversal() {
        assertTrue(LocalFilePolicy.isAllowedBundledAssetPath("/android_asset/styles/home.css"))
        assertFalse(LocalFilePolicy.isAllowedBundledAssetPath("/android_asset/../data/private.xml"))
        assertFalse(LocalFilePolicy.isAllowedBundledAssetPath("/data/data/com.example/private.xml"))
        assertFalse(LocalFilePolicy.isAllowedBundledAssetPath("/android_asset/./secret.txt"))
    }

    @Test
    fun allowsExistingMhtmlInsideSavedDirectory() {
        val root = Files.createTempDirectory("mvm-offline").toFile()
        val archive = File(root, "example.com.mhtml").apply { writeText("archive") }

        assertTrue(LocalFilePolicy.isAllowedOfflineArchive(archive.absolutePath, root.absolutePath))
    }

    @Test
    fun rejectsFilesOutsideSavedDirectory() {
        val root = Files.createTempDirectory("mvm-offline").toFile()
        val elsewhere = Files.createTempFile("outside", ".mhtml").toFile()

        assertFalse(LocalFilePolicy.isAllowedOfflineArchive(elsewhere.absolutePath, root.absolutePath))
    }

    @Test
    fun rejectsPathTraversalIntoSiblingDirectory() {
        val parent = Files.createTempDirectory("mvm-parent").toFile()
        val root = File(parent, "offline-pages").apply { mkdirs() }
        val sibling = File(parent, "outside.mhtml").apply { writeText("not an archive") }

        assertFalse(LocalFilePolicy.isAllowedOfflineArchive(sibling.absolutePath, root.absolutePath))
        assertFalse(LocalFilePolicy.isAllowedOfflineArchive(File(root, "../outside.mhtml").path, root.absolutePath))
    }

    @Test
    fun rejectsNonMhtmlAndMissingFiles() {
        val root = Files.createTempDirectory("mvm-offline").toFile()
        val html = File(root, "page.html").apply { writeText("page") }
        val missing = File(root, "missing.mhtml")

        assertFalse(LocalFilePolicy.isAllowedOfflineArchive(html.absolutePath, root.absolutePath))
        assertFalse(LocalFilePolicy.isAllowedOfflineArchive(missing.absolutePath, root.absolutePath))
    }

    @Test
    fun rejectsSymlinkThatResolvesOutsideSavedDirectory() {
        val parent = Files.createTempDirectory("mvm-symlink").toFile()
        val root = File(parent, "offline-pages").apply { mkdirs() }
        val outside = File(parent, "outside.mhtml").apply { writeText("secret") }
        val link = File(root, "linked.mhtml")
        try {
            Files.createSymbolicLink(link.toPath(), outside.toPath())
        } catch (_: UnsupportedOperationException) {
            return
        } catch (_: SecurityException) {
            return
        }

        assertFalse(LocalFilePolicy.isAllowedOfflineArchive(link.absolutePath, root.absolutePath))
    }
}
