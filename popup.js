/**
 * Popup JS — Xóa Nền Ảnh AI Chrome Extension
 * Handles paste/drop input, ONNX inference, and display results
 */

// ── DOM Elements ──
const pasteZone = document.getElementById("pasteZone");
const pasteLabel = document.getElementById("pasteLabel");
const pasteTarget = document.getElementById("pasteTarget");
const sliderContainer = document.getElementById("sliderContainer");
const sliderOriginalImg = document.getElementById("sliderOriginalImg");
const sliderResultImg = document.getElementById("sliderResultImg");
const sliderHandle = document.getElementById("sliderHandle");

// Compatibility shims
const previewWrap = sliderContainer;
const previewImg = sliderOriginalImg;
const resultImg = sliderResultImg;
const resultBox = document.getElementById("resultBox");
const emptyResult = document.getElementById("emptyResult");
const spinnerOverlay = document.getElementById("spinnerOverlay");
const statsDiv = document.getElementById("stats");
const statTime = document.getElementById("statTime");
const statSize = document.getElementById("statSize");
const statDim = document.getElementById("statDim");
const btnRow = document.getElementById("btnRow");
const btnDownload = document.getElementById("btnDownload");
const btnCopy = document.getElementById("btnCopy");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const toast = document.getElementById("toast");
const choiceModal = document.getElementById("choiceModal");
const btnChoiceEdit = document.getElementById("btnChoiceEdit");
const btnChoiceRemove = document.getElementById("btnChoiceRemove");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");

let currentResultB64 = null; // stores raw base64 (no header) of result PNG
let currentSourceDataUrl = null; // store source image for editor restore

// ── Editor state ──
const editToggleRow = document.getElementById("editToggleRow");
const editToggle = document.getElementById("editToggle");
const editorWrap = document.getElementById("editorWrap");
const editorCanvas = document.getElementById("editorCanvas");
const ctx = editorCanvas.getContext("2d");
const btnErase = document.getElementById("btnErase");
const btnRestore = document.getElementById("btnRestore");
const brushSlider = document.getElementById("brushSize");
const brushVal = document.getElementById("brushVal");
const btnEditorReset = document.getElementById("btnEditorReset");
const btnShowBg = document.getElementById("btnShowBg");
const editorToolbar = document.getElementById("editorToolbar");
const editorToolbarWrap = document.getElementById("editorToolbarWrap");

let editorMode = "erase"; // "erase" or "restore"
let brushRadius = 25;
let showBg = false; // show original image behind result
let drawing = false;
let lastPos = null; // track last brush position for interpolation
let currentMousePos = null; // track mouse for cursor preview
let editorResultData = null;  // ImageData of current editing
let editorOriginalData = null; // ImageData of original (for restore)
let editorRemovedData = null;  // ImageData of initial bg-removed (for reset)
let undoStack = [];
let redoStack = [];
let editorImgW = 0, editorImgH = 0;
let editorScale = 1;
let currentResultDataUrl = null; // full data URL of bg-removed result
let modelResultDataUrl = null;   // data URL of initial result from model (for absolute reset)
let hasUnsavedEdits = false;
let pendingImageDataUrl = null;  // temporarily store input if waiting for modal choice

//  ONNX Runtime Web Init
// ══════════════════════════════════════════════════════════════
let ortSession = null;
let isModelLoading = false;

// Force single-thread to prevent indefinite hangs in Chrome extension environment
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  "ort-wasm.wasm": chrome.runtime.getURL("lib/ort-wasm.wasm"),
  "ort-wasm-simd.wasm": chrome.runtime.getURL("lib/ort-wasm-simd.wasm"),
  "ort-wasm-threaded.wasm": chrome.runtime.getURL("lib/ort-wasm-threaded.wasm"),
  "ort-wasm-simd-threaded.wasm": chrome.runtime.getURL("lib/ort-wasm-simd-threaded.wasm")
};

async function initModel() {
  if (ortSession) return true;
  if (isModelLoading) {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (ortSession) return true;
    }
    return false;
  }

  isModelLoading = true;
  statusDot.classList.remove("online");
  statusDot.classList.add("starting");
  statusText.textContent = "⏳ Tải model AI...";

  try {
    const modelUrl = chrome.runtime.getURL("u2netp.onnx");
    ortSession = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"]
    });
    statusDot.classList.remove("starting");
    statusDot.classList.add("online");
    statusText.textContent = "AI Sẵn sàng";
    isModelLoading = false;
    return true;
  } catch (err) {
    console.error("ONNX Load Error:", err);
    statusDot.classList.remove("starting");
    statusText.textContent = "AI Lỗi";
    isModelLoading = false;
    showToast("❌ Lỗi tải AI: " + err.message, true);
    return false;
  }
}

// Start loading the model on popup open
initModel();


// ── Persistence ──
function saveState() {
  const state = {
    currentSourceDataUrl,
    currentResultDataUrl,
    modelResultDataUrl,
    currentResultB64,
    stats: {
      time: statTime.textContent,
      size: statSize.textContent,
      dim: statDim.textContent
    }
  };
  chrome.storage.local.set({ popupState: state });
}

async function loadState() {
  try {
    const data = await chrome.storage.local.get("popupState");
    if (data && data.popupState) {
      const s = data.popupState;
      if (s.currentSourceDataUrl) {
        currentSourceDataUrl = s.currentSourceDataUrl;
        sliderOriginalImg.src = s.currentSourceDataUrl;
        sliderContainer.classList.remove("hidden");
        pasteLabel.textContent = "✅ Đã nhận ảnh — Ctrl+V để đổi";
      }
      if (s.currentResultDataUrl) {
        currentResultDataUrl = s.currentResultDataUrl;
        sliderResultImg.src = s.currentResultDataUrl;
        sliderResultImg.classList.remove("hidden");
        emptyResult.classList.add("hidden");
        resultBox.classList.remove("hidden");
        editToggleRow.classList.remove("hidden");
        editorToolbarWrap.classList.add("tb-hidden"); // Ensure toolbar is hidden initially
        btnRow.classList.remove("hidden");
        
        // Show slider handle and set split to 50%
        setSliderPosition(50);
        sliderHandle.classList.remove("hidden");
      }
      if (s.modelResultDataUrl) modelResultDataUrl = s.modelResultDataUrl;
      if (s.currentResultB64) currentResultB64 = s.currentResultB64;
      if (s.stats) {
        statTime.textContent = s.stats.time;
        statSize.textContent = s.stats.size;
        statDim.textContent = s.stats.dim;
        statsDiv.classList.remove("hidden");
      }
    }
  } catch (e) {
    console.warn("Load state failed", e);
  }
}

// Load on start
loadState();

// ── Check if opened from context menu (right-click on image) ──
async function checkContextMenuImage() {
  try {
    const data = await chrome.storage.local.get("contextMenuImageUrl");
    if (data && data.contextMenuImageUrl) {
      const imageUrl = data.contextMenuImageUrl;
      // Clear immediately so it doesn't re-trigger on next open
      await chrome.storage.local.remove("contextMenuImageUrl");
      // Clear the badge indicator
      chrome.action.setBadgeText({ text: "" });

      pasteLabel.textContent = "⏳ Đang tải ảnh từ trang web...";

      // Fetch the image and convert to data URL
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Không tải được ảnh");
      const blob = await res.blob();

      const reader = new FileReader();
      reader.onload = () => {
        processImageInput(reader.result);
      };
      reader.readAsDataURL(blob);
    }
  } catch (e) {
    console.error("Context menu image failed:", e);
    pasteLabel.textContent = "❌ Không tải được ảnh từ trang web";
    showToast(`❌ ${e.message}`, true);
  }
}

// ══════════════════════════════════════════════════════════════
//  Before/After Comparison Slider Dragging Logic
// ══════════════════════════════════════════════════════════════
let isDraggingSlider = false;

function setSliderPosition(pct) {
  pct = Math.max(0, Math.min(100, pct));
  sliderHandle.style.left = `${pct}%`;
  sliderOriginalImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  sliderResultImg.style.clipPath = `inset(0 0 0 ${pct}%)`;
}

// Mouse dragging
sliderHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();
  isDraggingSlider = true;
  sliderHandle.classList.add("active");
});

document.addEventListener("mouseup", () => {
  if (isDraggingSlider) {
    isDraggingSlider = false;
    sliderHandle.classList.remove("active");
  }
});

document.addEventListener("mousemove", (e) => {
  if (!isDraggingSlider) return;

  const rect = sliderContainer.getBoundingClientRect();
  if (rect.width === 0) return;

  const x = e.clientX - rect.left;
  const pct = (x / rect.width) * 100;
  setSliderPosition(pct);
});

// Touch dragging
sliderHandle.addEventListener("touchstart", (e) => {
  isDraggingSlider = true;
  sliderHandle.classList.add("active");
}, { passive: true });

document.addEventListener("touchend", () => {
  if (isDraggingSlider) {
    isDraggingSlider = false;
    sliderHandle.classList.remove("active");
  }
});

document.addEventListener("touchmove", (e) => {
  if (!isDraggingSlider) return;

  const rect = sliderContainer.getBoundingClientRect();
  if (rect.width === 0) return;

  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const pct = (x / rect.width) * 100;
  setSliderPosition(pct);
}, { passive: true });

checkContextMenuImage();


// ══════════════════════════════════════════════════════════════
//  Toast Notification
// ══════════════════════════════════════════════════════════════
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}


// ══════════════════════════════════════════════════════════════
//  Paste / Drop Input
// ══════════════════════════════════════════════════════════════

// Click → focus hidden textarea for paste
pasteZone.addEventListener("click", () => {
  pasteTarget.value = "";
  pasteTarget.focus();
  pasteZone.classList.add("active");
  pasteLabel.textContent = "Sẵn sàng — nhấn Ctrl+V để dán";
});

pasteTarget.addEventListener("blur", () => {
  pasteZone.classList.remove("active");
});

// Paste event
pasteTarget.addEventListener("paste", (e) => {
  e.preventDefault();
  const items = e.clipboardData.items;

  // Check for image first
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      handleFile(item.getAsFile());
      return;
    }
  }

  // Check for URL
  for (const item of items) {
    if (item.type === "text/plain") {
      item.getAsString((text) => {
        text = text.trim();
        if (text.match(/^https?:\/\//i)) {
          handleURL(text);
        } else {
          pasteLabel.textContent = "❌ Không phải ảnh hoặc link";
        }
      });
      return;
    }
  }
});

// Drag & drop
pasteZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  pasteZone.classList.add("active");
});

pasteZone.addEventListener("dragleave", () => {
  pasteZone.classList.remove("active");
});

pasteZone.addEventListener("drop", (e) => {
  e.preventDefault();
  pasteZone.classList.remove("active");

  // 1. Drop a local file
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
    return;
  }

  // 2. Drop an HTML img element (from Google Search / Google Images)
  const html = e.dataTransfer.getData("text/html");
  if (html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const img = doc.querySelector("img");
    if (img && img.src) {
      const src = img.src;
      if (src.startsWith("data:image/")) {
        processImageInput(src);
      } else if (src.startsWith("http://") || src.startsWith("https://")) {
        handleURL(src);
      }
      return;
    }
  }

  // 3. Drop a direct URL link or text
  const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("URL") || e.dataTransfer.getData("text/plain");
  if (url) {
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith("data:image/")) {
      processImageInput(trimmedUrl);
    } else if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      handleURL(trimmedUrl);
    }
  }
});

// Also allow paste anywhere in document
document.addEventListener("paste", (e) => {
  if (e.target === pasteTarget) return;
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      handleFile(item.getAsFile());
      return;
    }
  }
});


// ══════════════════════════════════════════════════════════════
//  Handle Image Input
// ══════════════════════════════════════════════════════════════

function handleFile(file) {
  pasteLabel.textContent = "⏳ Đang đọc ảnh...";
  const reader = new FileReader();
  reader.onload = () => {
    processImageInput(reader.result);
  };
  reader.readAsDataURL(file);
}

function handleURL(url) {
  pasteLabel.textContent = "⏳ Đang tải ảnh từ URL...";
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Không tải được ảnh");
      return res.blob();
    })
    .then((blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        processImageInput(reader.result);
      };
      reader.readAsDataURL(blob);
    })
    .catch(() => {
      pasteLabel.textContent = "❌ Không tải được ảnh từ URL";
    });
}

/**
 * Common entry point for image input.
 * Checks for transparency and asks user before calling API.
 */
async function processImageInput(dataUrl) {
  showSourceImage(dataUrl);
  pasteLabel.textContent = "🔍 Đang kiểm tra ảnh...";

  const isTransparent = await checkTransparency(dataUrl);
  pasteLabel.textContent = "Bấm vào đây rồi Ctrl+V dán ảnh";

  if (isTransparent) {
    pendingImageDataUrl = dataUrl;
    choiceModal.classList.remove("hidden");
  } else {
    removeBackground(dataUrl);
  }
}

async function checkTransparency(dataUrl) {
  try {
    const img = await loadImg(dataUrl);
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    // Check alpha channel of every pixel
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch (e) {
    console.error("Lỗi kiểm tra độ trong suốt:", e);
  }
  return false;
}

// choiceModal Listeners
btnChoiceRemove.addEventListener("click", () => {
  choiceModal.classList.add("hidden");
  if (pendingImageDataUrl) {
    removeBackground(pendingImageDataUrl);
  }
});

btnChoiceEdit.addEventListener("click", async () => {
  choiceModal.classList.add("hidden");
  if (pendingImageDataUrl) {
    // Treat the input transparent image as if it were processed by the model
    currentResultDataUrl = pendingImageDataUrl;
    modelResultDataUrl = pendingImageDataUrl;
    resultImg.src = pendingImageDataUrl;

    // Reset current stats as it's not model-processed
    statTime.textContent = "⏱️ -";
    statSize.textContent = "💾 -";
    const img = await loadImg(pendingImageDataUrl);
    statDim.textContent = `📐 ${img.width}×${img.height}`;

    resultImg.classList.remove("hidden");
    editToggleRow.classList.remove("hidden");
    btnRow.classList.remove("hidden");
    statsDiv.classList.remove("hidden");

    // Automatically enter edit mode
    editToggle.checked = true;
    resultBox.classList.add("hidden");
    editorWrap.classList.remove("hidden");
    editorToolbarWrap.classList.remove("tb-hidden");
    initEditor();
    saveState();
  }
});

function showSourceImage(dataUrl) {
  currentSourceDataUrl = dataUrl;
  
  // Set original image on slider base
  sliderOriginalImg.src = dataUrl;
  
  // Set slider to 100% split (only show original) & hide handle while processing
  setSliderPosition(100);
  sliderHandle.classList.add("hidden");
  
  // Show slider container and hide empty result
  resultBox.classList.remove("hidden");
  sliderContainer.classList.remove("hidden");
  emptyResult.classList.add("hidden");
  
  pasteLabel.textContent = "✅ Đã nhận ảnh — Ctrl+V để đổi";
}


// ══════════════════════════════════════════════════════════════
//  Client-Side Image Processing — Remove Background via ONNX
// ══════════════════════════════════════════════════════════════

async function removeBackground(imageDataUrl) {
  // Reset editor state
  editToggle.checked = false;
  editorWrap.classList.add("hidden");
  editToggleRow.classList.add("hidden");
  editorToolbarWrap.classList.add("tb-hidden");
  editorResultData = null;
  editorOriginalData = null;
  editorRemovedData = null;

  // Show spinner + progress bar
  emptyResult.classList.add("hidden");
  resultImg.classList.add("hidden");
  resultBox.classList.remove("hidden");
  statsDiv.classList.add("hidden");
  btnRow.classList.add("hidden");
  spinnerOverlay.classList.remove("hidden");

  // Start progress bar
  progressFill.style.width = "0%";
  progressBar.classList.remove("hidden");
  let progress = 0;
  const progressTimer = setInterval(() => {
    progress += (90 - progress) * 0.1;
    progressFill.style.width = `${progress}%`;
  }, 100);

  try {
    // 1. Ensure ONNX model is loaded
    const modelReady = await initModel();
    if (!modelReady) {
      throw new Error("Model AI chưa sẵn sàng. Hãy thử lại.");
    }

    const tStart = performance.now();

    // 2. Load the input image
    let imgElement = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Không thể đọc định dạng ảnh"));
      img.src = imageDataUrl;
    });

    let origW = imgElement.naturalWidth;
    let origH = imgElement.naturalHeight;

    // Auto-downscale extremely large images to speed up post-processing & save storage
    const MAX_DIM = 1600;
    if (origW > MAX_DIM || origH > MAX_DIM) {
      if (origW > origH) {
        origH = Math.round((origH * MAX_DIM) / origW);
        origW = MAX_DIM;
      } else {
        origW = Math.round((origW * MAX_DIM) / origH);
        origH = MAX_DIM;
      }

      const scaleCanvas = document.createElement("canvas");
      scaleCanvas.width = origW;
      scaleCanvas.height = origH;
      scaleCanvas.getContext("2d").drawImage(imgElement, 0, 0, origW, origH);
      
      const scaledDataUrl = scaleCanvas.toDataURL("image/png");
      currentSourceDataUrl = scaledDataUrl;
      sliderOriginalImg.src = scaledDataUrl;

      imgElement = scaleCanvas;
    }

    // 3. Preprocess: Resize to 320x320 and get Float32 array
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 320;
    tempCanvas.height = 320;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(imgElement, 0, 0, 320, 320);

    const imgData = tempCtx.getImageData(0, 0, 320, 320);
    const data = imgData.data;

    // ImageNet normalization optimized (avoiding division in loop)
    const rFactor = 1.0 / (255.0 * 0.229);
    const rOffset = -0.485 / 0.229;
    const gFactor = 1.0 / (255.0 * 0.224);
    const gOffset = -0.456 / 0.224;
    const bFactor = 1.0 / (255.0 * 0.225);
    const bOffset = -0.406 / 0.225;

    // CHW Format [1, 3, 320, 320]
    const float32Data = new Float32Array(3 * 320 * 320);
    for (let i = 0; i < 320 * 320; i++) {
      float32Data[i] = data[i * 4] * rFactor + rOffset;
      float32Data[i + 320 * 320] = data[i * 4 + 1] * gFactor + gOffset;
      float32Data[i + 2 * 320 * 320] = data[i * 4 + 2] * bFactor + bOffset;
    }

    // 4. Run ONNX Inference
    const inputTensor = new ort.Tensor("float32", float32Data, [1, 3, 320, 320]);
    const feeds = { "input.1": inputTensor };
    const results = await ortSession.run(feeds);

    const outputName = ortSession.outputNames[0];
    const outputTensor = results[outputName];
    const outputData = outputTensor.data; // Float32Array [1, 1, 320, 320]

    // 5. Postprocess: Create 320x320 alpha mask canvas
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = 320;
    maskCanvas.height = 320;
    const maskCtx = maskCanvas.getContext("2d");
    const maskImg = maskCtx.createImageData(320, 320);

    for (let i = 0; i < 320 * 320; i++) {
      const val = outputData[i];
      const alpha = Math.min(255, Math.max(0, Math.round(val * 255)));
      maskImg.data[i * 4] = 0;     // R
      maskImg.data[i * 4 + 1] = 0; // G
      maskImg.data[i * 4 + 2] = 0; // B
      maskImg.data[i * 4 + 3] = alpha; // A (Transparency)
    }
    maskCtx.putImageData(maskImg, 0, 0);

    // 6. Apply mask on original size using globalCompositeOperation
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = origW;
    finalCanvas.height = origH;
    const finalCtx = finalCanvas.getContext("2d");

    // Draw original image
    finalCtx.drawImage(imgElement, 0, 0, origW, origH);

    // Apply scaled mask
    finalCtx.globalCompositeOperation = "destination-in";
    finalCtx.drawImage(maskCanvas, 0, 0, origW, origH);
    finalCtx.globalCompositeOperation = "source-over";

    // 7. Get final base64 image URL
    const resultDataUrl = finalCanvas.toDataURL("image/png");

    const tEnd = performance.now();
    const elapsed = ((tEnd - tStart) / 1000).toFixed(2);

    // Complete progress bar
    clearInterval(progressTimer);
    progressFill.style.width = "100%";
    setTimeout(() => progressBar.classList.add("hidden"), 500);

    // Show result & setup comparison slider
    spinnerOverlay.classList.add("hidden");
    currentResultDataUrl = resultDataUrl;
    modelResultDataUrl = resultDataUrl;
    
    // Load result image into top layer
    sliderResultImg.src = resultDataUrl;
    sliderResultImg.classList.remove("hidden");
    
    // Set slider split to 50% (middle) and reveal the divider handle
    setSliderPosition(50);
    sliderHandle.classList.remove("hidden");

    // Stats
    currentResultB64 = resultDataUrl.split(",")[1];
    const sizeKb = (currentResultB64.length * 3 / 4) / 1024;

    statTime.textContent = `⏱️ ${elapsed}s (local)`;
    statSize.textContent = `💾 ${sizeKb.toFixed(0)} KB`;
    statDim.textContent = `📐 ${origW}×${origH}`;
    statsDiv.classList.remove("hidden");

    // Buttons & Toggles
    btnRow.classList.remove("hidden");
    editToggleRow.classList.remove("hidden");

    saveState();

  } catch (err) {
    clearInterval(progressTimer);
    progressBar.classList.add("hidden");
    spinnerOverlay.classList.add("hidden");
    emptyResult.classList.remove("hidden");
    showToast(`❌ Lỗi: ${err.message}`, true);
  }
}


// ══════════════════════════════════════════════════════════════
//  Editor — Toggle
// ══════════════════════════════════════════════════════════════

editToggle.addEventListener("change", () => {
  if (editToggle.checked) {
    // Enter edit mode
    resultBox.classList.add("hidden");
    editorWrap.classList.remove("hidden");
    editorToolbarWrap.classList.remove("tb-hidden");
    initEditor();
  } else {
    // Exit edit mode → Apply edits automatically
    applyEditsToResult();
    editorWrap.classList.add("hidden");
    editorToolbarWrap.classList.add("tb-hidden");
    resultBox.classList.remove("hidden");
  }
});


// ══════════════════════════════════════════════════════════════
//  Editor — Canvas Logic (ported from editor_component)
// ══════════════════════════════════════════════════════════════

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.src = src;
  });
}

async function initEditor() {
  if (!currentResultDataUrl || !currentSourceDataUrl) return;

  // Clear undo/redo history on editor initialization
  undoStack = [];
  redoStack = [];

  const rImg = await loadImg(currentResultDataUrl);
  const oImg = await loadImg(currentSourceDataUrl);

  editorImgW = rImg.width;
  editorImgH = rImg.height;

  // Use the actual container dimensions to match the static image scale perfectly
  // We subtract a small amount (2px) to account for borders and avoid sub-pixel jump
  const rect = editorWrap.getBoundingClientRect();
  const maxW = rect.width - 2;
  const maxH = rect.height - 2;

  editorScale = Math.min(1, maxW / editorImgW, maxH / editorImgH);

  editorCanvas.width = Math.round(editorImgW * editorScale);
  editorCanvas.height = Math.round(editorImgH * editorScale);

  // Ensure visual dimensions match pixel dimensions for 1:1 crispness
  editorCanvas.style.width = editorCanvas.width + "px";
  editorCanvas.style.height = editorCanvas.height + "px";

  // Offscreen canvases at full resolution (result size)
  const offResult = new OffscreenCanvas(editorImgW, editorImgH);
  const offOriginal = new OffscreenCanvas(editorImgW, editorImgH);
  offResult.getContext("2d").drawImage(rImg, 0, 0);
  // Resize original to match result dimensions
  offOriginal.getContext("2d").drawImage(oImg, 0, 0, editorImgW, editorImgH);

  editorResultData = offResult.getContext("2d").getImageData(0, 0, editorImgW, editorImgH);
  editorOriginalData = offOriginal.getContext("2d").getImageData(0, 0, editorImgW, editorImgH);

  // ALWAYS initialize editorRemovedData from the model's first result
  const mImg = await loadImg(modelResultDataUrl);
  const offModel = new OffscreenCanvas(editorImgW, editorImgH);
  offModel.getContext("2d").drawImage(mImg, 0, 0);
  editorRemovedData = offModel.getContext("2d").getImageData(0, 0, editorImgW, editorImgH);

  drawEditorCanvas();
}

function drawEditorCanvas() {
  ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  // Draw original faintly behind if showBg is on
  if (showBg && editorOriginalData) {
    const offBg = new OffscreenCanvas(editorImgW, editorImgH);
    offBg.getContext("2d").putImageData(editorOriginalData, 0, 0);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(offBg, 0, 0, editorCanvas.width, editorCanvas.height);
    ctx.globalAlpha = 1.0;
  }
  const off = new OffscreenCanvas(editorImgW, editorImgH);
  off.getContext("2d").putImageData(editorResultData, 0, 0);
  ctx.drawImage(off, 0, 0, editorCanvas.width, editorCanvas.height);
}

function applyBrush(cx, cy) {
  const ix = cx / editorScale;
  const iy = cy / editorScale;
  const r = brushRadius / editorScale;
  const r2 = r * r;

  const x0 = Math.max(0, Math.floor(ix - r));
  const x1 = Math.min(editorImgW - 1, Math.ceil(ix + r));
  const y0 = Math.max(0, Math.floor(iy - r));
  const y1 = Math.min(editorImgH - 1, Math.ceil(iy + r));

  const rd = editorResultData.data;
  const od = editorOriginalData.data;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - ix, dy = y - iy;
      if (dx * dx + dy * dy <= r2) {
        const i = (y * editorImgW + x) * 4;
        if (editorMode === "erase") {
          rd[i + 3] = 0;
        } else {
          rd[i] = od[i];
          rd[i + 1] = od[i + 1];
          rd[i + 2] = od[i + 2];
          rd[i + 3] = od[i + 3];
        }
      }
    }
  }
}

function applyBrushLine(from, to) {
  // Interpolate between two points so fast strokes are continuous
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Step size = half the brush radius (in display coords) for smooth coverage
  const step = Math.max(1, brushRadius * 0.3);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    applyBrush(from.x + dx * t, from.y + dy * t);
  }
}

function getCanvasPos(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

// ── Mouse events ──
editorCanvas.addEventListener("mousemove", (e) => {
  if (!editorResultData) return;
  const p = getCanvasPos(e);
  currentMousePos = p;
  if (drawing) {
    if (lastPos) {
      applyBrushLine(lastPos, p);
    } else {
      applyBrush(p.x, p.y);
    }
    lastPos = p;
  }
  drawEditorCanvas();
  // Draw cursor preview
  ctx.beginPath();
  ctx.arc(p.x, p.y, brushRadius, 0, Math.PI * 2);
  ctx.strokeStyle = editorMode === "erase" ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
});

editorCanvas.addEventListener("mousedown", (e) => {
  if (!editorResultData) return;
  saveEditorState();
  drawing = true;
  const p = getCanvasPos(e);
  lastPos = p;
  applyBrush(p.x, p.y);
  drawEditorCanvas();
});

editorCanvas.addEventListener("mouseup", () => { drawing = false; lastPos = null; });
editorCanvas.addEventListener("mouseleave", () => {
  drawing = false;
  lastPos = null;
  if (editorResultData) drawEditorCanvas();
});

// ── Touch events ──
editorCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (!editorResultData) return;
  saveEditorState();
  drawing = true;
  const p = getCanvasPos(e);
  lastPos = p;
  applyBrush(p.x, p.y);
  drawEditorCanvas();
}, { passive: false });

editorCanvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!editorResultData || !drawing) return;
  const p = getCanvasPos(e);
  if (lastPos) {
    applyBrushLine(lastPos, p);
  } else {
    applyBrush(p.x, p.y);
  }
  lastPos = p;
  drawEditorCanvas();
}, { passive: false });

editorCanvas.addEventListener("touchend", () => { drawing = false; lastPos = null; });

// ── Undo / Redo System ──
function saveEditorState() {
  if (!editorResultData) return;
  const dataCopy = new Uint8ClampedArray(editorResultData.data);
  undoStack.push(dataCopy);
  if (undoStack.length > 30) {
    undoStack.shift();
  }
  redoStack = [];
}

function undo() {
  if (!editorResultData || undoStack.length === 0) return;
  const currentState = new Uint8ClampedArray(editorResultData.data);
  redoStack.push(currentState);
  
  const prevState = undoStack.pop();
  editorResultData.data.set(prevState);
  drawEditorCanvas();
}

function redo() {
  if (!editorResultData || redoStack.length === 0) return;
  const currentState = new Uint8ClampedArray(editorResultData.data);
  undoStack.push(currentState);
  
  const nextState = redoStack.pop();
  editorResultData.data.set(nextState);
  drawEditorCanvas();
}

// Keydown listener for Cmd+Z / Cmd+Shift+Z / Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
document.addEventListener("keydown", (e) => {
  if (!editToggle.checked) return;

  const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z";
  const isRedo = (e.metaKey || e.ctrlKey) && (
    (e.shiftKey && e.key.toLowerCase() === "z") || 
    e.key.toLowerCase() === "y"
  );

  if (isUndo) {
    e.preventDefault();
    undo();
  } else if (isRedo) {
    e.preventDefault();
    redo();
  }
});

// ── Option(Alt) + Scroll to change brush size ──
// (Cmd+scroll bị Chrome chặn để zoom, nên dùng Option/Alt)
editorCanvas.addEventListener("wheel", (e) => {
  if (!e.altKey) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -3 : 3;
  brushRadius = Math.max(5, Math.min(100, brushRadius + delta));
  brushSlider.value = brushRadius;
  brushVal.textContent = brushRadius;
  if (editorResultData) {
    drawEditorCanvas();
    // Vẽ cursor preview đúng size mới
    if (currentMousePos) {
      ctx.beginPath();
      ctx.arc(currentMousePos.x, currentMousePos.y, brushRadius, 0, Math.PI * 2);
      ctx.strokeStyle = editorMode === "erase" ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}, { passive: false });

// ── Tool buttons ──
btnErase.addEventListener("click", () => {
  editorMode = "erase";
  btnErase.className = "tool-btn active-erase";
  btnRestore.className = "tool-btn";
  showBg = false;
  btnShowBg.className = "tool-btn";
  if (editorResultData) drawEditorCanvas();
});

btnRestore.addEventListener("click", () => {
  editorMode = "restore";
  btnRestore.className = "tool-btn active-restore";
  btnErase.className = "tool-btn";
  showBg = true;
  btnShowBg.className = "tool-btn active-showbg";
  if (editorResultData) drawEditorCanvas();
});

btnShowBg.addEventListener("click", () => {
  showBg = !showBg;
  btnShowBg.className = showBg ? "tool-btn active-showbg" : "tool-btn";
  if (editorResultData) drawEditorCanvas();
});

brushSlider.addEventListener("input", () => {
  brushRadius = parseInt(brushSlider.value);
  brushVal.textContent = brushRadius;
});

// ── Reset ──
btnEditorReset.addEventListener("click", () => {
  if (editorRemovedData) {
    editorResultData = new ImageData(
      new Uint8ClampedArray(editorRemovedData.data),
      editorImgW, editorImgH
    );
    drawEditorCanvas();
  }
});

function applyEditsToResult() {
  if (!editorResultData) return;

  const off = new OffscreenCanvas(editorImgW, editorImgH);
  off.getContext("2d").putImageData(editorResultData, 0, 0);

  off.convertToBlob({ type: "image/png" }).then((blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Update result display
      const dataUrl = reader.result;
      currentResultDataUrl = dataUrl;
      resultImg.src = dataUrl;
      currentResultB64 = dataUrl.split(",")[1];

      // Update stats with new size
      const sizeKb = (currentResultB64.length * 3 / 4) / 1024;
      statSize.textContent = `💾 ${sizeKb.toFixed(0)} KB`;
      statDim.textContent = `📐 ${editorImgW}×${editorImgH}`;
      saveState();
    };
    reader.readAsDataURL(blob);
  });
}


// ══════════════════════════════════════════════════════════════
//  Copy & Download — Always use the CURRENT image state
// ══════════════════════════════════════════════════════════════

/**
 * Returns a PNG Blob of the current image.
 * If the editor is active, grabs live canvas data.
 * Otherwise, uses the stored result.
 */
async function getCurrentImageBlob() {
  // If editor is active, export from the live canvas data
  if (editToggle.checked && editorResultData) {
    const off = new OffscreenCanvas(editorImgW, editorImgH);
    off.getContext("2d").putImageData(editorResultData, 0, 0);
    return await off.convertToBlob({ type: "image/png" });
  }

  // Otherwise, use stored base64
  if (!currentResultB64) return null;
  const binary = atob(currentResultB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

btnCopy.addEventListener("click", async () => {
  const blob = await getCurrentImageBlob();
  if (!blob) return;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    showToast("✅ Đã copy vào clipboard!");
  } catch (err) {
    showToast(`❌ ${err.message}`, true);
  }
});

btnDownload.addEventListener("click", async () => {
  const blob = await getCurrentImageBlob();
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "no_bg.png";
  link.click();
  URL.revokeObjectURL(url);
  showToast("✅ Đã tải xuống!");
});

