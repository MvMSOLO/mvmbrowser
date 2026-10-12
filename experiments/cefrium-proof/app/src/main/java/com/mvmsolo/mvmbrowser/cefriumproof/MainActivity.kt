package com.mvmsolo.mvmbrowser.cefriumproof

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.cefrium.CefriumBrowser

/**
 * Isolated integration proof. This deliberately does not replace the shipping WebView app.
 * Cefrium's own SDK documentation is the API contract for this experiment.
 */
class MainActivity : Activity() {
    private var browser: CefriumBrowser? = null
    private lateinit var addressField: EditText
    private lateinit var titleText: TextView
    private lateinit var statusText: TextView
    private lateinit var browserFrame: FrameLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(7, 11, 19)
        window.navigationBarColor = Color.rgb(7, 11, 19)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(10))
            setBackgroundColor(Color.rgb(7, 11, 19))
        }

        val masthead = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(2), dp(2), dp(2), dp(10))
        }
        masthead.addView(TextView(this).apply {
            text = "MVM  /  ENGINE LAB"
            textSize = 11f
            letterSpacing = 0.16f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(Color.rgb(53, 224, 193))
        })
        titleText = TextView(this).apply {
            text = "Starting bundled Chromium…"
            textSize = 18f
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(Color.rgb(244, 247, 255))
            setPadding(0, dp(5), 0, 0)
        }
        masthead.addView(titleText)
        masthead.addView(TextView(this).apply {
            text = "Cefrium 0.9.4  ·  Chromium 154  ·  Android 10+"
            textSize = 11f
            setTextColor(Color.rgb(143, 155, 177))
            setPadding(0, dp(4), 0, 0)
        })
        root.addView(masthead)

        val addressRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        addressField = EditText(this).apply {
            singleLine = true
            hint = "Search or enter website"
            textSize = 14f
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
            setTextColor(Color.rgb(244, 247, 255))
            setHintTextColor(Color.rgb(116, 129, 150))
            setPadding(dp(13), dp(2), dp(10), dp(2))
            background = roundedBackground(Color.rgb(19, 27, 42), 14)
            layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f).apply {
                marginEnd = dp(8)
            }
        }
        addressRow.addView(addressField)
        addressRow.addView(actionButton("GO") { navigateFromField() }.apply {
            layoutParams = LinearLayout.LayoutParams(dp(58), dp(48))
            setTextColor(Color.rgb(7, 11, 19))
            background = roundedBackground(Color.rgb(53, 224, 193), 14)
        })
        root.addView(addressRow)

        addressField.setOnEditorActionListener { _, actionId, event ->
            val enterPressed = event?.keyCode == KeyEvent.KEYCODE_ENTER &&
                event.action == KeyEvent.ACTION_DOWN
            if (actionId == EditorInfo.IME_ACTION_GO ||
                actionId == EditorInfo.IME_ACTION_DONE || enterPressed) {
                navigateFromField()
                true
            } else {
                false
            }
        }

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(9), 0, dp(9))
        }
        toolbar.addView(actionButton("BACK") {
            browser?.let {
                if (it.canGoBack()) it.goBack() else toast("No previous page")
            }
        }, equalToolbarParams())
        toolbar.addView(actionButton("NEXT") {
            browser?.let {
                if (it.canGoForward()) it.goForward() else toast("No next page")
            }
        }, equalToolbarParams())
        toolbar.addView(actionButton("RELOAD") {
            browser?.reload()
        }, equalToolbarParams())
        toolbar.addView(actionButton("HOME") {
            browser?.loadUrl(START_URL)
        }, equalToolbarParams())
        root.addView(toolbar)

        browserFrame = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(13, 19, 30))
        }
        root.addView(browserFrame, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        statusText = TextView(this).apply {
            text = "Engine initialization is running…"
            textSize = 11f
            setTextColor(Color.rgb(143, 155, 177))
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(2), dp(9), dp(2), dp(1))
            maxLines = 2
        }
        root.addView(statusText, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ))
        setContentView(root)

        createBrowser(savedInstanceState)
    }

    private fun createBrowser(savedInstanceState: Bundle?) {
        try {
            val engine = CefriumBrowser.createWithSurface(this)
            browser = engine

            // Invalid TLS certificates must fail closed; never add a "continue anyway" path.
            engine.setSslErrorHandler(null)
            engine.setOnUrlChangedListener { newUrl ->
                runOnUiThread {
                    if (!addressField.hasFocus()) addressField.setText(newUrl.toString())
                }
            }
            engine.setOnTitleChangedListener { newTitle ->
                runOnUiThread {
                    val value = newTitle.toString().take(100)
                    titleText.text = value.ifBlank { "MVM Browser Engine Lab" }
                }
            }

            browserFrame.addView(engine.surfaceContainer, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
            ))

            val savedState = savedInstanceState?.getBundle(STATE_KEY)
            if (savedState != null) {
                engine.restoreState(savedState)
                statusText.text = "Chromium engine restored the last page."
            } else {
                engine.loadUrl(START_URL)
                statusText.text = "Rendering with bundled Chromium 154."
            }
        } catch (error: Exception) {
            showEngineError(error)
        } catch (error: LinkageError) {
            showEngineError(error)
        }
    }

    private fun showEngineError(error: Throwable) {
        titleText.text = "Engine failed to start"
        statusText.text = "Cefrium " + error.javaClass.simpleName + ": " +
            (error.message?.take(160) ?: "no additional details")
        Toast.makeText(this, "Chromium engine startup failed", Toast.LENGTH_LONG).show()
    }

    private fun navigateFromField() {
        val target = BrowserUrlResolver.resolve(addressField.text.toString())
        if (target == null) {
            statusText.text = "Use an HTTP(S) website or enter search terms. Unsupported URL schemes are blocked."
            return
        }
        addressField.clearFocus()
        val activeBrowser = browser
        if (activeBrowser != null) {
            activeBrowser.loadUrl(target)
        } else {
            statusText.text = "Chromium engine is not available."
        }
    }

    private fun actionButton(label: String, action: () -> Unit): TextView =
        TextView(this).apply {
            text = label
            textSize = 10f
            letterSpacing = 0.04f
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(Color.rgb(205, 215, 232))
            background = roundedBackground(Color.rgb(19, 27, 42), 10)
            isClickable = true
            isFocusable = true
            setPadding(dp(3), dp(9), dp(3), dp(9))
            setOnClickListener { action() }
        }

    private fun equalToolbarParams() = LinearLayout.LayoutParams(0, dp(38), 1f).apply {
        marginEnd = dp(6)
    }

    private fun roundedBackground(color: Int, cornerDp: Int) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(cornerDp).toFloat()
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()

    private fun toast(message: String) =
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    override fun onPause() {
        browser?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        browser?.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        browser?.let { outState.putBundle(STATE_KEY, it.saveState()) }
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated by Android; Cefrium currently exposes this compatibility callback.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        val handled = browser?.onActivityResult(requestCode, resultCode, data) == true
        if (!handled) super.onActivityResult(requestCode, resultCode, data)
    }

    @Deprecated("Kept compatible with the Activity base API used by this isolated proof.")
    override fun onBackPressed() {
        val activeBrowser = browser
        if (activeBrowser != null && activeBrowser.canGoBack()) {
            activeBrowser.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        val activeBrowser = browser
        browser = null
        runCatching { activeBrowser?.close() }
        super.onDestroy()
    }

    companion object {
        private const val STATE_KEY = "cefrium-browser-state"
        private const val START_URL = "https://example.com/"
    }
}
