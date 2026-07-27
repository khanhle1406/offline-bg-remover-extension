# Offline AI Background Remover - Chrome Extension (Manifest V3)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square)
![ONNX Runtime Web](https://img.shields.io/badge/ONNX_Runtime_Web-WASM-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

Một Chrome Extension hiện đại, hỗ trợ **xóa nền ảnh tự động 100% Offline** (Client-side) sử dụng mô hình Deep Learning **U-2-Net (u2netp)** kết hợp với **ONNX Runtime Web & WebAssembly (WASM)**. 

Không gửi ảnh lên bất kỳ server trung gian nào — đảm bảo tốc độ phản hồi tức thì, bảo mật dữ liệu tuyệt đối và hoạt động hoàn toàn ngay cả khi không có kết nối Internet.

---

## 🌟 Tính Năng Nổi Bật

- 🔒 **100% Privacy-First & Offline**: Toàn bộ quá trình tách nền diễn ra ngay trên trình duyệt của người dùng (Client-Side Inferences).
- 🚀 **Hiệu năng cao với WebAssembly (WASM)**: Sử dụng ONNX Runtime Web kết hợp WASM để chạy mô hình AI với hiệu suất tối ưu.
- 🎨 **Giao diện hiện đại & Linh hoạt**:
  - Hỗ trợ xem trước ảnh gốc và ảnh sau khi xóa nền (Chế độ so sánh Trước/Sau).
  - Tích hợp công cụ chỉnh sửa màu nền: Nền trong suốt (PNG), màu đơn sắc, hoặc các gradient màu mắt mắt.
  - Tải xuống ảnh kết quả chất lượng cao chỉ với 1-click.
- ⚡ **Tích hợp tiện lợi trên Chrome**:
  - Hỗ trợ **Paste (Dán) ảnh trực tiếp** từ clipboard (`Ctrl+V` / `Cmd+V`).
  - Drag & Drop (Kéo thả) file ảnh vào giao diện.
  - Hỗ trợ **Side Panel** & Popup tiện lợi.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Frontend Core**: HTML5, Vanilla CSS3 (Custom Design System, Glassmorphism UI), Modern JavaScript (ES6+ async/await, Canvas API).
- **AI / Machine Learning**: 
  - Model: `u2netp` (Phiên bản nhẹ, tối ưu hóa cho ứng dụng Web/Edge devices).
  - Inference Engine: `ONNX Runtime Web` (WebAssembly backend support).
- **Extension Platform**: Chrome Extension Manifest V3 (Service Worker background script, Side Panel API, Context Menu API).

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng (Dành Cho Developer / Nhà Tuyển Dụng)

### 1. Clone repository về máy

```bash
git clone https://github.com/khanhle1406/offline-bg-remover-extension.git
cd offline-bg-remover-extension
```

### 2. Cài đặt vào Google Chrome

1. Mở trình duyệt Chrome và truy cập đường dẫn: `chrome://extensions/`
2. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Nhấp vào nút **Load unpacked** (Tải tiện ích đã giải nén).
4. Chọn thư mục dự án `offline-bg-remover-extension` vừa clone về.
5. Ghim (Pin) tiện ích lên thanh công cụ của Chrome và bắt đầu trải nghiệm!

---

## 📸 Cấu Trúc Dự Án (Project Structure)

```text
offline-bg-remover-extension/
├── manifest.json          # Cấu hình Chrome Extension (Manifest V3)
├── background.js         # Service Worker quản lý sự kiện background
├── popup.html            # Giao diện chính của tiện ích
├── popup.css             # Styling giao diện (Custom CSS / Layout / Themes)
├── popup.js              # Logic ứng dụng, xử lý Canvas & ONNX Model Inference
├── u2netp.onnx           # Model AI u2netp đã qua tối ưu hóa
├── lib/                  # Thư viện ONNX Runtime Web & file WASM binaries
│   ├── ort.min.js
│   ├── ort-wasm.wasm
│   ├── ort-wasm-simd.wasm
│   └── ...
├── icons/                # Icons ứng dụng với nhiều kích thước khác nhau
└── README.md             # Tài liệu dự án
```

---

## 📜 License

Dự án được phát hành dưới mã nguồn mở [MIT License](LICENSE).
