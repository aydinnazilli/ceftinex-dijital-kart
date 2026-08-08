/**
 * Bilim İlaç — Ceftinex E-Detailing SPA  v1.1
 * main.js | Analytics, Chart Rendering, MOA Modal, Rep Card, UX Logic
 *
 * Görevler:
 *  1. Ziyaret süresi takibi  (beforeunload → /api/log-duration)
 *  2. Etkileşim loglama       (her tıklama → /api/log-interaction)
 *  3. Chart.js ile 3 grafik  (Etkinlik, Tolerabilite, Uyum)
 *  4. Chart sekme geçişi + backend ping
 *  5. MOA Modal aç/kapa       (Play butonu)
 *  6. Sticky Temsilci Kartı   (WhatsApp / Arama / Mail)
 *  7. Scroll reveal animasyonu
 *  8. Ripple efekti
 *  9. Oturum sayacı (sağ alt köşe)
 */

"use strict";

// ---------------------------------------------------------------------------
// 1. TEMEL DEĞİŞKENLER
// ---------------------------------------------------------------------------
const SESSION_ID  = document.body.dataset.session || "unknown";
const DEVICE_TYPE = document.body.dataset.device  || "desktop";
const PAGE_START  = Date.now();

// ---------------------------------------------------------------------------
// 2. BACKEND API YARDIMCISI
// ---------------------------------------------------------------------------
/**
 * Backend'e POST isteği gönder.
 * @param {string}  endpoint   - API yolu
 * @param {object}  payload    - JSON gövdesi
 * @param {boolean} useBeacon  - navigator.sendBeacon kullan
 */
async function postToAPI(endpoint, payload, useBeacon = false) {
  const body = JSON.stringify({ session_id: SESSION_ID, ...payload });

  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    return navigator.sendBeacon(endpoint, blob);
  }

  try {
    await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch (err) {
    console.warn("[EDetail] API isteği başarısız:", err);
  }
}

// ---------------------------------------------------------------------------
// 3. SAYFA SÜRESİ LOGLAMA
// ---------------------------------------------------------------------------
function setupDurationLogging() {
  let sent = false; // Tek gönderim garantisi
  const sendDuration = () => {
    if (sent) return;
    sent = true;
    const durationSec = parseFloat(((Date.now() - PAGE_START) / 1000).toFixed(2));
    postToAPI("/api/log-duration", { duration_sec: durationSec }, true);
  };
  window.addEventListener("beforeunload", sendDuration);
  window.addEventListener("pagehide",     sendDuration); // iOS Safari
}

// ---------------------------------------------------------------------------
// 4. TIKLAMA LOGLAMA
// ---------------------------------------------------------------------------
/**
 * Element tıklamalarını izle ve backend'e logla.
 * data-track-id niteliği varsa onu, yoksa id'yi kullan.
 */
function trackInteraction(el) {
  if (!el) return;
  el.addEventListener("click", () => {
    const elementId = el.dataset.trackId || el.id || "unknown-element";
    postToAPI("/api/log-interaction", {
      element_id:    elementId,
      element_label: el.textContent.trim().slice(0, 80),
    });
    if (el.tagName === "BUTTON") triggerRipple(el);
  });
}

function setupInteractionTracking() {
  document.querySelectorAll("button[id]").forEach(trackInteraction);
  document.querySelectorAll("a[data-track-id]").forEach(trackInteraction);
  document.querySelectorAll(".benefit-card[id]").forEach(trackInteraction);
  document.querySelectorAll(".indication-item[id]").forEach(trackInteraction);
}

// ---------------------------------------------------------------------------
// 5. RİPPLE EFEKTİ
// ---------------------------------------------------------------------------
function triggerRipple(el) {
  el.classList.remove("btn-ripple");
  void el.offsetWidth;
  el.classList.add("btn-ripple");
  setTimeout(() => el.classList.remove("btn-ripple"), 700);
}

// ---------------------------------------------------------------------------
// 6. CHART.JS GRAFİKLERİ
// ---------------------------------------------------------------------------
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.color       = "#475569";

const C_NAVY   = "#1D4ED8";
const C_TEAL   = "#14B8A6";
const C_GRAY   = "#94A3B8";
const C_RED_L  = "#FCA5A5";

/** Etkinlik Kıyaslama (Bar) */
function renderEfficacyChart() {
  const ctx = document.getElementById("chart-efficacy");
  if (!ctx || ctx._chartInstance) return;
  ctx._chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Klinik Kür Oranı", "Bakteriyolojik Kür", "Semptom Çözümü", "Relaps Yok"],
      datasets: [
        {
          label: "Ceftinex® 600 mg",
          data: [96.8, 94.2, 88.5, 97.3],
          backgroundColor: C_NAVY,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Amoksisilin-Klavulanat",
          data: [89.1, 86.7, 80.3, 91.2],
          backgroundColor: C_GRAY,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end" },
        title: {
          display: true,
          text: "Klinik Etkinlik (%) — Ceftinex® 600 mg vs Karşılaştırıcı  [Ref. 2]",
          font: { size: 12, weight: "600" },
        },
        tooltip: {
          callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` },
        },
      },
      scales: {
        y: {
          min: 70, max: 100,
          ticks: { callback: v => v + "%" },
          grid:  { color: "rgba(0,0,0,.06)" },
          title: { display: true, text: "Başarı Oranı (%)" },
        },
        x: { grid: { display: false } },
      },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });
}

/** Tolerabilite / Yan Etki (Horizontal Bar) */
function renderSideEffectsChart() {
  const ctx = document.getElementById("chart-side-effects");
  if (!ctx || ctx._chartInstance) return;
  ctx._chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Diyare", "Bulantı", "Döküntü", "Baş Ağrısı", "Karın Ağrısı"],
      datasets: [
        {
          label: "Ceftinex® 500 mg",
          data: [4.2, 3.1, 1.8, 2.5, 2.0],
          backgroundColor: C_TEAL,
          borderRadius: 6,
        },
        {
          label: "Karşılaştırıcı",
          data: [8.7, 6.4, 3.2, 4.1, 3.8],
          backgroundColor: C_RED_L,
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end" },
        title: {
          display: true,
          text: "Yan Etki İnsidansı (%)  [Ref. 2]",
          font: { size: 12, weight: "600" },
        },
        tooltip: {
          callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` },
        },
      },
      scales: {
        x: {
          max: 12,
          ticks: { callback: v => v + "%" },
          grid:  { color: "rgba(0,0,0,.06)" },
          title: { display: true, text: "İnsidans (%)" },
        },
        y: { grid: { display: false } },
      },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });
}

/** Hasta Uyumu (Doughnut) */
function renderAdherenceChart() {
  const ctx = document.getElementById("chart-adherence");
  if (!ctx || ctx._chartInstance) return;
  ctx._chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Tedaviyi Tamamlayan", "Erken Bırakan", "Doz Atlayan"],
      datasets: [{
        label: "Hasta Dağılımı (%)",
        data: [94.2, 3.4, 2.4],
        backgroundColor: [C_NAVY, C_RED_L, C_GRAY],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom" },
        title: {
          display: true,
          text: "Hasta Tedavi Uyumu — Ceftinex® 600 mg (n=210)  [Ref. 3]",
          font: { size: 12, weight: "600" },
        },
        tooltip: {
          callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}%` },
        },
      },
      animation: { animateRotate: true, duration: 900, easing: "easeOutQuart" },
    },
  });
}

// ---------------------------------------------------------------------------
// 7. CHART SEKME YÖNETİMİ + BACKEND LOGLAMA
// ---------------------------------------------------------------------------
/**
 * Tab geçişlerini yönet ve her geçişi backend'e logla.
 * "Tolerabilite" sekmesi tıklandıktan sonraki kalma süresi analiz edilebilir.
 */
function setupChartTabs() {
  const tabs   = document.querySelectorAll(".chart-tab");
  const panels = document.querySelectorAll(".chart-panel");

  /** Hangi panel aktif? */
  let activePanel    = "efficacy";
  let panelEnterTime = Date.now();

  function switchTab(tab) {
    const target = tab.dataset.panel;
    if (target === activePanel) return;

    // Önceki panelde geçirilen süreyi logla (backend insight: hekim ne izliyor?)
    const dwellSec = parseFloat(((Date.now() - panelEnterTime) / 1000).toFixed(2));
    postToAPI("/api/log-interaction", {
      element_id:    `tab-dwell-${activePanel}`,
      element_label: `Panel '${activePanel}' üzerinde ${dwellSec}s geçirildi`,
    });

    activePanel    = target;
    panelEnterTime = Date.now();

    // Tab durumlarını güncelle
    tabs.forEach(t => {
      t.classList.remove("chart-tab--active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("chart-tab--active");
    tab.setAttribute("aria-selected", "true");

    // Panel görünürlüğü
    panels.forEach(p => p.classList.add("d-none"));
    const panel = document.getElementById(`panel-${target}`);
    if (panel) panel.classList.remove("d-none");

    // Lazy render
    if (target === "efficacy")     renderEfficacyChart();
    if (target === "side-effects") renderSideEffectsChart();
    if (target === "adherence")    renderAdherenceChart();

    // Tab tıklamasını logla (anında)
    postToAPI("/api/log-interaction", {
      element_id:    `tab-${target}`,
      element_label: tab.textContent.trim(),
    });
  }

  tabs.forEach(tab => tab.addEventListener("click", () => switchTab(tab)));
}

// ---------------------------------------------------------------------------
// 8. MOA MODAL (Etki Mekanizması)
// ---------------------------------------------------------------------------
function setupMOAModal() {
  const modal    = document.getElementById("moa-modal");
  const backdrop = document.getElementById("moa-backdrop");
  const btnOpen  = document.getElementById("btn-play-moa");
  const btnHint  = document.getElementById("btn-play-hint"); // alias
  const btnClose = document.getElementById("btn-close-modal");
  if (!modal || !btnOpen) return;

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    btnClose && btnClose.focus();
    postToAPI("/api/log-interaction", {
      element_id:    "btn-play-moa",
      element_label: "MOA Modal Açıldı",
    });
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    btnOpen.focus();
    postToAPI("/api/log-interaction", {
      element_id:    "btn-close-modal",
      element_label: "MOA Modal Kapatıldı",
    });
  }

  btnOpen.addEventListener("click",   openModal);
  btnHint && btnHint.addEventListener("click", openModal); // hint button de MOA açar
  btnClose  && btnClose.addEventListener("click",  closeModal);
  backdrop  && backdrop.addEventListener("click",  closeModal);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });
}

// ---------------------------------------------------------------------------
// 8b. INFO MODALLARI (Klinik Çalışma + Reçeteleme Bilgisi)
// ---------------------------------------------------------------------------
/**
 * data-modal="<id>" nitelilikli her butona listener ekler.
 * Modal'ları data-close-modal ile kapatan elementleri de dinler.
 */
function setupInfoModals() {
  // Açıcı butonlar: data-modal="modal-id"
  document.querySelectorAll("[data-modal]").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const modalId = trigger.dataset.modal;
      openInfoModal(modalId);
      postToAPI("/api/log-interaction", {
        element_id:    trigger.id || `open-${modalId}`,
        element_label: `${modalId} açıldı`,
      });
    });
  });

  // Kapatma butonları ve backdrop: data-close-modal="modal-id"
  document.querySelectorAll("[data-close-modal]").forEach(closer => {
    closer.addEventListener("click", () => {
      const modalId = closer.dataset.closeModal;
      closeInfoModal(modalId);
    });
  });

  // ESC tuşu — açık olan info-modal'ı kapat
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".info-modal.is-open").forEach(m => {
      closeInfoModal(m.id);
    });
  });

  // Modal içindeki CTA linklerini de logla
  document.querySelectorAll(".info-modal-cta[data-track-id]").forEach(trackInteraction);
}

function openInfoModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  // İlk fokuslanabilir elementi odakla
  const focusable = modal.querySelector("button, [href], input");
  setTimeout(() => focusable && focusable.focus(), 80);
}

function closeInfoModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  // Başka açık modal yoksa scroll'u geri ver
  if (!document.querySelector(".info-modal.is-open, .moa-modal.is-open")) {
    document.body.style.overflow = "";
  }
}

// ---------------------------------------------------------------------------
// 9. STİCKY TEMSİLCİ KARTI TOGGLE
// ---------------------------------------------------------------------------
function setupRepCard() {
  const toggle = document.getElementById("rep-card-toggle");
  const body   = document.getElementById("rep-card-body");
  if (!toggle || !body) return;

  toggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen.toString());
    // Loglama
    postToAPI("/api/log-interaction", {
      element_id:    "rep-card-toggle",
      element_label: isOpen ? "Temsilci kartı açıldı" : "Temsilci kartı kapatıldı",
    });
  });

  // Sayfa yüklendikten 2sn sonra kartı otomatik aç (dikkat çekici UX)
  setTimeout(() => {
    if (!body.classList.contains("is-open")) {
      body.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }
  }, 2000);
}

// ---------------------------------------------------------------------------
// 10. SCROLL REVEAL ANİMASYONU
// ---------------------------------------------------------------------------
function setupScrollReveal() {
  const targets = [
    ...document.querySelectorAll(".benefit-card"),
    ...document.querySelectorAll(".indication-item"),
    ...document.querySelectorAll(".section-header"),
    ...document.querySelectorAll(".dosage-card"),
    document.querySelector(".chart-container-wrap"),
  ].filter(Boolean);

  targets.forEach((el, i) => {
    el.classList.add("reveal");
    if (i % 3 === 1) el.classList.add("reveal-delay-1");
    if (i % 3 === 2) el.classList.add("reveal-delay-2");
  });

  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  targets.forEach(el => io.observe(el));
}

// ---------------------------------------------------------------------------
// 11. OTURUM SAYACI (sağ alt köşe)
// ---------------------------------------------------------------------------
function startSessionTimer() {
  // Sayacı rep-card'ın sol tarafına değil body'e ekle, rep-card'ı geçmeyecek şekilde
  const timerEl = document.createElement("div");
  timerEl.setAttribute("role", "status");
  timerEl.setAttribute("aria-live", "off");
  timerEl.setAttribute("aria-label", "Oturum süresi");
  timerEl.style.cssText = `
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    font-size: .62rem;
    background: rgba(11,30,74,.85);
    color: rgba(255,255,255,.5);
    padding: .3rem .65rem;
    border-radius: 999px;
    font-family: monospace;
    z-index: 7999;
    pointer-events: none;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `;
  document.body.appendChild(timerEl);

  setInterval(() => {
    const sec = Math.floor((Date.now() - PAGE_START) / 1000);
    const m   = String(Math.floor(sec / 60)).padStart(2, "0");
    const s   = String(sec % 60).padStart(2, "0");
    timerEl.textContent = `⏱ ${m}:${s}`;
  }, 1000);
}

// ---------------------------------------------------------------------------
// 12. BAŞLATMA
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupDurationLogging();
  setupInteractionTracking();

  // Grafikler
  renderEfficacyChart();
  setupChartTabs();

  // UI Bileşenleri
  setupMOAModal();
  setupInfoModals(); // Klinik + Reçeteleme modalleri
  setupRepCard();

  // UX
  setupScrollReveal();
  startSessionTimer();

  console.info(
    `%c[EDetail v1.2] Oturum: ${SESSION_ID} | Cihaz: ${DEVICE_TYPE}`,
    "color:#60A5FA;font-weight:bold;background:#0B1E4A;padding:4px 8px;border-radius:4px;"
  );
});
