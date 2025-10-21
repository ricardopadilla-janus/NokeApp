package com.nativescanner

import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * NokeAPIClient - Cliente HTTP nativo para Noke API
 * Equivalente al NokeAPIClient.swift de iOS
 */
class NokeAPIClient(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "NokeAPIClient"
        private const val MODULE_NAME = "NokeAPIClient"
        private const val BASE_URL_PRODUCTION = "https://router.smartentry.noke.dev/"
        private const val BASE_URL_SANDBOX = "https://router-sandbox.smartentry.noke.dev/"
    }

    private var baseURL = BASE_URL_PRODUCTION
    private var authToken: String? = null
    private var userUUID: String? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = MODULE_NAME

    override fun invalidate() {
        super.invalidate()
        scope.cancel()
    }

    // MARK: - Configuration

    @ReactMethod
    fun setEnvironment(environment: String, promise: Promise) {
        baseURL = when (environment.lowercase()) {
            "sandbox" -> {
                Log.d(TAG, "Environment set to: SANDBOX")
                BASE_URL_SANDBOX
            }
            "production", "prod", "dev" -> {
                Log.d(TAG, "Environment set to: PRODUCTION")
                BASE_URL_PRODUCTION
            }
            else -> {
                promise.reject("INVALID_ENV", "Invalid environment: $environment. Use 'sandbox', 'production', 'prod', or 'dev'")
                return
            }
        }
        promise.resolve(true)
    }

    // MARK: - Authentication

    @ReactMethod
    fun login(
        email: String,
        password: String,
        companyUUID: String,
        siteUUID: String,
        deviceId: String,
        promise: Promise
    ) {
        scope.launch {
            try {
                Log.d(TAG, "Logging in as: $email")

                val requestBody = JSONObject().apply {
                    put("email", email)
                    put("password", password)
                    put("companyUUID", companyUUID)
                    put("siteUUID", siteUUID)
                    if (deviceId.isNotEmpty()) {
                        put("deviceId", deviceId)
                    }
                }

                val response = performRequest(
                    endpoint = "login/",
                    method = "POST",
                    body = requestBody,
                    authorized = false
                )

                val jsonResponse = JSONObject(response)
                Log.d(TAG, "📥 LOGIN RESPONSE:")
                Log.d(TAG, jsonResponse.toString(2))

                // Extract token
                val token = jsonResponse.optString("token", "")
                if (token.isEmpty()) {
                    throw Exception("No token in login response")
                }
                
                authToken = token

                // Extract userUUID from data object (flexible parsing like iOS)
                var extractedUserUUID = ""
                val data = jsonResponse.optJSONObject("data")
                if (data != null) {
                    // Try userUUID field
                    extractedUserUUID = data.optString("userUUID", "")
                    
                    // Try id field as fallback
                    if (extractedUserUUID.isEmpty()) {
                        val userId = data.optInt("id", 0)
                        if (userId > 0) {
                            extractedUserUUID = userId.toString()
                        }
                    }
                }
                
                userUUID = extractedUserUUID

                Log.d(TAG, "✅ Login successful")
                Log.d(TAG, "   Auth Token: ${token.take(30)}...")
                Log.d(TAG, "   User UUID: $userUUID")

                val result = Arguments.createMap().apply {
                    putString("authToken", token)
                    putString("userUUID", userUUID)
                    putString("email", email)
                    putString("companyUUID", companyUUID)
                    putString("siteUUID", siteUUID)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Login failed: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    promise.reject("LOGIN_ERROR", e.message, e)
                }
            }
        }
    }

    // MARK: - Offline Keys

    @ReactMethod
    fun getAllOfflineKeys(
        userUUID: String,
        companyUUID: String,
        siteUUID: String,
        promise: Promise
    ) {
        scope.launch {
            try {
                Log.d(TAG, "Getting offline keys for user: $userUUID")

                val requestBody = JSONObject().apply {
                    put("userUUID", userUUID)
                    put("companyUUID", companyUUID)
                    put("siteUUID", siteUUID)
                }

                Log.d(TAG, "📤 Request body:")
                Log.d(TAG, requestBody.toString(2))

                val response = performRequest(
                    endpoint = "user/locks/",
                    method = "POST",
                    body = requestBody,
                    authorized = true
                )

                val jsonResponse = JSONObject(response)
                Log.d(TAG, "📥 OFFLINE KEYS RESPONSE:")
                Log.d(TAG, jsonResponse.toString(2))

                // Parse response
                val data = jsonResponse.getJSONObject("data")
                val units = data.getJSONArray("units")
                val devicesMap = mutableMapOf<String, WritableMap>()

                for (i in 0 until units.length()) {
                    val unit = units.getJSONObject(i)
                    val locks = unit.optJSONArray("locks") ?: continue

                    for (j in 0 until locks.length()) {
                        val lock = locks.getJSONObject(j)
                        val mac = lock.optString("mac", "")
                        
                        if (mac.isNotEmpty()) {
                            val deviceMap = Arguments.createMap().apply {
                                putString("mac", mac)
                                putString("name", lock.optString("name", ""))
                                putString("offlineKey", lock.optString("offlineKey", ""))
                                putString("unlockCmd", lock.optString("unlockCmd", ""))
                            }
                            devicesMap[mac] = deviceMap
                        }
                    }
                }

                Log.d(TAG, "✅ Offline keys obtained")
                Log.d(TAG, "   Total devices: ${devicesMap.size}")

                val resultMap = Arguments.createMap()
                devicesMap.forEach { (mac, device) ->
                    resultMap.putMap(mac, device)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(resultMap)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to get offline keys: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    promise.reject("API_ERROR", e.message, e)
                }
            }
        }
    }

    // MARK: - Online Unlock Commands

    @ReactMethod
    fun getUnlockCommands(
        mac: String,
        session: String,
        promise: Promise
    ) {
        scope.launch {
            try {
                Log.d(TAG, "Getting unlock commands for: $mac")

                val requestBody = JSONObject().apply {
                    put("session", session)
                    put("mac", mac)
                }

                logCurlCommand("lock/unlock/", "POST", requestBody)

                val response = performRequest(
                    endpoint = "lock/unlock/",
                    method = "POST",
                    body = requestBody,
                    authorized = true
                )

                val jsonResponse = JSONObject(response)
                Log.d(TAG, "📥 UNLOCK RESPONSE:")
                Log.d(TAG, jsonResponse.toString(2))

                // Check if response indicates an error
                val result = jsonResponse.optString("result", "")
                if (result == "failure") {
                    val errorMessage = jsonResponse.optString("message", "Unknown error")
                    val errorCode = jsonResponse.optInt("errorCode", -1)
                    Log.e(TAG, "❌ API returned error: $errorMessage (code: $errorCode)")
                    withContext(Dispatchers.Main) {
                        promise.reject("API_ERROR", errorMessage)
                    }
                    return@launch
                }

                // Try to extract commands
                var commands: JSONArray? = null

                // Try: json.commands
                commands = jsonResponse.optJSONArray("commands")

                // Try: json.data.commands
                if (commands == null) {
                    val data = jsonResponse.optJSONObject("data")
                    commands = data?.optJSONArray("commands")
                }

                if (commands != null && commands.length() > 0) {
                    val commandsList = mutableListOf<String>()
                    for (i in 0 until commands.length()) {
                        commandsList.add(commands.getString(i))
                    }

                    val commandString = commandsList.joinToString("+")

                    Log.d(TAG, "✅ Unlock commands received: ${commandsList.size} commands")

                    val resultMap = Arguments.createMap().apply {
                        putString("commandString", commandString)
                        val commandsArray = Arguments.createArray()
                        commandsList.forEach { commandsArray.pushString(it) }
                        putArray("commands", commandsArray)
                    }

                    withContext(Dispatchers.Main) {
                        promise.resolve(resultMap)
                    }
                } else {
                    Log.e(TAG, "❌ No 'commands' array found in response")
                    withContext(Dispatchers.Main) {
                        promise.reject("PARSE_ERROR", "No commands found in response")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to get unlock commands: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    promise.reject("API_ERROR", e.message, e)
                }
            }
        }
    }

    // MARK: - Token Management

    @ReactMethod
    fun getAuthToken(promise: Promise) {
        promise.resolve(authToken ?: "")
    }

    @ReactMethod
    fun setAuthToken(token: String, promise: Promise) {
        authToken = token
        Log.d(TAG, "Auth token set")
        promise.resolve(true)
    }

    @ReactMethod
    fun clearAuthToken(promise: Promise) {
        authToken = null
        userUUID = null
        Log.d(TAG, "Auth token cleared")
        promise.resolve(true)
    }

    // MARK: - Helper Methods

    private fun performRequest(
        endpoint: String,
        method: String,
        body: JSONObject?,
        authorized: Boolean
    ): String {
        val url = URL(baseURL + endpoint)
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.requestMethod = method
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")

            if (authorized && authToken != null) {
                connection.setRequestProperty("Authorization", "Bearer $authToken")
            }

            connection.doInput = true

            if (body != null && (method == "POST" || method == "PUT")) {
                connection.doOutput = true
                val writer = OutputStreamWriter(connection.outputStream)
                writer.write(body.toString())
                writer.flush()
                writer.close()
            }

            val responseCode = connection.responseCode
            Log.d(TAG, "📥 Response: $responseCode")

            if (responseCode !in 200..299) {
                val errorStream = connection.errorStream ?: connection.inputStream
                val errorReader = BufferedReader(InputStreamReader(errorStream))
                val errorResponse = errorReader.readText()
                errorReader.close()

                Log.e(TAG, "❌ HTTP Error $responseCode: $errorResponse")
                throw Exception("HTTP $responseCode: $errorResponse")
            }

            val reader = BufferedReader(InputStreamReader(connection.inputStream))
            val response = reader.readText()
            reader.close()

            Log.d(TAG, "   Response data: $response")

            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun logCurlCommand(endpoint: String, method: String, body: JSONObject?) {
        val url = baseURL + endpoint
        var curlCommand = "curl -X $method '$url'"

        curlCommand += " \\\n  -H 'Content-Type: application/json'"
        curlCommand += " \\\n  -H 'Accept: application/json'"

        if (authToken != null) {
            curlCommand += " \\\n  -H 'Authorization: Bearer $authToken'"
        }

        if (body != null) {
            curlCommand += " \\\n  -d '${body.toString()}'"
        }

        Log.d(TAG, "\n🔧 CURL COMMAND:")
        Log.d(TAG, "─────────────────────────────────────────────────────────")
        Log.d(TAG, curlCommand)
        Log.d(TAG, "─────────────────────────────────────────────────────────\n")
    }

    // MARK: - Event Emitter Support

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for event emitter compatibility
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // Required for event emitter compatibility
    }
}

