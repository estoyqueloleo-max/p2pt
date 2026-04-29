# Build and Publication Guide - P2PT Android

This document details the steps to generate the production file and how to handle publication on the Google Play Store.

## 0. Generate Development APK (Debug)
To test the application locally without the need to sign it with a production key.

Run from the `android/` folder:
```bash
./gradlew :app:assembleDebug
```
The file will be generated in:
`app/build/outputs/apk/debug/app-debug.apk`

---

## 1. Signing Configuration (Key)
To generate a package that the Play Store accepts, the file must be signed.

### Generate the key (first time only)
If you don't have a `.jks` file, generate it with this command in the `android/` folder:
```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

### Configure credentials
Edit the `android/key.properties` file with the data of the key you created:
- `storePassword`: Keystore password.
- `keyPassword`: Key/alias password.
- `keyAlias`: The alias (e.g., `my-key-alias`).
- `storeFile`: File name (e.g., `my-release-key.jks`).

---

## 2. Generate the Android App Bundle (.aab)
Google Play requires the `.aab` format for new applications.

Run from the `android/` folder:
```bash
./gradlew :app:bundleRelease
```
The file will be generated in:
`app/build/outputs/bundle/release/app-release.aab`

---

## 3. Upload to Play Store
Currently, **there is no direct connection from this environment to automatically "upload"** the file to Google Play without prior configuration of the Google Play Developer API (which requires a service account JSON file).

### Manual Process (Recommended):
1. Go to the [Google Play Console](https://play.google.com/console/).
2. Select your application.
3. Go to **Production** (or Internal Testing) -> **Create new version**.
4. Upload the `app-release.aab` file you generated in step 2.

### Automation (Optional)

To automate the upload and avoid having to enter the web, you have two main options:

#### Option A: Fastlane (Very popular)
It is a tool written in Ruby that automates screenshots, beta testing, and deployment.
1. Install Fastlane: `gem install fastlane`.
2. Initialize in your android folder: `fastlane init`.
3. Configure the `Appfile` and `Fastfile`.
4. You will need the **Google Play Service Account** JSON file.
5. Command to upload: `fastlane deploy` (depending on your configuration).

#### Option B: Gradle Play Publisher (GPP)
It is a Gradle plugin that integrates directly into your build flow.
1. Add the plugin in `build.gradle` (root):
   `id("com.github.triplet.play") version "3.7.0" apply false`
2. Apply it in `app/build.gradle`:
   `apply plugin: 'com.github.triplet.play'`
3. Configure the `play { ... }` block with the path to your credentials JSON.
4. Command to upload: `./gradlew publishReleaseBundle`.

#### Indispensable Requirement for both:
For either of the two, you must go to the **Google Play Console** -> **Settings** -> **API Access** and create a "Service account". Google will give you a `.json` file that these tools will use to authenticate for you.

---

## Security Notes
- **NEVER** upload `my-release-key.jks` or `key.properties` to a public repository.
- If you lose the `.jks` file, you will not be able to update the application in the store.
