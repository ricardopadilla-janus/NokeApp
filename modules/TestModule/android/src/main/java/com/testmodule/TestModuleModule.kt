package com.testmodule

import android.app.AlertDialog
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments

class TestModuleModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TestModule"

    @ReactMethod
    fun getNativeString(promise: Promise) {
        try {
            val result = "Hello from Android Native! 🤖"
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun showAlert(title: String, message: String, promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity not available")
                return
            }
            
            activity.runOnUiThread {
                AlertDialog.Builder(activity)
                    .setTitle(title)
                    .setMessage(message)
                    .setPositiveButton("OK") { dialog, _ -> 
                        dialog.dismiss()
                        promise.resolve(null)
                    }
                    .setCancelable(false)
                    .show()
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun vibrate(promise: Promise) {
        try {
            val vibrator = reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(500)
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try {
            val deviceInfo = Arguments.createMap().apply {
                putString("platform", "Android")
                putString("osVersion", Build.VERSION.RELEASE)
                putString("model", "${Build.MANUFACTURER} ${Build.MODEL}")
            }
            promise.resolve(deviceInfo)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RCTEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // Required for RCTEventEmitter
    }
}

