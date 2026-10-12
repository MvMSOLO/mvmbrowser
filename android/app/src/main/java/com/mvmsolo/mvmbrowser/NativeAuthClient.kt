package com.mvmsolo.mvmbrowser

import android.webkit.CookieManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Native client for Better Auth endpoints implemented by MVM Browser's web server.
 * Passwords and API secrets are never saved. The session cookie remains in Android's
 * WebView cookie store. A real HTTPS deployment is required; no production origin is
 * hard-coded in this repository.
 */
internal object NativeAuthClient {
    data class AuthUser(val id: String, val name: String, val email: String)
    data class AuthResult(val ok: Boolean, val message: String, val user: AuthUser? = null, val signedIn: Boolean = false)
    private data class HttpResult(val status: Int, val body: String, val transportError: String? = null)

    /** Accept exactly an HTTPS origin, not a path, credentials, query, or fragment. */
    fun normalizeBaseUrl(raw: String): String? {
        val parsed = try { URI(raw.trim()) } catch (_: Exception) { return null }
        if (!parsed.scheme.equals("https", ignoreCase = true)) return null
        val host = parsed.host?.takeIf { it.isNotBlank() } ?: return null
        if (parsed.rawUserInfo != null || parsed.rawQuery != null || parsed.rawFragment != null) return null
        val path = parsed.rawPath.orEmpty()
        if (path.isNotEmpty() && path != "/") return null
        if (parsed.port > 65535 || parsed.port == 0) return null
        val port = if (parsed.port == -1 || parsed.port == 443) "" else ":${parsed.port}"
        return "https://${host.lowercase(Locale.ROOT)}$port"
    }

    fun signIn(baseUrl: String, email: String, password: String): AuthResult {
        val origin = normalizeBaseUrl(baseUrl) ?: return AuthResult(false, "Configure a valid HTTPS auth-server origin first.")
        val response = request(origin, "POST", "sign-in/email",
            JSONObject().put("email", email).put("password", password).put("callbackURL", "/").toString())
        if (response.status !in 200..299) return failedResponse("Sign in", response)
        val session = getSession(origin)
        if (session.ok && session.signedIn) return AuthResult(true, "Signed in successfully.", session.user, true)
        return AuthResult(false, if (!session.ok) {
            "Sign-in was accepted, but the session could not be verified: ${session.message}"
        } else {
            "No active session was returned. Check the server's HTTPS cookie and Better Auth configuration."
        })
    }

    fun signUp(baseUrl: String, name: String, email: String, password: String): AuthResult {
        val origin = normalizeBaseUrl(baseUrl) ?: return AuthResult(false, "Configure a valid HTTPS auth-server origin first.")
        val response = request(origin, "POST", "sign-up/email",
            JSONObject().put("name", name).put("email", email).put("password", password).put("callbackURL", "/").toString())
        if (response.status !in 200..299) return failedResponse("Create account", response)
        val session = getSession(origin)
        return if (session.ok && session.signedIn) {
            AuthResult(true, "Account created and signed in.", session.user, true)
        } else if (!session.ok) {
            AuthResult(true, "Account request was accepted, but session verification failed. Check email verification settings: ${session.message}")
        } else {
            AuthResult(true, "Account request was accepted. No session is active; verify your email if required, then sign in.")
        }
    }

    fun getSession(baseUrl: String): AuthResult {
        val origin = normalizeBaseUrl(baseUrl) ?: return AuthResult(false, "Configure a valid HTTPS auth-server origin first.")
        val response = request(origin, "GET", "get-session", null)
        if (response.status !in 200..299) return failedResponse("Check session", response)
        if (response.body.isBlank() || response.body.trim() == "null") return AuthResult(true, "No signed-in account on this server.")
        val json = try { JSONObject(response.body) } catch (_: Exception) {
            return AuthResult(false, "The auth server returned an invalid session response.")
        }
        val user = parseUser(json.optJSONObject("user"))
        return if (user != null) AuthResult(true, "Signed in as ${user.email.ifBlank { user.name }}.", user, true)
        else AuthResult(true, "No signed-in account on this server.")
    }

    fun signOut(baseUrl: String): AuthResult {
        val origin = normalizeBaseUrl(baseUrl) ?: return AuthResult(false, "Enter the same valid HTTPS auth server used to sign in.")
        val response = request(origin, "POST", "sign-out", "{}")
        if (response.status !in 200..299) return failedResponse("Sign out", response)
        return AuthResult(true, "Signed out. The server cleared the session cookie.")
    }

    private fun request(origin: String, method: String, endpoint: String, body: String?): HttpResult {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        val connection = try {
            (URL("$origin/api/auth/$endpoint").openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 12_000
                readTimeout = 12_000
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Origin", origin)
                setRequestProperty("Referer", "$origin/")
                setRequestProperty("User-Agent", "MVM-Browser-Android")
                cookieManager.getCookie(origin)?.takeIf { it.isNotBlank() }?.let { setRequestProperty("Cookie", it) }
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
            }
        } catch (error: Exception) {
            return HttpResult(0, "", error.message ?: "Could not create a secure connection.")
        }

        return try {
            if (body != null) connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val setCookies = connection.headerFields.entries
                .filter { (key, _) -> key != null && key.equals("Set-Cookie", ignoreCase = true) }
                .flatMap { it.value ?: emptyList() }
            setCookies.forEach { cookie ->
                val latch = CountDownLatch(1)
                cookieManager.setCookie(origin, cookie) { latch.countDown() }
                latch.await(3, TimeUnit.SECONDS)
            }
            cookieManager.flush()
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { reader ->
                val builder = StringBuilder()
                val buffer = CharArray(4096)
                while (builder.length < 1_000_000) {
                    val read = reader.read(buffer, 0, minOf(buffer.size, 1_000_000 - builder.length))
                    if (read <= 0) break
                    builder.append(buffer, 0, read)
                }
                builder.toString()
            }.orEmpty()
            HttpResult(status, responseBody)
        } catch (error: Exception) {
            HttpResult(0, "", error.message ?: "Network request failed.")
        } finally {
            connection.disconnect()
        }
    }

    private fun failedResponse(action: String, response: HttpResult): AuthResult {
        if (response.status == 0) return AuthResult(false,
            "$action could not reach the auth server. Check the HTTPS URL and connection. ${response.transportError.orEmpty()}".trim())
        val message = try {
            val json = JSONObject(response.body)
            json.optString("message").takeIf { it.isNotBlank() && it != "null" }
                ?: json.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
                ?: json.optString("error").takeIf { it.isNotBlank() && it != "null" }
                ?: "$action failed (HTTP ${response.status})."
        } catch (_: Exception) {
            "$action failed (HTTP ${response.status})."
        }
        return AuthResult(false, message.take(350))
    }

    private fun parseUser(json: JSONObject?): AuthUser? {
        json ?: return null
        val id = json.optString("id").takeIf { it.isNotBlank() && it != "null" } ?: return null
        return AuthUser(id, json.optString("name").takeIf { it != "null" }.orEmpty(),
            json.optString("email").takeIf { it != "null" }.orEmpty())
    }
}
