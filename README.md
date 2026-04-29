# 🐧 P2PT - Real-time P2P Location

> [!TIP]
> If you are going to synchronize your routes with a private server, check this guide on [Gitea and CORS](https://people.iola.dk/arj/2020/04/28/gitea-and-cors/) to configure access from the App.

P2PT is a real-time geolocation tool designed to be **private, lightweight, and persistent**.

<!-- pingo-user-guide-start -->
## 🚀 How to Set Up Your P2PT

To start using P2PT safely, follow these steps:

1.  **Establish Your Identity**:
    - Open the **Settings** panel (gear icon ⚙️).
    - In the **MY IDENTITY** section, enter your **Alias/Name**, a **Secret Phrase**, and a **Salt**.
    - Click **Set Identity**. This will generate a unique 8-digit ID. Your **Alias** is the name others will see when you send them a notification (Push) or chat with them. If you lose your phone, you can recover the same ID using the same phrase and salt on another device.

2.  **Add Your "P2PTs" (Contacts)**:
    - To see someone else, you need to add them to your **Agenda**.
    - Ask them for their **Secret Phrase** and **Salt** (or have them send you their invitation link).
    - **New**: You can also add them using their **Connection ID (manual)** if they don't use secret phrases.
    - Done! Now they will appear in your list.

3.  **Cloud Services (Optional)**:
    - If you have connection problems (especially on 4G/5G), enable **Cloud Services** in Settings.
    - This enables the **TURN Relay** (intermediate server) and **Push Notifications** for when the App is closed.

## 📡 Connection and Coverage (P2P)

P2PT uses direct P2P technology to connect devices. Connection success depends on your network:

| Scenario | P2P Success | Note |
| :--- | :--- | :--- |
| **WiFi to WiFi** | **~99%** | Ideal for home/office. |
| **WiFi to 4G/5G** | **~70%** | Depends on the mobile operator. |
| **5G to 5G** | **~30%** | Requires enabling "Cloud Services" (TURN). |

### Behavior by Operator (Spain)
| Operator | P2P Quality | Solution if it fails |
| :--- | :--- | :--- |
| **Movistar / O2** | Excellent | No extra adjustments required. |
| **Vodafone** | Excellent | Works direct almost always. |
| **Orange / Jazztel** | Good | Generally stable. |
| **Digi / Yoigo** | Limited | **Enable Cloud Services (TURN)**. |

---

## 📱 Daily Use

- **Local Connection**: Click the arrow icon (🚀) on a contact to try to connect with them. If you both have the App open, you will see each other on the map.
- **Groups and Chats**: When connecting with multiple contacts, a P2P "swarm" is formed. Chat messages are automatically retransmitted among all connected peers (relay), allowing private and fluid group chats.
- **Geofence**: You can activate a safe zone for a contact. Your phone will notify you if that person leaves the radius you have configured. Geofences are private: your phone monitors the other without saving data on servers.
- **P2PT Routes (Cartography Mode)**: Record your routes and journeys in real-time. P2PT uses a local Git repository (in your browser) to save the history with full traceability and immutability. You can share these routes with other P2PTs directly (P2P) and they can import them into their own collection.

## ✨ Frequently Asked Questions

- **Why is my ID always the same?**: P2PT uses advanced cryptography (PBKDF2) to generate your identity from your Secret Phrase. This allows you to recover your ID and contacts even if you change phones, simply by using the same phrase.
- **What is the transparent circle on the map?**: Indicates **GPS Accuracy**. The smaller the circle, the more exact your contact's location is. If the circle is large, the person might be inside a building or with poor satellite coverage.
- **Why does the trail disappear?**: To keep the App fast, trails have a limit of 500 points. You will only see the full trail of your contacts while they are recording a route (REC).
<!-- pingo-user-guide-end -->

## 🛠️ Technical Details

- **Direct P2P**: Encrypted and direct communication via WebRTC.
- **TURN Relay (Optional)**: Overcomes restrictive firewalls and mobile networks through its own relay server.
- **Zero Central Servers**: Your coordinates are not saved in the cloud (the backend only manages credentials and the relay never decrypts the content).
- **Push Notifications (Hybrid Mode)**: P2PT uses the Web Push standard to wake up devices. When you send a "Ping", the cloud server looks for the recipient's subscription and sends an instant notice that works even with the App closed.
- **Smart Deep Linking**: Notifications include a dynamic link that, when clicked, opens the App, establishes the P2P connection automatically, and unfolds the chat panel for an immediate response.
- **Smart Geolocation**: Dual-way system with fast start (cache) and automatic fallback to low precision indoors.
- **Synced Version**: The `./v.sh` script ensures that all modules and the Service Worker are always updated and cache-free.
- **Git Traceability**: Route history management using `isomorphic-git` without servers.
- **Git Proxy (Relay)**: The backend allows synchronizing your local repository with external remotes (like GitHub) securely.

## 📱 Native Version (Android/iOS) with Capacitor

P2PT can run as a real native App to take advantage of advanced features like external content interception.

### 🎥 YouTube to Git Capture
The native version includes a **YouTube** button that allows you to:
1. Open the mobile version of YouTube in a controlled internal browser.
2. Intercept every click you make on a video link (`/watch?v=...`).
3. Automatically generate a `.txt` file with the video details and perform an instant **Git Commit** in your local route repository to save it in your history.

### 🛠️ How to Compile the Native App
If you are in a development environment with Android Studio installed:

1.  **Generate the web build**:
    ```bash
    npm run build
    ```
2.  **Sync with Capacitor**:
    ```bash
    npx cap sync android
    ```
3.  **Open in Android Studio**:
    ```bash
    npx cap open android
    ```
    *From Android Studio, click "Run" to install it on your physical device or emulator.*


## 🛠️ Technologies

- **Architecture**: Modular ES6 (`js/` directory).
- **Maps**: Leaflet.js (CartoDB Dark).
- **Connectivity**: PeerJS (P2P / WebRTC).
- **PWA**: Installable on Android/iOS as a native App.
- **Security**: Web Crypto API (SHA-256 / PBKDF2) for private identities.
- **Versioning**: isomorphic-git + lightning-fs for robust route persistence.

---
*Developed with ❤️ to be the simplest and most private way to take care of your loved ones.*
