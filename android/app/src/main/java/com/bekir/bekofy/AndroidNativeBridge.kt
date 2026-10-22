package com.bekir.bekofy

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.widget.Toast

class AndroidNativeBridge(
    private val activity: MainActivity,
    private val context: Context
) {

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun vibrate(milliseconds: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator.vibrate(
                    VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(milliseconds)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun setStatusBarColor(colorHex: String) {
        activity.runOnUiThread {
            try {
                activity.window.statusBarColor = Color.parseColor(colorHex)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun updateMediaSession(title: String, artist: String, coverUrl: String, isPlaying: Boolean) {
        activity.runOnUiThread {
            activity.updateMediaPlayback(title, artist, coverUrl, isPlaying)
        }
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return "1.4.0-native-android"
    }

    @JavascriptInterface
    fun requestNotificationPermission() {
        activity.runOnUiThread {
            activity.checkAndRequestNotificationPermission()
        }
    }

    fun dispatchMediaControlToJS(action: String) {
        activity.runOnUiThread {
            activity.sendMediaControlToWebView(action)
        }
    }
}
