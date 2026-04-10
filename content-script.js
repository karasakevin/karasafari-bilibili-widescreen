(() => {
  // 防止在同一页面里被重复注入导致报错/抖动
  //（例如扩展被“重新加载”、页面是 SPA、或被插入到多个 frame）
  if (window.__KARASAFARI_BILI_AUTO_WIDE__) return;
  window.__KARASAFARI_BILI_AUTO_WIDE__ = true;

  // 只在哔哩哔哩域名上工作（matches 已限制，这里再保险一次）
  const host = location.hostname || "";
  if (!(host.endsWith("bilibili.com") || host.endsWith("bilibili.tv"))) return;

  // 更精准：优先用 bpx 播放器的 “进入宽屏” 按钮（避免点到“退出宽屏”造成来回切换）
  const ENTER_WIDE_SELECTORS = [
    "div.bpx-player-ctrl-btn-icon.bpx-player-ctrl-wide-enter > span",
    "div.bpx-player-ctrl-btn-icon.bpx-player-ctrl-wide-enter",
    // 旧版播放器（部分页面/老样式）
    ".bilibili-player-video-btn-widescreen",
    ".bilibili-player-video-control-widescreen",
    // 兜底：某些页面可能把“宽屏”做成带文本/aria 的按钮
    "[aria-label*='宽屏']",
    "button[title*='宽屏']",
    "div[title*='宽屏']"
  ];

  const EXIT_WIDE_SELECTORS = [
    "div.bpx-player-ctrl-btn-icon.bpx-player-ctrl-wide-exit > span",
    "div.bpx-player-ctrl-btn-icon.bpx-player-ctrl-wide-exit"
  ];

  const isActiveWide = (el) => {
    if (!el) return false;
    const pressed = el.getAttribute("aria-pressed");
    if (pressed === "true") return true;
    return el.classList.contains("active") || el.classList.contains("on") || el.classList.contains("selected");
  };

  const isVisible = (el) => {
    if (!el) return false;
    // 过滤掉 display:none / visibility:hidden / 不在布局流中的元素
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect) return false;
    return rect.width > 0 && rect.height > 0;
  };

  const findEnterWideButton = () => {
    for (const sel of ENTER_WIDE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  };

  const isCurrentlyWide = () => {
    // 先看“退出宽屏”按钮是否可见（最可靠）
    for (const sel of EXIT_WIDE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return true;
    }
    // 有些旧版按钮会带 active/on
    const enterBtn = findEnterWideButton();
    if (enterBtn && isActiveWide(enterBtn)) return true;

    // 再看页面 class（兜底，不同版本可能不一致）
    const html = document.documentElement;
    const body = document.body;
    const cls = (html?.className || "") + " " + (body?.className || "");
    return /wide|widescreen|web-widescreen|mode_wide|player-wide/i.test(cls);
  };

  let lastTryAt = 0;
  let lastVideoKey = "";
  let hasAppliedForVideoKey = "";

  const currentVideoKey = () => {
    const v = document.querySelector("video");
    if (!v) return "";
    // 用 src/currentSrc + duration 组合一个“这个视频”的标识，避免重复触发导致反复切换
    const src = v.currentSrc || v.src || "";
    const dur = Number.isFinite(v.duration) ? String(v.duration) : "";
    return `${src}|${dur}`;
  };

  const applyWidescreenOnce = () => {
    const tNow = Date.now();
    if (tNow - lastTryAt < 200) return;
    lastTryAt = tNow;

    const key = currentVideoKey();
    if (key && key !== lastVideoKey) {
      lastVideoKey = key;
      hasAppliedForVideoKey = "";
    }
    if (key && hasAppliedForVideoKey === key) return;

    const btn = findEnterWideButton();
    if (!btn) return;

    try {
      // 不管点击后状态如何变化，都认为“这个视频我们只尝试一次”
      // 这样可以彻底避免由于按钮/DOM 抖动导致的反复宽屏/退出宽屏。
      btn.click();
      if (key) hasAppliedForVideoKey = key;
    } catch (_) {
      // ignore
    }
  };

  const scheduleApplyWindow = (ms) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const v = document.querySelector("video");
      if (!v) return;
      // 如果暂停/停止就结束
      if (v.paused) {
        clearInterval(timer);
        return;
      }
      const key = currentVideoKey();
      if (key && hasAppliedForVideoKey === key) {
        clearInterval(timer);
        return;
      }
      if (Date.now() - startedAt > ms) {
        clearInterval(timer);
        return;
      }
      applyWidescreenOnce();
    }, 120);
  };

  const onPlay = () => {
    // 播放发生时，按钮可能后渲染：给一个 3 秒轮询窗口，但“只会尝试一次”
    scheduleApplyWindow(3000);
  };

  // 捕获阶段监听，确保能捕到 video 的 play
  document.addEventListener("play", onPlay, true);

  // 轻量兜底：播放中如果切集/切清晰度导致播放器重建，会再次触发 play
})();

