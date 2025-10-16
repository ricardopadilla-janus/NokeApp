package com.nokeblemanager;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * Placeholder Android implementation
 * TODO: Implement Android BLE functionality
 */
public class NokeBleManagerModule extends ReactContextBaseJavaModule {
    
    private final ReactApplicationContext reactContext;

    public NokeBleManagerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "NokeBleManager";
    }

    @ReactMethod
    public void startScan(String[] serviceUUIDs, double seconds, boolean allowDuplicates, Promise promise) {
        promise.reject("NOT_IMPLEMENTED", "Android implementation not yet available");
    }

    @ReactMethod
    public void stopScan(Promise promise) {
        promise.reject("NOT_IMPLEMENTED", "Android implementation not yet available");
    }

    @ReactMethod
    public void connect(String deviceId, Promise promise) {
        promise.reject("NOT_IMPLEMENTED", "Android implementation not yet available");
    }

    @ReactMethod
    public void disconnect(String deviceId, Promise promise) {
        promise.reject("NOT_IMPLEMENTED", "Android implementation not yet available");
    }

    @ReactMethod
    public void isScanning(Promise promise) {
        promise.resolve(false);
    }

    @ReactMethod
    public void getConnectedDevices(Promise promise) {
        promise.resolve(new String[]{});
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for event emitters
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Keep: Required for event emitters
    }
}

