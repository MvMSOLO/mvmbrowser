# MVM Browser WebView Ad/Tracker Filter

## Current implementation

- Uses a bundled offline host denylist in `AdBlocker.kt` covering common ad networks and analytics/tracking endpoints (including Google ad hosts, Taboola, Outbrain, Criteo, AppLovin, Adjust, AppsFlyer, and others). The list is intentionally conservative and may need site-specific tuning.
- Checks only HTTP(S) subresource requests in `WebViewClient.shouldInterceptRequest`; top-level navigation is deliberately not blocked.
- Matching requests receive an empty HTTP 204 response.
- The toolbar's **SHIELD ON/OFF** control persists the enabled state in app preferences and reloads the active tab.
- The interception callback performs only in-memory checks; it does not download lists, parse files, or run coroutine work per request.

## Limitations

This is a starter host filter, **not** a complete EasyList implementation. It does not parse cosmetic rules, URL patterns, exception rules, or first/third-party context. Some ads share a domain with first-party content, some resources are not exposed through this callback, and WebView redirect handling has limitations. Therefore, it cannot guarantee that every ad or tracker is blocked, and a false positive may prevent a resource from loading.

## Validation checklist

1. Build the Android debug APK with the existing CI workflow.
2. Verify normal navigation, login pages, images, video, and downloads still work.
3. Verify the shield state survives app restarts.
4. With the shield enabled, check that a request to a listed ad host is intercepted; with it disabled, confirm normal WebView loading resumes.
5. Review false positives before expanding the list. Keep any future list update outside `shouldInterceptRequest` and validate downloaded data before replacing the in-memory rules.
