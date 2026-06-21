// وضعیت فعلی VPN
let isConnected = false;
let currentServer = null;

// بارگذاری لیست سرورها از فایل JSON
async function loadServers() {
  try {
    const response = await fetch(chrome.runtime.getURL('servers.json'));
    const data = await response.json();
    return data.servers;
  } catch (error) {
    console.error('خطا در بارگذاری سرورها:', error);
    return [];
  }
}

// فعال‌سازی VPN با سرور انتخاب شده
async function enableVPN(server) {
  try {
    // تنظیم پروکسی
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: server.scheme || "http",
          host: server.host,
          port: server.port
        },
        bypassList: ["localhost", "127.0.0.1"]
      }
    };

    await chrome.proxy.settings.set({
      value: config,
      scope: 'regular'
    });

    // ذخیره وضعیت
    isConnected = true;
    currentServer = server;
    await chrome.storage.local.set({ 
      vpnStatus: 'connected',
      currentServer: server 
    });

    console.log(`✅ VPN فعال شد: ${server.name}`);
    return true;
  } catch (error) {
    console.error('❌ خطا در فعال‌سازی VPN:', error);
    return false;
  }
}

// غیرفعال‌سازی VPN
async function disableVPN() {
  try {
    // بازگشت به تنظیمات پیش‌فرض
    await chrome.proxy.settings.clear({
      scope: 'regular'
    });

    isConnected = false;
    currentServer = null;
    await chrome.storage.local.set({ 
      vpnStatus: 'disconnected',
      currentServer: null 
    });

    console.log('✅ VPN غیرفعال شد');
    return true;
  } catch (error) {
    console.error('❌ خطا در غیرفعال‌سازی VPN:', error);
    return false;
  }
}

// دریافت وضعیت فعلی
async function getStatus() {
  const result = await chrome.storage.local.get(['vpnStatus', 'currentServer']);
  return {
    isConnected: result.vpnStatus === 'connected',
    server: result.currentServer || null
  };
}

// گوش دادن به پیام‌های popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getServers':
          const servers = await loadServers();
          sendResponse({ success: true, servers });
          break;

        case 'connect':
          const server = request.server;
          if (!server) {
            sendResponse({ success: false, error: 'سرور انتخاب نشده' });
            return;
          }
          const connected = await enableVPN(server);
          sendResponse({ success: connected, server });
          break;

        case 'disconnect':
          const disconnected = await disableVPN();
          sendResponse({ success: disconnected });
          break;

        case 'getStatus':
          const status = await getStatus();
          sendResponse({ success: true, ...status });
          break;

        default:
          sendResponse({ success: false, error: 'درخواست نامعتبر' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // برای پاسخ async
});

// نمایش وضعیت در کنسول هنگام نصب
chrome.runtime.onInstalled.addListener(() => {
  console.log('🛡️ افزونه VPN نصب شد!');
  chrome.storage.local.set({ vpnStatus: 'disconnected' });
});
