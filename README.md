# AI Offline Background Remover - Chrome Extension (Manifest V3)

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![ONNX Runtime Web](https://img.shields.io/badge/ONNX_Runtime_Web-WASM-orange?style=flat-square)](https://onnxruntime.ai/docs/tutorials/web/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A modern Chrome Extension that performs **100% Offline Client-Side Automatic Background Removal** using the Deep Learning **U-2-Net (`u2netp`)** model, powered by **ONNX Runtime Web & WebAssembly (WASM)**.

Zero server uploads — ensuring instant execution speed, absolute data privacy, and full functionality even without an internet connection.

---

## 🌟 Key Features

- 🔒 **100% Privacy-First & Offline**: All inference processing happens directly within the user's browser (Client-Side Inferences).
- 🚀 **High Performance via WebAssembly (WASM)**: Utilizes ONNX Runtime Web compiled with WASM for optimal AI model execution.
- 🎨 **Modern & Flexible UI/UX**:
  - Interactive Before/After comparison mode.
  - Built-in background customizer: Transparent (PNG), solid colors, or vibrant color gradients.
  - 1-Click high-resolution image export.
- ⚡ **Seamless Chrome Integration**:
  - Supports direct **Clipboard Image Paste** (`Ctrl+V` / `Cmd+V`).
  - Drag & Drop image file upload.
  - Integrated Chrome **Side Panel** & Popup view options.

---

## 🛠️ Tech Stack

- **Frontend Core**: Vanilla HTML5, CSS3 (Custom Design System, Glassmorphism UI), Modern JavaScript (ES6+ async/await, Canvas API).
- **AI / Machine Learning Engine**: 
  - Model: Lightweight `u2netp` (Quantized & optimized for Web/Edge device execution).
  - Inference Engine: `ONNX Runtime Web` with WebAssembly (WASM) execution provider.
- **Extension Architecture**: Chrome Extension Manifest V3 (Service Worker background process, Side Panel API, Context Menu API).

---

## 🚀 Installation & Usage Guide

### 1. Clone the repository

```bash
git clone https://github.com/khanhle1406/offline-bg-remover-extension.git
cd offline-bg-remover-extension
```

### 2. Load into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `offline-bg-remover-extension` directory.
5. Pin the extension to your Chrome toolbar and start removing image backgrounds!

---

## 📸 Project Directory Structure

```text
offline-bg-remover-extension/
├── manifest.json          # Chrome Extension configuration (Manifest V3)
├── background.js         # Service worker handling background events
├── popup.html            # Extension user interface markup
├── popup.css             # Styling rules (Custom CSS / Layouts / Glassmorphism)
├── popup.js              # Application logic, Canvas operations & ONNX Model Inference
├── u2netp.onnx           # Optimized U-2-Net AI model weights
├── lib/                  # ONNX Runtime Web library & WebAssembly binary dependencies
│   ├── ort.min.js
│   ├── ort-wasm.wasm
│   ├── ort-wasm-simd.wasm
│   └── ...
├── icons/                # Extension icons across multiple resolutions
└── README.md             # Project documentation
```

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).
