package com.mvmsolo.mvmbrowser

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.net.URLEncoder
import java.util.UUID

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
    private val tabs = mutableListOf<BrowserTab>()
    private var activeIndex = 0
    private val prefs by lazy { getSharedPreferences("mvm-browser", Context.MODE_PRIVATE) }
    private val savedDir by lazy { File(filesDir, "offline-pages").apply { mkdirs() } }

    private data class BrowserTab(
        val id: String = UUID.randomUUID().toString(),
        val web: WebView,
        var title: String = "New tab",
        var url: String = "file:///android_asset/home.html"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
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
        tabsButton = action("▢ 1") { showTabs() }
        brandRow.addView(logo)
        brandRow.addView(title)
        brandRow.addView(spacer, LinearLayout.LayoutParams(0, 1, 1f))
        brandRow.addView(tabsButton)
        root.addView(brandRow)

        val addressRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(panel, 0xFF1B2C3B.toInt(), 17)
            setPadding(dp(10), dp(3), dp(4), dp(3))
        }
        val lock = label("⌕", 21f, cyan, true).apply { gravity = Gravity.CENTER; layoutParams = LinearLayout.LayoutParams(dp(28), dp(44)) }
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
        addressRow.addView(lock)
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

        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, dp(2))
        }
        listOf(
            "‹" to { goBack() },
            "›" to { goForward() },
            "⌂" to { home() },
            "☆" to { toggleBookmark() },
            "↓" to { saveOffline() },
            "+" to { newTab() }
        ).forEach { (symbol, callback) ->
            val b = action(symbol, callback).apply {
                textSize = 22f
                layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f)
            }
            bottom.addView(b)
        }
        root.addView(bottom)
        setContentView(root)
    }

    private fun newTab(url: String = "file:///android_asset/home.html") {
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
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val scheme = uri.scheme?.lowercase()
                if (scheme == "http" || scheme == "https" || scheme == "about") return false
                if (scheme == "file") {
                    val path = uri.path.orEmpty()
                    val localArchive = path.startsWith(savedDir.absolutePath + File.separator)
                    val bundledAsset = path.startsWith("/android_asset/")
                    return !(localArchive || bundledAsset)
                }
                return true
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                progress.visibility = View.VISIBLE
                progress.progress = 4
                address.setText(if (url.startsWith("file:///android_asset/home.html")) "" else url)
                tabFor(view)?.url = url
            }
            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                address.setText(if (url.startsWith("file:///android_asset/home.html")) "" else url)
                tabFor(view)?.apply { this.url = url; title = view.title ?: url }
                updateTabButton()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) toast("Page unavailable. Check connection or open a saved page.")
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                toast("Secure connection rejected")
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }
            override fun onReceivedTitle(view: WebView, title: String?) {
                tabFor(view)?.title = title?.take(80) ?: "New tab"
            }
        }
    }

    private fun tabFor(web: WebView): BrowserTab? = tabs.firstOrNull { it.web === web }

    private fun activate(index: Int) {
        if (tabs.isEmpty()) return
        activeIndex = index.coerceIn(0, tabs.lastIndex)
        webHost.removeAllViews()
        val web = tabs[activeIndex].web
        (web.parent as? ViewGroup)?.removeView(web)
        webHost.addView(web, FrameLayout.LayoutParams(-1, -1))
        address.setText(if (tabs[activeIndex].url.startsWith("file:///android_asset/home.html")) "" else tabs[activeIndex].url)
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
            if (uri.scheme == "https" || uri.scheme == "http" || uri.scheme == "file") {
                active()?.web?.loadUrl(target)
                (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(address.windowToken, 0)
                address.clearFocus()
            } else toast("Only web URLs are supported")
        } catch (_: Exception) { toast("Invalid address") }
    }

    private fun home() { active()?.web?.loadUrl("file:///android_asset/home.html") }
    private fun goBack() { active()?.let { if (it.web.canGoBack()) it.web.goBack() else home() } }
    private fun goForward() { active()?.let { if (it.web.canGoForward()) it.web.goForward() else toast("No forward page") } }
    override fun onBackPressed() {
        val web = active()?.web
        if (web != null && web.canGoBack()) web.goBack() else if (tabs.size > 1) closeActiveTab() else super.onBackPressed()
    }

    private fun toggleBookmark() {
        val url = active()?.url ?: return
        if (url.startsWith("file:///android_asset/")) { toast("Open a website first"); return }
        val key = "bookmarks"
        val items = prefs.getStringSet(key, emptySet())?.toMutableSet() ?: mutableSetOf()
        if (items.remove(url)) toast("Bookmark removed") else { items.add(url); toast("Bookmark saved") }
        prefs.edit().putStringSet(key, items).apply()
    }

    private fun saveOffline() {
        val tab = active() ?: return
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
        AlertDialog.Builder(this).setTitle("Tabs & library").setItems(options.toTypedArray()) { _, which ->
            when {
                which < tabs.size -> activate(which)
                which == tabs.size -> newTab()
                which == tabs.size + 1 -> showSavedList("bookmarks", "Bookmarks", false)
                which == tabs.size + 2 -> showSavedList("offline-pages", "Offline pages", true)
                else -> showHistory()
            }
        }.setNegativeButton("Close current tab") { _, _ -> closeActiveTab() }
            .setNeutralButton("Clear history") { _, _ -> prefs.edit().remove("history").apply(); toast("History cleared") }
            .show()
    }

    private fun showSavedList(key: String, title: String, offline: Boolean) {
        val items = (prefs.getStringSet(key, emptySet()) ?: emptySet()).toList().sorted()
        if (items.isEmpty()) { toast("Nothing saved yet"); return }
        AlertDialog.Builder(this).setTitle(title).setItems(items.map { if (offline) File(it).name else it }.toTypedArray()) { _, which ->
            val item = items[which]
            if (offline) active()?.web?.loadUrl(Uri.fromFile(File(item)).toString()) else {
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

    private fun closeActiveTab() {
        if (tabs.isEmpty()) return
        val old = tabs.removeAt(activeIndex)
        webHost.removeView(old.web)
        old.web.stopLoading()
        old.web.destroy()
        if (tabs.isEmpty()) newTab() else activate((activeIndex - 1).coerceAtLeast(0))
        updateTabButton()
    }

    private fun updateTabButton() { if (::tabsButton.isInitialized) tabsButton.text = "▢ ${tabs.size}" }

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
                prefs.edit().putStringSet("history", old.takeLast(200).toSet()).apply()
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
