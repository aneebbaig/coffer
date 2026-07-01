package com.coffer.app

import android.content.Intent
import android.os.Build
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val WINDOW_CHANNEL = "com.coffer.app/window"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, WINDOW_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // Bring this activity to the foreground (works when activity is paused/stopped)
                    "bringToFront" -> {
                        val intent = Intent(this, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                        }
                        startActivity(intent)
                        result.success(null)
                    }
                    // Turn screen on and allow showing over the lock screen (keyguard still runs -
                    // face/fingerprint/PIN auth fires automatically before content is visible)
                    "setTurnScreenOn" -> {
                        val enable = call.arguments as Boolean
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                            setTurnScreenOn(enable)
                            // Do NOT call setShowWhenLocked(true) - keyguard must run for security
                        } else {
                            @Suppress("DEPRECATION")
                            if (enable) {
                                window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
                            } else {
                                window.clearFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
                            }
                        }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
