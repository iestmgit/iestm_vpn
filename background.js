// وضعیت فعلی VPN
let isConnected = false;
let currentServer = null;
let cachedServers = [];

// ============================================
// دریافت لیست سرورها از منابع آنلاین
// ============================================
async function loadServersFromOnline() {
  try {
    console.log('🔄 در حال دریافت لیست سرورها از اینترنت...');
    
    // استفاده از ProxyScrape - لیست HTTP/HTTPS پروکسی‌ها
    const response = await fetch('https://cdn.jsdelivr.net/gh/proxyscrape/free-proxy-list@main/proxies/protocols/http/data.json');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ ${data.length} سرور از اینترنت دریافت شد`);
    
    // تبدیل داده‌ها به فرمت مورد نیاز افزونه
    const servers = data.map((proxy, index) => {
      // تشخیص پروتکل
      let scheme = 'http';
      if (proxy.protocol && proxy.protocol.includes('https')) {
        scheme = 'https';
      } else if (proxy.protocol && proxy.protocol.includes('socks')) {
        scheme = 'socks5'; // کروم از socks5 پشتیبانی می‌کند
      }
      
      // ساخت نام مناسب
      let name = `${proxy.country || 'Unknown'} (${proxy.protocol || 'http'})`;
      if (proxy.city) {
        name = `${proxy.city}, ${proxy.country || 'Unknown'}`;
      }
      
      return {
        id: index + 1,
        name: name,
        host: proxy.ip || proxy.host,
        port: parseInt(proxy.port) || 8080,
        scheme: scheme,
        country: proxy.country_code || proxy.country || 'XX',
        city: proxy.city || '',
        latency: proxy.latency || 0,
        uptime: proxy.uptime || 0
      };
    });
    
    // فیلتر کردن سرورهای معتبر (با IP و پورت معتبر)
    const validServers = servers.filter(s => 
      s.host && s.port && s.port > 0 && s.port < 65535
    );
    
    // ذخیره در کش
    cachedServers = validServers;
    
    // همچنین در storage ذخیره شود تا در popup سریعتر بارگذاری شود
    await chrome.storage.local.set({ 
      cachedServers: validServers,
      lastUpdate: Date.now()
    });
    
    console.log(`✅ ${validServers.length} سرور معتبر آماده استفاده هستند`);
    return validServers;
    
  } catch (error) {
    console.error('❌ خطا در دریافت سرورها از اینترنت:', error);
    
    // اگر خطا داشت، از کش استفاده کن
    const result = await chrome.storage.local.get(['cachedServers']);
    if (result.cachedServers && result.cachedServers.length > 0) {
      console.log('📦 استفاده از سرورهای کش شده');
      cachedServers = result.cachedServers;
      return cachedServers;
    }
    
    // اگر هیچ چیزی نبود، لیست پیش‌فرض بازگشت
    return getDefaultServers();
  }
}

// ============================================
// لیست پیش‌فرض (در صورت عدم دسترسی به اینترنت)
// ============================================
function getDefaultServers() {
  return [
    {
      id: 1,
      name: 'USA - New York (Default)',
      host: 'us-ny.proxy.example.com',
      port: 8080,
      scheme: 'http',
      country: 'US'
    },
    {
      id: 2,
      name: 'UK - London (Default)',
      host: 'uk-london.proxy.example.com',
      port: 8080,
      scheme: 'http',
      country: 'UK'
    },
    {
      id: 3,
      name: 'Germany - Frankfurt (Default)',
      host: 'de-frankfurt.proxy.example.com',
      port: 8080,
      scheme: 'http',
      country: 'DE'
    }
  ];
}

// ============================================
// فعال‌سازی VPN
// ============================================
async function enableVPN(server) {
  try {
    if (!server || !server.host) {
      throw new Error('سرور نامعتبر');
    }
    
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: server.scheme || "http",
          host: server.host,
          port: server.port
        },
        bypassList: ["localhost", "127.0.0.1", "*.local"]
      }
    };

    await chrome.proxy.settings.set({
      value: config,
      scope: 'regular'
    });

    isConnected = true;
    currentServer = server;
    await chrome.storage.local.set({ 
      vpnStatus: 'connected',
      currentServer: server 
    });

    console.log(`✅ VPN فعال شد: ${server.name} (${server.host}:${server.port})`);
    return true;
    
  } catch (error) {
    console.error('❌ خطا در فعال‌سازی VPN:', error);
    return false;
  }
}

// ============================================
// غیرفعال‌سازی VPN
// ============================================
async function disableVPN() {
  try {
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

// ============================================
// دریافت وضعیت فعلی
// ============================================
async function getStatus() {
  const result = await chrome.storage.local.get(['vpnStatus', 'currentServer']);
  return {
    isConnected: result.vpnStatus === 'connected',
    server: result.currentServer || null
  };
}

// ============================================
// بررسی سلامت سرورها (Ping)
// ============================================
async function checkServerHealth(server) {
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 ثانیه تایم‌اوت
    
    const response = await fetch(`http://${server.host}:${server.port}`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors'
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    return {
      ...server,
      latency: latency,
      online: true
    };
    
  } catch (error) {
    return {
      ...server,
      latency: -1,
      online: false
    };
  }
}

// ============================================
// پیام‌های دریافتی از Popup
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        
        case 'getServers':
          // اگر سرورها در کش هستند و کمتر از 5 دقیقه از به‌روزرسانی گذشته
          const cached = await chrome.storage.local.get(['cachedServers', 'lastUpdate']);
          if (cached.cachedServers && cached.cachedServers.length > 0) {
            const elapsed = Date.now() - (cached.lastUpdate || 0);
            if (elapsed < 300000) { // 5 دقیقه
              sendResponse({ success: true, servers: cached.cachedServers });
              return;
            }
          }
          
          // وگرنه از اینترنت دریافت کن
          const servers = await loadServersFromOnline();
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
          
        case 'refreshServers':
          const newServers = await loadServersFromOnline();
          sendResponse({ success: true, servers: newServers });
          break;

        default:
          sendResponse({ success: false, error: 'درخواست نامعتبر' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});

// ============================================
// رویداد نصب افزونه
// ============================================
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🛡️ افزونه VPN نصب شد!');
  await chrome.storage.local.set({ vpnStatus: 'disconnected' });
  
  // بارگذاری اولیه سرورها در پس‌زمینه
  try {
    await loadServersFromOnline();
  } catch (error) {
    console.error('خطا در بارگذاری اولیه:', error);
  }
});

// ============================================
// به‌روزرسانی خودکار هر 10 دقیقه
// ============================================
setInterval(async () => {
  console.log('🔄 به‌روزرسانی خودکار سرورها...');
  await loadServersFromOnline();
}, 600000); // 10 دقیقه
