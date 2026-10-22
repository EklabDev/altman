# ⚡ Altman (*Alternative Postman*)
### 100% Offline, Local-First HTTP/HTTPS Client for Visual Studio Code

---

## 📌 Problem & Motivation
Postman has deprecated its offline Local Scratchpad functionality, forcing collections and environments into Postman Cloud. In many enterprise, financial, defense, and high-security environments, policy strictly forbids transmitting API keys, proprietary payloads, or internal endpoints to any cloud service.

**Altman** solves this by providing a feature-rich, Postman v10-style API client directly inside VS Code that runs **strictly offline** with **zero telemetry or outbound syncing**.

---

## ✨ Features

- **🧭 VS Code Activity Bar & Sidebar Integration**:
  - Direct 1-click launch from the VS Code Activity Bar on the left sidebar without needing Command Palette.
  - Sidebar tree shows all collections, folders, requests (with GET/POST method badges), and active environment switcher.
  - Clicking any request in the sidebar immediately opens it in the Altman Workbench.
- **📄 OpenAPI 3.0 YAML Dual View & Porting**:
  - Instantly toggle between **⚡ Postman View** and **📄 OpenAPI YAML View**.
  - **Postman collection is strictly the single source of truth**: edits to requests, parameters, headers, or bodies in Postman View dynamically regenerate the OpenAPI specification in real-time.
  - Full conversion of URLs, path parameters (`{param}`), query parameters, headers, Bearer/Basic/APIKey security schemes, and JSON request/response schemas.
  - Built-in **Copy YAML** and **Export OpenAPI YAML (.yaml)** actions.
- **🔒 100% Offline & Local Storage**:
  - All collections, environments, history, and settings are stored locally in the workspace under `.altman/` (or `~/.altman` if no workspace is opened).
  - Version-controllable with Git.
- **📜 Full Pre-Request & Post-Request Script Sandbox**:
  - Bundled with [`jsrsasign`](https://github.com/kjur/jsrsasign) for cryptographic signing (RSA, SHA256/512, HMAC, JWT, X.509).
  - Bundled with `CryptoJS` (MD5, SHA, AES) and `Chai` assertions.
  - Full `pm.*` API compatibility (`pm.environment.set/get`, `pm.collectionVariables`, `pm.variables`, `pm.request`, `pm.response`, `pm.test`, `pm.expect`).
- **🔤 Multi-Layer Templating & Dynamic Variables**:
  - Interpolation across: URLs, Path parameters (`:param` and `{{param}}`), Query parameters, Headers, Authorization (Bearer, Basic, API Key), and Request Body (raw JSON, urlencoded, etc.).
  - Hierarchy: `Local Request` > `Environment` > `Collection` > `Global`.
  - Built-in dynamic variables: `{{$guid}}`, `{{$randomUUID}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}`, `{{$randomEmail}}`, `{{$randomAlphaNumeric}}`.
- **📂 Postman Collection v2.1 Import & Export**:
  - Import Postman Collection v2.1.0 JSON files directly.
  - Export collections for sharing or CI/CD pipelines.
  - Explorer Right-Click Integration: Right-click any `.json` file in VS Code Explorer -> **"Altman: Import Postman Collection to .altman"**.
- **🌐 Environment Toggle & Management**:
  - Switch active environments instantly via the top navigation bar, sidebar, or status bar.
  - Built-in visual environment manager table (key, value, secret, enabled).
- **📊 Live Console & Logs**:
  - Integrated Console Logs tab capturing script output (`console.log`, `console.info`, `console.warn`, `console.error`) with timestamps and log levels.
- **🚀 Newman CLI Integration**:
  - Built-in Newman command composer.
  - One-click **"Run in VS Code Terminal"** to execute your collection directly in an integrated terminal with Newman.
- **💻 Multi-Language Code Generation**:
  - Instant code snippets for:
    - **cURL**
    - **Node.js** (Fetch API)
    - **Python** (Requests)
    - **Java 11+** (HttpClient)
- **🎯 Scope**:
  - HTTP & HTTPS (with configurable SSL verification for self-signed certificates).
  - WebSockets, gRPC, and GraphQL are intentionally out of scope.

---

## 📁 Repository Structure

```
.
├── .altman/                           # Workspace local data directory
│   ├── collections/                   # Postman v2.1 collections
│   │   └── Altman_Demo_Collection.json
│   ├── environments/                  # Environments
│   │   └── Local_Development.altman_env.json
│   └── settings.json                  # Local preferences & active environment
├── media/                             # Webview assets
│   ├── altman-icon.svg                # Extension icon
│   ├── main.css                       # Postman v10 styling
│   └── main.js                        # Client-side webview SPA
├── scripts/
│   ├── install-local.sh               # Builds .vsix and installs into VS Code
│   └── test-local.sh                  # Executes automated Mocha test suite
├── src/
│   ├── engine/
│   │   ├── codeGenerator.ts           # cURL, Node, Python, Java generator
│   │   ├── httpClient.ts              # Pure HTTP/HTTPS executor with metrics
│   │   ├── newmanGenerator.ts         # Newman CLI composer & terminal launcher
│   │   ├── postmanParser.ts           # v2.1 Collection & Environment parser/serializer
│   │   ├── scriptSandbox.ts           # Node vm runner with jsrsasign & pm.*
│   │   └── variableResolver.ts        # {{var}} templating & dynamic variables
│   ├── panels/
│   │   └── altmanPanel.ts             # WebviewPanel controller & IPC bridge
│   ├── storage/
│   │   └── altmanStorage.ts           # .altman file system storage manager
│   ├── test/                          # Unit tests
│   └── extension.ts                   # VS Code extension activation & commands
├── package.json
└── tsconfig.json
```

---

## 🛠️ Local Installation & Testing

### 1. Run Unit Tests Locally
```bash
./scripts/test-local.sh
# or: npm test
```

### 2. Package & Install into VS Code
```bash
./scripts/install-local.sh
# or: npm run install:local
```

This script:
1. Bundles the extension using `esbuild` into `dist/extension.js`.
2. Packages the extension into a self-contained `.vsix` file.
3. Automatically executes `code --install-extension altman-0.1.0.vsix --force`.

---

## 🚀 How to Use Altman in VS Code

1. Press **`Cmd + Shift + P`** (Mac) or **`Ctrl + Shift + P`** (Windows/Linux).
2. Type **`Altman: Open Local API Client`** and press Enter.
3. Or click **`Altman`** in the bottom-right status bar.
4. The Postman v10-style interface opens in an editor tab.
5. In the left sidebar under **Collections**, click on the pre-loaded **`Altman Demo Collection`** to inspect requests, pre-request scripts with `jsrsasign`, dynamic variables, and test assertions.
6. Click **Send** to dispatch requests locally.
