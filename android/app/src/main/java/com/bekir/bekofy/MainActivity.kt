package com.bekir.bekofy

import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.view.View
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var nativeBridge: AndroidNativeBridge

    private var mediaService: MediaPlaybackService? = null
    private var isServiceBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as MediaPlaybackService.LocalBinder
            mediaService = binder.getService()
            isServiceBound = true

            mediaService?.onMediaActionListener = { action ->
                nativeBridge.dispatchMediaControlToJS(action)
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            mediaService = null
            isServiceBound = false
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Native Dark status bar & navigation bar
        window.statusBarColor = Color.parseColor("#0A0A0A")
        window.navigationBarColor = Color.parseColor("#0A0A0A")

        swipeRefresh = SwipeRefreshLayout(this)
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.parseColor("#121212"))
        swipeRefresh.setColorSchemeColors(Color.parseColor("#1DB954"))

        webView = WebView(this)
        swipeRefresh.addView(webView)
        setContentView(swipeRefresh)

        nativeBridge = AndroidNativeBridge(this, applicationContext)
        webView.addJavascriptInterface(nativeBridge, "AndroidNative")

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", AssetsPathHandler(this))
            .build()

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        val defaultUserAgent = settings.userAgentString
        settings.userAgentString = "$defaultUserAgent BekofyAndroidNative/1.4.0"

        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                request?.url?.let { uri ->
                    val intercepted = assetLoader.shouldInterceptRequest(uri)
                    if (intercepted != null) return intercepted
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }

        bindMediaService()
        checkAndRequestNotificationPermission()

        // Load the main entry page via AssetLoader
        webView.loadUrl("https://appassets.androidplatform.net/assets/pages/splash.html")
    }

    private fun bindMediaService() {
        val intent = Intent(this, MediaPlaybackService::class.java)
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    101
                )
            }
        }
    }

    fun updateMediaPlayback(title: String, artist: String, coverUrl: String, isPlaying: Boolean) {
        if (isServiceBound && mediaService != null) {
            mediaService?.updateMediaState(title, artist, coverUrl, isPlaying)
        }
    }

    fun sendMediaControlToWebView(action: String) {
        val jsCode = "if(typeof window.onNativeMediaControl === 'function') { window.onNativeMediaControl('$action'); }"
        webView.evaluateJavascript(jsCode, null)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (isServiceBound) {
            unbindService(serviceConnection)
            isServiceBound = false
        }
        super.onDestroy()
    }
}
