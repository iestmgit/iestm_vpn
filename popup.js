// ============================================
// مدیریت وضعیت
// ============================================
let currentStatus = {
  isConnected: false,
  server: null
};

let allServers = [];

// ============================================
// بارگذاری اولیه
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  showLoading('در حال بارگذاری سرورها...');
  await loadServers();
  await updateStatus();
  setupEventListeners();
  hideLoading();
});

// ============================================
// بارگذاری سرورها
// ============================================
async function loadServers() {
  try {
    const select = document.getElementById('serverSelect');
    select.innerHTML = '<option value="">⏳ در حال دریافت...</option>';
    select.disabled = true;

    const response = await chrome.runtime.sendMessage({ action: 'getServers' });
    
    if (response.success && response.servers && response.servers.length > 0) {
      allServers = response.servers;
      
      // پاک کردن گزینه‌ها
      select.innerHTML = '';
      
      // اضافه کردن گزینه پیش‌فرض
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '--- انتخاب کنید ---';
      select.appendChild(defaultOption);
      
      // اضافه کردن سرورها
      allServers.forEach(server => {
        const option = document.createElement('option');
        option.value = JSON.stringify(server);
        
        // نمایش کشور و نام
        let label = server.name || `${server.country} - ${server.host}`;
        if (server.latency && server.latency > 0) {
          label += ` (${server.latency}ms)`;
        }
        option.textContent = label;
        
        // اگر سرور آنلاین نباشد، خاکستری شود
        if (server.online === false) {
          option.style.color = '#999';
        }
        
        select.appendChild(option);
      });
      
      // نمایش تعداد سرورها
      document.getElementById('serverCount').textContent = `${allServers.length} سرور`;
      
      // بازیابی آخرین سرور انتخاب شده
      const saved = await chrome.storage.local.get(['selectedServer']);
      if (saved.selectedServer) {
        const savedServer = JSON.parse(saved.selectedServer);
        const index = allServers.findIndex(s => s.id === savedServer.id);
        if (index !== -1) {
          select.value = JSON.stringify(allServers[index]);
        }
      }
      
      select.disabled = false;
      console.log(`✅ ${allServers.length} سرور بارگذاری شد`);
      
    } else {
      throw new Error('هیچ سروری دریافت نشد');
    }
    
  } catch (error) {
    console.error('❌ خطا در بارگذاری سرورها:', error);
    const select = document.getElementById('serverSelect');
    select.innerHTML = '<option value="">❌ خطا در بارگذاری</option>';
    showError('خطا در بارگذاری سرورها');
  }
}

// ============================================
// به‌روزرسانی وضعیت
// ============================================
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    if (response.success) {
      currentStatus.isConnected = response.isConnected;
      currentStatus.server = response.server;
      updateUI();
    }
  } catch (error) {
    console.error('خطا در دریافت وضعیت:', error);
  }
}

// ============================================
// به‌روزرسانی UI
// ============================================
function updateUI() {
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const toggleBtn = document.getElementById('toggleButton');
  const connectionStatus = document.getElementById('connectionStatus');
  const serverInfo = document.getElementById('serverInfo');
  const serverSelect = document.getElementById('serverSelect');

  if (currentStatus.isConnected && currentStatus.server) {
    statusText.textContent = 'متصل';
    statusDot.className = 'status-dot connected';
    toggleBtn.textContent = '🔌 قطع اتصال';
    toggleBtn.className = 'btn-connect connected';
    connectionStatus.textContent = '✅ متصل';
    connectionStatus.style.color = '#4CAF50';
    
    // نمایش اطلاعات سرور
    serverInfo.style.display = 'block';
    document.getElementById('serverCountry').textContent = currentStatus.server.country || '-';
    document.getElementById('serverHost').textContent = `${currentStatus.server.host}:${currentStatus.server.port}`;
    document.getElementById('serverLatency').textContent = currentStatus.server.latency ? `${currentStatus.server.latency}ms` : 'نامشخص';
    
    // غیرفعال کردن انتخاب سرور
    serverSelect.disabled = true;
    
  } else {
    statusText.textContent = 'غیرفعال';
    statusDot.className = 'status-dot disconnected';
    toggleBtn.textContent = '🔗 اتصال';
    toggleBtn.className = 'btn-connect disconnected';
    connectionStatus.textContent = '❌ قطع';
    connectionStatus.style.color = '#f44336';
    serverInfo.style.display = 'none';
    serverSelect.disabled = false;
  }
}

// ============================================
// نمایش وضعیت بارگذاری
// ============================================
function showLoading(message) {
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  statusText.textContent = 'در حال بارگذاری...';
  statusDot.className = 'status-dot loading';
}

function hideLoading() {
  updateUI();
}

// ============================================
// نمایش پیام‌ها
// ============================================
function showError(message) {
  alert(`⚠️ ${message}`);
}

function showSuccess(message) {
  console.log(`✅ ${message}`);
}

// ============================================
// تنظیم رویدادها
// ============================================
function setupEventListeners() {
  
  // دکمه اتصال/قطع
  document.getElementById('toggleButton').addEventListener('click', async () => {
    try {
      if (currentStatus.isConnected) {
        // قطع اتصال
        const response = await chrome.runtime.sendMessage({ action: 'disconnect' });
        if (response.success) {
          await updateStatus();
          showSuccess('اتصال قطع شد');
        } else {
          showError('خطا در قطع اتصال');
        }
      } else {
        // اتصال
        const select = document.getElementById('serverSelect');
        const selectedValue = select.value;
        
        if (!selectedValue) {
          showError('لطفاً یک سرور انتخاب کنید');
          return;
        }
        
        const server = JSON.parse(selectedValue);
        
        // ذخیره سرور انتخاب شده
        await chrome.storage.local.set({ 
          selectedServer: JSON.stringify(server) 
        });
        
        const response = await chrome.runtime.sendMessage({ 
          action: 'connect', 
          server 
        });
        
        if (response.success) {
          await updateStatus();
          showSuccess(`متصل به ${server.name}`);
        } else {
          showError('خطا در اتصال به سرور');
        }
      }
    } catch (error) {
      console.error('خطا:', error);
      showError('خطای ناشناخته');
    }
  });
  
  // دکمه به‌روزرسانی سرورها
  document.getElementById('refreshButton').addEventListener('click', async () => {
    const btn = document.getElementById('refreshButton');
    btn.textContent = '⏳ در حال...';
    btn.disabled = true;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'refreshServers' });
      if (response.success) {
        allServers = response.servers;
        await loadServers();
        showSuccess('سرورها به‌روزرسانی شدند');
      } else {
        showError('خطا در به‌روزرسانی');
      }
    } catch (error) {
      showError('خطا در ارتباط با افزونه');
    } finally {
      btn.textContent = '🔄 به‌روزرسانی';
      btn.disabled = false;
    }
  });
  
  // دکمه تست سرور
  document.getElementById('testButton').addEventListener('click', async () => {
    const select = document.getElementById('serverSelect');
    const selectedValue = select.value;
    
    if (!selectedValue) {
      showError('لطفاً یک سرور انتخاب کنید');
      return;
    }
    
    const server = JSON.parse(selectedValue);
    const testBtn = document.getElementById('testButton');
    testBtn.textContent = '⏳ در حال تست...';
    testBtn.disabled = true;
    
    try {
      // تست با ارسال درخواست به خودمان
      const startTime = Date.now();
      const response = await fetch(`http://${server.host}:${server.port}`, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      const latency = Date.now() - startTime;
      
      showSuccess(`✅ تاخیر: ${latency}ms`);
      
      // به‌روزرسانی نمایش تاخیر
      const latencySpan = document.getElementById('serverLatency');
      if (latencySpan) {
        latencySpan.textContent = `${latency}ms`;
      }
      
    } catch (error) {
      showError('❌ سرور پاسخ نمی‌دهد');
    } finally {
      testBtn.textContent = '⚡ تست سرور';
      testBtn.disabled = false;
    }
  });
  
  // تغییر سرور
  document.getElementById('serverSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      const server = JSON.parse(e.target.value);
      document.getElementById('serverInfo').style.display = 'block';
      document.getElementById('serverCountry').textContent = server.country || '-';
      document.getElementById('serverHost').textContent = `${server.host}:${server.port}`;
      document.getElementById('serverLatency').textContent = server.latency ? `${server.latency}ms` : 'نامشخص';
    }
  });
}
