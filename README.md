
# NokeApp - BLE Testing App

This React Native application is designed for testing Bluetooth Low Energy (BLE) functionality. It serves as a sandbox for experimenting with BLE connections, scanning, and data exchange between mobile devices and BLE peripherals.

## 📱 Features
- Scan for nearby BLE devices
- Connect and disconnect from BLE peripherals
- Read and write characteristics
- Monitor BLE signal strength

## 🚀 Getting Started

### Prerequisites
- Node.js (>= 14.x)
- npm or yarn
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation
```bash
# Clone the repository
https://github.com/ricardopadilla-janus/NokeApp.git

# Navigate into the project directory
cd NokeApp

# Install dependencies
npm install
# or
yarn install
```

### Android Setup
1. Ensure Android SDK is installed.
2. Create or edit `android/local.properties`:
   ```
   sdk.dir=/Users/ricardo.padilla/Library/Android/sdk
   ```
3. Start Metro bundler:
   ```bash
   npx react-native start
   ```
4. In another terminal, run:
   ```bash
   npx react-native run-android
   ```

### iOS Setup (macOS only)
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

## 🛠️ Development
- Use `npx react-native start` to launch the Metro bundler.
- Use `npx react-native run-android` or `run-ios` to build and run the app.

## 📄 License
This project is licensed for internal testing and development purposes.
