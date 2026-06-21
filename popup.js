// وضعیت فعلی
let currentStatus = {
  isConnected: false,
  server: null
};

// بارگذاری اولیه
document.addEventListener('DOMContentLoaded', async () => {
  await loadServers();
  await updateStatus();
  setupEventListeners();
});

// بارگذاری لیست سرورها
async function loadServers() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getServers' });
    if (response.success) {
      const select = document.getElementById('serverSelect');
      // حفظ انتخاب قبلی
      const selectedValue = select.value;
      
      // پاک کردن گزینه‌های قبلی (به جز گزینه اول)
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      // اضافه کردن سرورها
      response.servers.forEach(server => {
        const option = document.createElement('option');
        option.value = JSON.stringify(server);
        option.textContent = `${server.name} (${server.country})`;
        select.appendChild(option);
      });
      
      // بازگرداندن انتخاب قبلی
      if (selectedValue) {
        select.value = selectedValue;
      }
    }
  } catch (error) {
    console.error('خطا در بارگذاری سرورها:', error);
    showError('خطا در بارگذاری سرورها');
  }
}

// به‌روزرسانی وضعیت
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

// به‌روزرسانی UI بر اساس وضعیت
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
    connectionStatus.textContent = '✅ متصل به ' + currentStatus.server.name;
    
    // نمایش اطلاعات سرور
    serverInfo.style.display = 'block';
    document.getElementById('serverCountry').textContent = currentStatus.server.country;
    document.getElementById('serverHost').textContent = currentStatus.server.host;
    
    // غیرفعال کردن انتخاب سرور در حین اتصال
    serverSelect.disabled = true;
  } else {
    statusText.textContent = 'غیرفعال';
    statusDot.className = 'status-dot disconnected';
    toggleBtn.textContent = '🔗 اتصال';
    toggleBtn.className = 'btn-connect disconnected';
    connectionStatus.textContent = '❌ قطع';
    serverInfo.style.display = 'none';
    serverSelect.disabled = false;
  }
}

// تنظیم رویدادها
function setupEventListeners() {
  // دکمه اتصال/قطع
  document.getElementById('toggleButton').addEventListener('click', async () => {
    try {
      if (currentStatus.isConnected) {
        // قطع اتصال
        const response = await chrome.runtime.sendMessage({ action: 'disconnect' });
        if (response.success) {
          await updateStatus();
          showSuccess('✅ اتصال قطع شد');
        } else {
          showError('❌ خطا در قطع اتصال');
        }
      } else {
        // اتصال
        const select = document.getElementById('serverSelect');
        const selectedValue = select.value;
        
        if (!selectedValue) {
          showError('⚠️ لطفاً یک سرور انتخاب کنید');
          return;
        }
        
        const server = JSON.parse(selectedValue);
        const response = await chrome.runtime.sendMessage({ 
          action: 'connect', 
          server 
        });
        
        if (response.success) {
          await updateStatus();
          showSuccess(`✅ متصل به ${server.name}`);
        } else {
          showError('❌ خطا در اتصال به سرور');
        }
      }
    } catch (error) {
      console.error('خطا:', error);
      showError('❌ خطای ناشناخته');
    }
  });
  
  // دکمه به‌روزرسانی
  document.getElementById('refreshButton').addEventListener('click', async () => {
    showSuccess('🔄 در حال به‌روزرسانی...');
    await loadServers();
    await updateStatus();
    showSuccess('✅ سرورها به‌روزرسانی شدند');
  });
  
  // تغییر سرور
  document.getElementById('serverSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      const server = JSON.parse(e.target.value);
      showSuccess(`🌍 ${server.name} انتخاب شد`);
    }
  });
}

// نمایش پیام موفقیت
function showSuccess(message) {
  // می‌توانید اینجا یک Toast یا notification اضافه کنید
  console.log(message);
}

// نمایش پیام خطا
function showError(message) {
  // می‌توانید اینجا یک alert یا notification اضافه کنید
  alert(message);
}
