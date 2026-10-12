package com.mvmsolo.mvmbrowser

import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.os.Environment
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebStorage
import android.net.http.SslError
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private const val HOME_ASSET_URL = "file:///android_asset/home.html"
private const val MAX_SEARCH_RESPONSE_CHARS = 1_500_000

class MainActivity : Activity() {
    private val bg = Color.rgb(7, 10, 16)
    private val panel = Color.rgb(13, 20, 32)
    private val cyan = Color.rgb(69, 230, 255)
    private val textColor = Color.rgb(237, 250, 255)
    private val muted = Color.rgb(146, 165, 183)
    private lateinit var root: LinearLayout
    private lateinit var address: EditText
    private lateinit var progress: ProgressBar
    private lateinit var webHost: FrameLayout
    private lateinit var tabsButton: TextView
    private lateinit var adBlockButton: TextView
    @Volatile private var adBlockingEnabled = true
    private val tabs = mutableListOf<BrowserTab>()
    private var activeIndex = 0
    private val prefs by lazy { getSharedPreferences("mvm-browser", Context.MODE_PRIVATE) }
    private val savedDir by lazy { File(filesDir, "offline-pages").apply { mkdirs() } }

    private data class BrowserTab(
        val id: String = UUID.randomUUID().toString(),
        val web: WebView,
        var title: String = "New tab",
        var url: String = HOME_ASSET_URL
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        adBlockingEnabled = prefs.getBoolean("ad_blocking_enabled", true)
        buildUi()
        newTab()
    }

    private fun buildUi() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
            setPadding(dp(10), dp(8), dp(10), dp(4))
        }
        val brandRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(3), dp(2), dp(3), dp(8))
        }
        val logo = label("M", 19f, cyan, true).apply {
            gravity = Gravity.CENTER
            background = rounded(cyan, 0x202DEBFF, 14)
            layoutParams = LinearLayout.LayoutParams(dp(38), dp(38))
        }
        val title = label("MVM BROWSER", 14f, textColor, true).apply {
            letterSpacing = .12f
            setPadding(dp(11), 0, 0, 0)
        }
        val spacer = View(this)
        val backButton = action("‹") { goBack() }.apply { textSize = 24f; setPadding(dp(11), dp(3), dp(11), dp(3)) }
        val homeButton = action("⌂") { home() }.apply { textSize = 19f; setPadding(dp(10), dp(6), dp(10), dp(6)) }
        adBlockButton = action(if (adBlockingEnabled) "SHIELD ON" else "SHIELD OFF") { toggleAdBlocking() }.apply { textSize = 9f }
        tabsButton = action("TABS 1") { showTabs() }.apply { textSize = 10f }
        brandRow.addView(logo)
        brandRow.addView(title)
        brandRow.addView(spacer, LinearLayout.LayoutParams(0, 1, 1f))
        brandRow.addView(backButton)
        brandRow.addView(homeButton)
        brandRow.addView(adBlockButton)
        brandRow.addView(tabsButton)
        root.addView(brandRow)

        val addressRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(panel, 0xFF1B2C3B.toInt(), 17)
            setPadding(dp(10), dp(3), dp(4), dp(3))
        }
        address = EditText(this).apply {
            setSingleLine(true)
            textSize = 14f
            setTextColor(textColor)
            setHintTextColor(muted)
            hint = "Search or enter address"
            setPadding(dp(5), 0, dp(4), 0)
            background = null
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            setSelectAllOnFocus(true)
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                    navigateFromAddress()
                    true
                } else false
            }
            layoutParams = LinearLayout.LayoutParams(0, dp(44), 1f)
        }
        val go = action("GO") { navigateFromAddress() }
        addressRow.addView(address)
        addressRow.addView(go)
        root.addView(addressRow)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(cyan)
            indeterminateTintList = android.content.res.ColorStateList.valueOf(cyan)
            visibility = View.GONE
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(2)))
        webHost = FrameLayout(this)
        root.addView(webHost, LinearLayout.LayoutParams(-1, 0, 1f))

        setContentView(root)
    }

    private fun newTab(url: String = HOME_ASSET_URL) {
        val web = WebView(this)
        configure(web)
        val tab = BrowserTab(web = web, url = url)
        tabs.add(tab)
        activate(tabs.lastIndex)
        web.loadUrl(url)
        updateTabButton()
    }

    @Suppress("SetJavaScriptEnabled")
    private fun configure(web: WebView) {
        web.setBackgroundColor(bg)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            // Needed only for app-private MHTML archives; file-to-file and file-to-network
            // universal access remain disabled below.
            allowFileAccess = true
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            builtInZoomControls = true
            displayZoomControls = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) safeBrowsingEnabled = true
            userAgentString = userAgentString
        }
        CookieManager.getInstance().setAcceptCookie(true)
        // The native bridge is attached only after navigation reaches the bundled home page.
        // Never expose it during the initial setup of a WebView that may load a remote URL.
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): android.webkit.WebResourceResponse? {
                // Enforce local-file policy for main-frame and subresource requests before ad filtering.
                // This callback must remain fast and must not perform network I/O.
                val uri = request.url
                val scheme = uri.scheme?.lowercase()
                if (scheme == "file") {
                    val allowedLocalFile = if (request.isForMainFrame) {
                        isAllowedLocalFileUrl(uri)
                    } else {
                        isAllowedLocalFileResource(uri)
                    }
                    if (!allowedLocalFile) {
                        return android.webkit.WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            403,
                            "Forbidden",
                            emptyMap(),
                            java.io.ByteArrayInputStream(ByteArray(0))
                        )
                    }
                }

                if (!adBlockingEnabled || request.isForMainFrame) return null
                if (scheme != "http" && scheme != "https") return null
                if (!AdBlocker.shouldBlock(uri.host)) return null
                return android.webkit.WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    204,
                    "No Content",
                    emptyMap(),
                    java.io.ByteArrayInputStream(ByteArray(0))
                )
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val scheme = uri.scheme?.lowercase()
                if (scheme == "http" || scheme == "https" || scheme == "about") return false
                if (scheme == "file") return !isAllowedLocalFileUrl(uri)
                return true
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (isBundledHomeUrl(url)) {
                    view.addJavascriptInterface(BrowserBridge(view), "BrowserBridge")
                } else {
                    view.removeJavascriptInterface("BrowserBridge")
                }
                tabFor(view)?.url = url
                if (isActiveWeb(view)) {
                    progress.visibility = View.VISIBLE
                    progress.progress = 4
                    address.setText(if (isBundledHomeUrl(url)) "" else url)
                }
            }
            override fun onPageFinished(view: WebView, url: String) {
                tabFor(view)?.apply { this.url = url; title = view.title ?: url }
                if (isActiveWeb(view)) {
                    progress.visibility = View.GONE
                    address.setText(if (isBundledHomeUrl(url)) "" else url)
                }
                updateTabButton()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && isActiveWeb(view)) {
                    toast("Page unavailable. Check connection or open a saved page.")
                }
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                if (isActiveWeb(view)) toast("Secure connection rejected")
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                if (isActiveWeb(view)) {
                    progress.progress = newProgress
                    progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                }
            }
            override fun onReceivedTitle(view: WebView, title: String?) {
                tabFor(view)?.title = title?.take(80) ?: "New tab"
            }
        }

        // Handle file downloads explicitly; WebView does not download files by itself.
        web.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val uri = Uri.parse(url)
                if (uri.scheme != "https" && uri.scheme != "http") {
                    toast("Only web downloads are supported")
                    return@setDownloadListener
                }
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    .replace(Regex("[\\\\/:*?\"<>|]"), "_")
                    .take(180)
                    .ifBlank { "download" }
                val request = DownloadManager.Request(uri).apply {
                    setTitle(fileName)
                    setDescription("Downloading with MVM Browser")
                    setMimeType(mimeType)
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalFilesDir(
                        this@MainActivity,
                        Environment.DIRECTORY_DOWNLOADS,
                        fileName
                    )
                    addRequestHeader("User-Agent", userAgent ?: web.settings.userAgentString)
                    CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                    setAllowedOverMetered(true)
                    setAllowedOverRoaming(false)
                }
                val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                manager.enqueue(request)
                toast("Download started: $fileName")
            } catch (_: Exception) {
                toast("Could not start download")
            }
        }
    }

    private fun toggleAdBlocking() {
        adBlockingEnabled = !adBlockingEnabled
        prefs.edit().putBoolean("ad_blocking_enabled", adBlockingEnabled).apply()
        adBlockButton.text = if (adBlockingEnabled) "SHIELD ON" else "SHIELD OFF"
        toast(if (adBlockingEnabled) "Ad and tracker filtering enabled" else "Ad and tracker filtering paused")
        active()?.web?.reload()
    }

    private fun tabFor(web: WebView): BrowserTab? = tabs.firstOrNull { it.web === web }

    private fun isActiveWeb(web: WebView): Boolean = active()?.web === web

    private fun activate(index: Int) {
        if (tabs.isEmpty()) return
        activeIndex = index.coerceIn(0, tabs.lastIndex)
        webHost.removeAllViews()
        val web = tabs[activeIndex].web
        (web.parent as? ViewGroup)?.removeView(web)
        webHost.addView(web, FrameLayout.LayoutParams(-1, -1))
        progress.visibility = View.GONE
        address.setText(if (isBundledHomeUrl(tabs[activeIndex].url)) "" else tabs[activeIndex].url)
        updateTabButton()
    }

    private fun active(): BrowserTab? = tabs.getOrNull(activeIndex)

    private fun navigateFromAddress() {
        val raw = address.text.toString().trim()
        if (raw.isBlank()) { home(); return }
        val target = when {
            raw.startsWith("http://", true) || raw.startsWith("https://", true) -> raw
            raw.startsWith("file://", true) -> raw
            raw.contains(" ") || !raw.contains(".") -> "https://www.google.com/search?q=" + URLEncoder.encode(raw, "UTF-8")
            else -> "https://$raw"
        }
        try {
            val uri = Uri.parse(target)
            val allowed = when (uri.scheme?.lowercase()) {
                "https", "http" -> true
                "file" -> isAllowedLocalFileUrl(uri)
                else -> false
            }
            if (allowed) {
                active()?.web?.loadUrl(target)
                (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(address.windowToken, 0)
                address.clearFocus()
            } else {
                toast("Only web URLs and saved offline pages are supported")
            }
        } catch (_: Exception) {
            toast("Invalid address")
        }
    }

    private fun isAllowedLocalFileUrl(uri: Uri): Boolean {
        if (uri.scheme?.lowercase() != "file" || !uri.authority.isNullOrEmpty()) return false
        val normalizedUrl = uri.toString().substringBefore('#').substringBefore('?')
        if (normalizedUrl == HOME_ASSET_URL) return true
        val path = uri.path ?: return false
        return LocalFilePolicy.isAllowedOfflineArchive(path, savedDir.absolutePath)
    }

    private fun isAllowedLocalFileResource(uri: Uri): Boolean {
        if (uri.scheme?.lowercase() != "file" || !uri.authority.isNullOrEmpty()) return false
        val path = uri.path ?: return false
        // Saved MHTML pages are allowed only as top-level navigations. A remote page
        // must not be able to embed a private offline archive as a file subresource.
        return LocalFilePolicy.isAllowedBundledAssetPath(path)
    }

    private fun isBundledHomeUrl(url: String): Boolean {
        return url.substringBefore('#').substringBefore('?') == HOME_ASSET_URL
    }

    private fun home(targetWeb: WebView? = active()?.web) {
        targetWeb?.loadUrl(HOME_ASSET_URL)
    }

    private fun goBack(targetWeb: WebView? = active()?.web) {
        val web = targetWeb ?: return
        if (web.canGoBack()) web.goBack() else home(web)
    }

    private fun goForward(targetWeb: WebView? = active()?.web) {
        val web = targetWeb ?: return
        if (web.canGoForward()) web.goForward() else toast("No forward page")
    }
    override fun onBackPressed() {
        val web = active()?.web
        if (web != null && web.canGoBack()) web.goBack() else if (tabs.size > 1) closeActiveTab() else super.onBackPressed()
    }

    private fun toggleBookmark(targetWeb: WebView? = active()?.web) {
        val tab = targetWeb?.let { tabFor(it) } ?: return
        val url = tab.url
        if (isBundledHomeUrl(url)) { toast("Open a website first"); return }
        val key = "bookmarks"
        val items = prefs.getStringSet(key, emptySet())?.toMutableSet() ?: mutableSetOf()
        if (items.remove(url)) toast("Bookmark removed") else { items.add(url); toast("Bookmark saved") }
        prefs.edit().putStringSet(key, items).apply()
    }

    private fun saveOffline(targetWeb: WebView? = active()?.web) {
        val tab = targetWeb?.let { tabFor(it) } ?: return
        if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
            toast("Open a web page first"); return
        }
        val safeName = (Uri.parse(tab.url).host ?: "page").replace(Regex("[^A-Za-z0-9._-]"), "_")
        val file = File(savedDir, "${safeName}_${System.currentTimeMillis()}.mhtml")
        toast("Saving offline copy…")
        tab.web.saveWebArchive(file.absolutePath, false) { path ->
            runOnUiThread {
                if (path != null && File(path).exists()) {
                    val items = prefs.getStringSet("offline-pages", emptySet())?.toMutableSet() ?: mutableSetOf()
                    items.add(path)
                    prefs.edit().putStringSet("offline-pages", items).apply()
                    toast("Saved for offline reading")
                } else toast("Could not save this page")
            }
        }
    }

    private fun showTabs() {
        val options = mutableListOf<String>()
        tabs.forEachIndexed { index, tab -> options.add("${if (index == activeIndex) "● " else ""}${tab.title.ifBlank { "New tab" }}\n${tab.url}") }
        options.add("+  New tab")
        options.add("★  Bookmarks")
        options.add("↓  Offline pages")
        options.add("◷  History")
        options.add("♧  Clear browsing data")
        options.add("♙  Profile & Memory")
        options.add("◉  Sign in / Account")
        AlertDialog.Builder(this).setTitle("Tabs & library").setItems(options.toTypedArray()) { _, which ->
            when {
                which < tabs.size -> activate(which)
                which == tabs.size -> newTab()
                which == tabs.size + 1 -> showSavedList("bookmarks", "Bookmarks", false)
                which == tabs.size + 2 -> showSavedList("offline-pages", "Offline pages", true)
                which == tabs.size + 3 -> showHistory()
                which == tabs.size + 4 -> showClearDataDialog()
                which == tabs.size + 5 -> showProfileMemoryDialog()
                else -> showAccountDialog()
            }
        }.setNegativeButton("Close current tab") { _, _ -> closeActiveTab() }
            .setNeutralButton("Clear history") { _, _ -> prefs.edit().remove("history").apply(); toast("History cleared") }
            .show()
    }

    /**
     * Device-local identity and personal note. This is deliberately not called
     * an account login: the native APK has no configured auth API/OAuth redirect
     * and must not pretend local fields authenticate a server account.
     */
    private fun showProfileMemoryDialog() {
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(4), dp(20), 0)
        }
        val profileLabel = label("DEVICE PROFILE · LOCAL ONLY", 11f, cyan, true).apply {
            setPadding(0, dp(3), 0, dp(8))
        }
        val explanation = label(
            "Profile details and this note stay in the app's storage on this device. Sign-in, AI memory and cloud sync are not connected in this APK. Do not save passwords or secret keys here.",
            12f,
            muted,
            false
        ).apply {
            setLineSpacing(dp(2).toFloat(), 1f)
            setPadding(0, 0, 0, dp(10))
        }
        val nameField = EditText(this).apply {
            hint = "Display name"
            setTextColor(textColor)
            setHintTextColor(muted)
            setSingleLine(true)
            setText(prefs.getString("profile_name", ""))
        }
        val emailField = EditText(this).apply {
            hint = "Email (optional)"
            setTextColor(textColor)
            setHintTextColor(muted)
            setSingleLine(true)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setText(prefs.getString("profile_email", ""))
        }
        val memoryField = EditText(this).apply {
            hint = "Personal note / preferences"
            setTextColor(textColor)
            setHintTextColor(muted)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            gravity = Gravity.TOP
            minLines = 3
            maxLines = 6
            setHorizontallyScrolling(false)
            setText(prefs.getString("profile_memory", ""))
        }
        form.addView(profileLabel)
        form.addView(explanation)
        form.addView(nameField, LinearLayout.LayoutParams(-1, dp(48)))
        form.addView(emailField, LinearLayout.LayoutParams(-1, dp(48)))
        form.addView(memoryField, LinearLayout.LayoutParams(-1, dp(124)))

        AlertDialog.Builder(this)
            .setTitle("Profile & Memory")
            .setView(form)
            .setPositiveButton("Save") { _, _ ->
                prefs.edit()
                    .putString("profile_name", nameField.text.toString().trim().take(80))
                    .putString("profile_email", emailField.text.toString().trim().take(254))
                    .putString("profile_memory", memoryField.text.toString().trim().take(2000))
                    .apply()
                toast("Profile and note saved on this device")
            }
            .setNeutralButton("Clear memory") { _, _ ->
                AlertDialog.Builder(this)
                    .setTitle("Clear personal memory?")
                    .setMessage("This permanently removes the saved personal note from this device.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Clear") { _, _ ->
                        prefs.edit().remove("profile_memory").apply()
                        toast("Personal memory cleared")
                    }
                    .show()
            }
            .setNegativeButton("Close", null)
            .show()
    }

    /**
     * Native account UI backed by this repository's Better Auth HTTP API.
     * The deployment origin is configurable because this repository has no
     * production domain. Passwords are not persisted in preferences.
     */
    private fun showAccountDialog() {
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(4), dp(20), 0)
        }
        fun authField(hintText: String, value: String = "", kind: Int = android.text.InputType.TYPE_CLASS_TEXT): EditText {
            return EditText(this).apply {
                hint = hintText
                setTextColor(textColor)
                setHintTextColor(muted)
                inputType = kind
                setSingleLine(true)
                setText(value)
            }
        }

        val serverField = authField("HTTPS origin of deployed MVM auth app", prefs.getString("auth_base_url", "") ?: "")
        val nameField = authField("Display name (for account creation)", prefs.getString("profile_name", "") ?: "")
        val emailField = authField("Email address", prefs.getString("profile_email", "") ?: "",
            android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val passwordField = authField("Password (never saved)", "",
            android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD)
        val status = label(
            "Use only your own deployed MVM HTTPS auth server with /api/auth/*. No production server URL is configured in this build.",
            12f, muted, false
        ).apply {
            setLineSpacing(dp(2).toFloat(), 1f)
            setPadding(0, dp(8), 0, dp(10))
        }
        val signOutButton = action("SIGN OUT") { }.apply { textSize = 11f }
        form.addView(label("ACCOUNT · BETTER AUTH", 11f, cyan, true).apply { setPadding(0, dp(3), 0, dp(8)) })
        form.addView(serverField, LinearLayout.LayoutParams(-1, dp(52)))
        form.addView(nameField, LinearLayout.LayoutParams(-1, dp(52)))
        form.addView(emailField, LinearLayout.LayoutParams(-1, dp(52)))
        form.addView(passwordField, LinearLayout.LayoutParams(-1, dp(52)))
        form.addView(status, LinearLayout.LayoutParams(-1, -2))
        form.addView(signOutButton, LinearLayout.LayoutParams(-1, dp(44)))

        val dialog = AlertDialog.Builder(this)
            .setTitle("Sign in / Create account")
            .setView(form)
            .setPositiveButton("Sign in", null)
            .setNeutralButton("Create account", null)
            .setNegativeButton("Close", null)
            .create()
        dialog.show()

        fun showResult(result: NativeAuthClient.AuthResult) {
            status.text = result.message.take(350)
            status.setTextColor(if (result.ok) cyan else 0xFFFF8C9E.toInt())
            if (result.signedIn && result.user != null) {
                val user = result.user
                prefs.edit()
                    .putString("profile_name", user.name.ifBlank { nameField.text.toString().trim() }.take(80))
                    .putString("profile_email", user.email.ifBlank { emailField.text.toString().trim() }.take(254))
                    .apply()
                nameField.setText(user.name)
                emailField.setText(user.email)
                passwordField.text.clear()
            }
        }

        fun runAuth(createAccount: Boolean) {
            val origin = NativeAuthClient.normalizeBaseUrl(serverField.text.toString())
            if (origin == null) {
                status.text = "Enter a valid HTTPS origin only. Do not enter a path, credentials, or query string."
                status.setTextColor(0xFFFF8C9E.toInt())
                return
            }
            val emailValue = emailField.text.toString().trim()
            val passwordValue = passwordField.text.toString()
            val nameValue = nameField.text.toString().trim()
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(emailValue).matches()) {
                status.text = "Enter a valid email address."
                status.setTextColor(0xFFFF8C9E.toInt())
                return
            }
            if (passwordValue.length < 8 || passwordValue.length > 128) {
                status.text = "Password must contain 8–128 characters."
                status.setTextColor(0xFFFF8C9E.toInt())
                return
            }
            if (createAccount && nameValue.length !in 2..80) {
                status.text = "Display name must contain 2–80 characters."
                status.setTextColor(0xFFFF8C9E.toInt())
                return
            }
            prefs.edit().putString("auth_base_url", origin).apply()
            val loginButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            val createButton = dialog.getButton(AlertDialog.BUTTON_NEUTRAL)
            loginButton.isEnabled = false
            createButton.isEnabled = false
            status.text = if (createAccount) "Creating account securely…" else "Signing in securely…"
            status.setTextColor(muted)
            Thread {
                val result = if (createAccount) {
                    NativeAuthClient.signUp(origin, nameValue, emailValue, passwordValue)
                } else {
                    NativeAuthClient.signIn(origin, emailValue, passwordValue)
                }
                runOnUiThread {
                    loginButton.isEnabled = true
                    createButton.isEnabled = true
                    showResult(result)
                }
            }.start()
        }

        signOutButton.setOnClickListener {
            val origin = NativeAuthClient.normalizeBaseUrl(serverField.text.toString())
            if (origin == null) {
                status.text = "Enter the same HTTPS auth server used to sign in."
                status.setTextColor(0xFFFF8C9E.toInt())
                return@setOnClickListener
            }
            signOutButton.isEnabled = false
            status.text = "Signing out…"
            Thread {
                val result = NativeAuthClient.signOut(origin)
                runOnUiThread {
                    signOutButton.isEnabled = true
                    showResult(result)
                }
            }.start()
        }
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener { runAuth(false) }
        dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener { runAuth(true) }
        val initialOrigin = NativeAuthClient.normalizeBaseUrl(serverField.text.toString())
        if (initialOrigin != null) {
            status.text = "Checking account session…"
            Thread {
                val result = NativeAuthClient.getSession(initialOrigin)
                runOnUiThread { showResult(result) }
            }.start()
        }
    }

    private fun showSavedList(key: String, title: String, offline: Boolean) {
        val items = (prefs.getStringSet(key, emptySet()) ?: emptySet()).toList().sorted()
        if (items.isEmpty()) { toast("Nothing saved yet"); return }
        AlertDialog.Builder(this).setTitle(title).setItems(items.map { if (offline) File(it).name else it }.toTypedArray()) { _, which ->
            val item = items[which]
            if (offline) {
                if (!LocalFilePolicy.isAllowedOfflineArchive(item, savedDir.absolutePath)) {
                    toast("Saved page is unavailable or outside offline storage")
                } else {
                    active()?.web?.loadUrl(Uri.fromFile(File(item)).toString())
                }
            } else {
                if (tabs.size > 1) newTab(item) else active()?.web?.loadUrl(item)
            }
        }.setNegativeButton("Close", null).show()
    }

    private fun showHistory() {
        val items = (prefs.getStringSet("history", emptySet()) ?: emptySet()).toList().sortedDescending().take(100)
        if (items.isEmpty()) { toast("No history yet"); return }
        AlertDialog.Builder(this).setTitle("Recent history").setItems(items.toTypedArray()) { _, which ->
            val url = items[which].substringAfter("|", items[which])
            if (tabs.size > 1) newTab(url) else active()?.web?.loadUrl(url)
        }.setNegativeButton("Close", null).show()
    }

    private fun showClearDataDialog() {
        AlertDialog.Builder(this)
            .setTitle("Clear browsing data?")
            .setMessage("This clears browsing history, cookies, cached files, and website storage across open tabs. Bookmarks and saved offline pages will remain.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Clear data") { _, _ ->
                prefs.edit().remove("history").apply()
                tabs.forEach { tab ->
                    tab.web.clearHistory()
                    tab.web.clearCache(true)
                    tab.web.clearFormData()
                }
                WebStorage.getInstance().deleteAllData()
                CookieManager.getInstance().removeAllCookies {
                    CookieManager.getInstance().flush()
                }
                toast("Browsing data cleared")
            }
            .show()
    }

    private fun closeActiveTab() {
        if (tabs.isEmpty()) return
        val old = tabs.removeAt(activeIndex)
        webHost.removeView(old.web)
        old.web.stopLoading()
        old.web.destroy()
        if (tabs.isEmpty()) newTab() else activate((activeIndex - 1).coerceAtLeast(0))
        updateTabButton()
    }

    private fun updateTabButton() { if (::tabsButton.isInitialized) tabsButton.text = "TABS ${tabs.size}" }

    inner class BrowserBridge(private val sourceWeb: WebView) {
        // Bridge actions are always scoped to the WebView that owns this bridge,
        // never to whichever tab happens to be active when an async callback fires.
        @android.webkit.JavascriptInterface fun back() { runOnUiThread { if (tabFor(sourceWeb) != null) goBack(sourceWeb) } }
        @android.webkit.JavascriptInterface fun forward() { runOnUiThread { if (tabFor(sourceWeb) != null) goForward(sourceWeb) } }
        @android.webkit.JavascriptInterface fun home() { runOnUiThread { if (tabFor(sourceWeb) != null) this@MainActivity.home(sourceWeb) } }
        @android.webkit.JavascriptInterface fun bookmark() { runOnUiThread { toggleBookmark(sourceWeb) } }
        @android.webkit.JavascriptInterface fun saveOffline() { runOnUiThread { this@MainActivity.saveOffline(sourceWeb) } }
        @android.webkit.JavascriptInterface fun profileMemory() {
            runOnUiThread {
                if (tabFor(sourceWeb) != null && isBundledHomeUrl(sourceWeb.url.orEmpty())) {
                    showProfileMemoryDialog()
                }
            }
        }
        @android.webkit.JavascriptInterface fun newTab() { runOnUiThread { this@MainActivity.newTab() } }
        @android.webkit.JavascriptInterface fun openUrl(rawUrl: String) {
            runOnUiThread {
                val uri = runCatching { Uri.parse(rawUrl) }.getOrNull()
                if (uri != null && (uri.scheme == "https" || uri.scheme == "http") && tabFor(sourceWeb) != null) {
                    sourceWeb.loadUrl(uri.toString())
                } else toast("Unsupported result link")
            }
        }
        @android.webkit.JavascriptInterface fun search(rawQuery: String) {
            val query = rawQuery.trim().take(240)
            if (query.isBlank()) return
            runOnUiThread {
                if (tabFor(sourceWeb) != null) {
                    sourceWeb.evaluateJavascript("window.showSearchLoading && window.showSearchLoading(" + JSONObject.quote(query) + ")", null)
                }
            }
            Thread {
                val items = JSONArray()
                var failed = false
                var connection: HttpURLConnection? = null
                try {
                    val endpoint = "https://html.duckduckgo.com/html/?q=" + URLEncoder.encode(query, "UTF-8")
                    val requestConnection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 9000
                        readTimeout = 9000
                        setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36")
                        setRequestProperty("Accept-Language", "en-US,en;q=0.9")
                    }
                    connection = requestConnection
                    val html = requestConnection.inputStream.bufferedReader(Charsets.UTF_8).use {
                        SearchResponseReader.readLimited(it, MAX_SEARCH_RESPONSE_CHARS)
                    }
                    val anchors = Regex("(?is)<a[^>]*class=[\"'][^\"']*result__a[^\"']*[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>").findAll(html).toList()
                    val snippets = Regex("(?is)class=[\"'][^\"']*result__snippet[^\"']*[\"'][^>]*>(.*?)</(?:a|div)>").findAll(html).map { cleanSearchText(it.groupValues[1]) }.toList()
                    anchors.take(10).forEachIndexed { index, match ->
                        var resultUrl = decodeHtml(match.groupValues[1])
                        if (resultUrl.startsWith("//")) resultUrl = "https:$resultUrl"
                        if (resultUrl.startsWith("/l/")) resultUrl = "https://duckduckgo.com$resultUrl"
                        val parsed = Uri.parse(resultUrl)
                        if (parsed.path.orEmpty().startsWith("/l/")) {
                            resultUrl = parsed.getQueryParameter("uddg") ?: resultUrl
                        }
                        if (resultUrl.startsWith("http://") || resultUrl.startsWith("https://")) {
                            val item = JSONObject()
                            item.put("url", resultUrl)
                            item.put("displayUrl", Uri.parse(resultUrl).host ?: resultUrl)
                            item.put("title", cleanSearchText(match.groupValues[2]).take(180))
                            item.put("snippet", snippets.getOrNull(index).orEmpty().take(500))
                            items.put(item)
                        }
                    }
                    if (items.length() == 0) failed = true
                } catch (_: Exception) {
                    failed = true
                } finally {
                    connection?.disconnect()
                }
                runOnUiThread {
                    if (tabFor(sourceWeb) != null) {
                        sourceWeb.evaluateJavascript(
                            "window.renderSearchResults && window.renderSearchResults(" + items.toString() + "," + JSONObject.quote(query) + "," + failed + ")",
                            null
                        )
                    }
                }
            }.start()
        }
    }

    private fun cleanSearchText(raw: String): String {
        return decodeHtml(raw.replace(Regex("(?is)<[^>]+>"), " "))
            .replace(Regex("\\s+"), " ").trim()
    }

    private fun decodeHtml(raw: String): String {
        return raw.replace("&amp;", "&").replace("&quot;", "\"")
            .replace("&#39;", "'").replace("&apos;", "'")
            .replace("&lt;", "<").replace("&gt;", ">")
            .replace("&nbsp;", " ").replace("&#x27;", "'")
    }

    private fun action(text: String, callback: () -> Unit): TextView = label(text, 14f, textColor, true).apply {
        gravity = Gravity.CENTER
        setPadding(dp(10), dp(8), dp(10), dp(8))
        background = rounded(panel, 0xFF1B2C3B.toInt(), 13)
        isClickable = true
        isFocusable = true
        setOnClickListener { callback() }
    }

    private fun label(text: String, size: Float, color: Int, bold: Boolean): TextView = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        if (bold) typeface = Typeface.create("sans-serif", Typeface.BOLD)
    }

    private fun rounded(fill: Int, stroke: Int, radius: Int): GradientDrawable = GradientDrawable().apply {
        setColor(fill)
        setStroke(dp(1), stroke)
        cornerRadius = dp(radius).toFloat()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    override fun onPause() {
        super.onPause()
        active()?.let { tab ->
            if (tab.url.startsWith("http://") || tab.url.startsWith("https://")) {
                val old = prefs.getStringSet("history", emptySet())?.toMutableSet() ?: mutableSetOf()
                old.add("${System.currentTimeMillis()}|${tab.url}")
                // StringSet iteration order is undefined; sort by timestamp before trimming.
                val recent = old.sortedBy { it.substringBefore("|").toLongOrNull() ?: 0L }.takeLast(200).toSet()
                prefs.edit().putStringSet("history", recent).apply()
            }
        }
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        tabs.forEach { it.web.stopLoading(); it.web.destroy() }
        tabs.clear()
        super.onDestroy()
    }
}
