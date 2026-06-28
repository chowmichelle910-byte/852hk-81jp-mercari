/**
 * ============================================================
 * 852hk81jp — 主 Sheet 完整 GAS（最終版）
 * ============================================================
 */

// ─────────────────────────────────────────────
//  全域配置
// ─────────────────────────────────────────────
const SF_TEMPLATE_SHEET_NAME       = "2023.08.24";
const TARGET_ECSHIP_SPREADSHEET_ID = '1hp44ekSGPVv3vrdlZqpDUtY_KKaQtTkq5SV-gOn9Tbc';
const TARGET_SF_SPREADSHEET_ID     = '1fcmWxBPI6l-0_RYz1rXjcNNWVxQpagxhZEi3ue-trqM';
const RECIPIENT_EMAIL              = "852hk886tw@gmail.com";
const PUBLIC_SHEET_ID              = '1KbAYh6xCuoieXhoyrTB7rzTdCAV5qr5hl8f3U56AN-I';
const SOURCE_SHEET_NAME            = '訂單';
const RECORD_SHEET_NAME            = 'Record';
const USER_SHEET_NAME              = 'User name';
const ADMIN_PASSWORD               = '4916';

// ─────────────────────────────────────────────
//  onOpen
// ─────────────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('出單')
    .addItem('工具', 'showSidebar')
    .addSeparator()
    .addItem('📦 更新未到貨', 'menuPopulateArrivals')
    .addToUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("到貨");
  const cell  = sheet.getRange("K1");
  cell.setValue("更新");
  cell.setNote("點擊此儲存格可同步資料回『訂單』分頁");
}

function menuPopulateArrivals() {
  populateArrivals();
  SpreadsheetApp.getUi().alert("✅ 已更新所有未到貨資料到『到貨』分頁！");
}

// ─────────────────────────────────────────────
//  Sidebar
// ─────────────────────────────────────────────
function showSidebar() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('Data');
  const data      = dataSheet.getRange('H2:H').getValues().flat();
  const groups    = [...new Set(data.filter(g => g))];
  groups.sort((a, b) => {
    const numA = parseInt(a.toString().match(/\d+/));
    const numB = parseInt(b.toString().match(/\d+/));
    return numB - numA;
  });
  if (groups.length === 0) {
    SpreadsheetApp.getUi().alert('「Data」分頁的 H 欄沒有任何團次可選擇。');
    return;
  }
  const template  = HtmlService.createTemplateFromFile('Sidebar');
  template.groups = groups;
  const html      = template.evaluate().setTitle('📮 新團工具').setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

// ─────────────────────────────────────────────
//  doPost — 完整 Web App 入口
// ─────────────────────────────────────────────
function doPost(e) {
  const action   = String(e.parameter.action   || '').trim();
  const password = String(e.parameter.password || '').trim();
  const group    = String(e.parameter.group    || '').trim();

  if (password !== ADMIN_PASSWORD) {
    return jsonResponse_({ error: '密碼錯誤' });
  }

  switch (action) {

    // ── 出單工具：執行類 ──
    case 'sendGroupEmail':
      try { return jsonResponse_({ success: true, result: sendGroupEmail(group) }); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'exportArrivalData':
      try { return jsonResponse_({ success: true, result: exportArrivalData(group) }); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'generatePostData':
      try { return jsonResponse_({ success: true, result: generatePostData(group) }); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'sendGroupReceiptsAsPdf':
      try { return jsonResponse_({ success: true, result: sendGroupReceiptsAsPdf(group) }); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'sendShippingNotification':
      try { return jsonResponse_({ success: true, result: sendShippingNotification(group) }); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    // ── 出單工具：預覽類（頁面顯示，唔寄 Email）──
    case 'getGroupEmailPreview':
      try { return jsonResponse_(getGroupEmailPreview_(group)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getShippingNotificationPreview':
      try { return jsonResponse_(getShippingNotificationPreview_(group)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    // ── 磅重頁：寄出日期 ──
    case 'getNextShipDate':
      try { return jsonResponse_(getNextShipDate_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    // ── 財務：チャージ ──
    case 'getChargeBalance':
      try { return jsonResponse_(getChargeBalance_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getChargePlaces':
      try { return jsonResponse_(getChargePlaces_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'addChargeRecord':
      try { return jsonResponse_(addChargeRecord_(e.parameter.date, e.parameter.jpy, e.parameter.hkd, e.parameter.place)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    // ── 財務：Buyer + Analysis ──
    case 'getBuyerSummary':
      try { return jsonResponse_(getBuyerSummary_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getAnalysisData':
      try { return jsonResponse_(getAnalysisData_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'saveActualPostage':
      try { return jsonResponse_(saveActualPostage_(e.parameter.analysisRow, e.parameter.value)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'clearIColumnColor':
      try { return jsonResponse_(clearIColumnColor_(e.parameter.analysisRow)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getPickListFromOrders':
      try { return jsonResponse_(getPickListFromOrders_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getNewGroupDefaults':
      try { return jsonResponse_(getNewGroupDefaults_()); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'saveNewGroup':
      try { return jsonResponse_(saveNewGroup_(e.parameter)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getCustomerReceipt':
      try { return jsonResponse_(getCustomerReceipt_(e.parameter.group, e.parameter.userName)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getRecordData':
      try { return jsonResponse_(getRecordData_(e.parameter.group)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'saveTrackingNo':
      try { return jsonResponse_(saveTrackingNo_(e.parameter.recordRow, e.parameter.tracking)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'saveRecordDelivery':
      try { return jsonResponse_(saveRecordDelivery_(e.parameter.recordRow, e.parameter.receiver, e.parameter.phone, e.parameter.address)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'saveIgPost':
      try { return jsonResponse_(saveIgPost_(e.parameter.imageUrl, e.parameter.content, e.parameter.date)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    // ── 查詢 ID ──
    case 'findUserByIdFromPublic':
      try { return jsonResponse_(findUserByIdFromPublic_(e.parameter.custId)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    case 'getCustomerGroupSummary':
      try { return jsonResponse_(getCustomerGroupSummary_(e.parameter.group)); }
      catch(err) { return jsonResponse_({ error: err.message }); }

    default:
      return jsonResponse_({ error: '未知 action: ' + action });
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
//  磅重頁：寄出日期
//  Currency C10 開始，找最接近今日（>=今日）的日期，+1天
// ─────────────────────────────────────────────
function getNextShipDate_() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const curSheet = ss.getSheetByName('Currency');
  if (!curSheet) return { text: '未有寄出資料' };

  const lastRow = curSheet.getLastRow();
  if (lastRow < 10) return { text: '未有寄出資料' };

  const data  = curSheet.getRange(10, 1, lastRow - 9, 3).getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let targetGroup = '', targetDate = null;

  for (let i = 0; i < data.length; i++) {
    const groupName = String(data[i][0] || '').trim();
    const dateVal   = data[i][2];
    if (!dateVal || !(dateVal instanceof Date)) continue;
    const d = new Date(dateVal);
    d.setHours(0, 0, 0, 0);
    if (d >= today) {
      targetGroup = groupName;
      targetDate  = d;
      break;
    }
  }

  if (!targetDate) return { text: '未有寄出資料' };

  const shipDate = new Date(targetDate);
  shipDate.setDate(shipDate.getDate() + 1);
  const weekNames = ['日','一','二','三','四','五','六'];
  const y   = shipDate.getFullYear();
  const m   = shipDate.getMonth() + 1;
  const d2  = shipDate.getDate();
  const dow = weekNames[shipDate.getDay()];

  return { text: `${targetGroup}寄出日期：${y}/${m}/${d2}（${dow}）` };
}

// ─────────────────────────────────────────────
//  開團通知 Email 預覽（返回 HTML，唔寄）
// ─────────────────────────────────────────────
function getGroupEmailPreview_(groupId) {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet     = ss.getSheetByName('Data');
  const currencySheet = ss.getSheetByName('Currency');
  const groupData     = dataSheet.getRange('H2:J').getValues();
  const currencyData  = currencySheet.getRange('A2:H').getValues();
  const normalize     = str => String(str).trim();

  const selectedGroupRow    = groupData.find(row => normalize(row[0]) === normalize(groupId));
  const selectedCurrencyRow = currencyData.find(row => normalize(row[0]) === normalize(groupId));

  if (!selectedGroupRow)    return { error: `找不到團號 ${groupId} 的日期資料` };
  if (!selectedCurrencyRow) return { error: `找不到團號 ${groupId} 的匯率資料` };

  const [group, startDate, endDate] = selectedGroupRow;
  const rate1 = selectedCurrencyRow[4];
  const rate2 = selectedCurrencyRow[6];
  const rate3 = selectedCurrencyRow[7];

  const format = date => Utilities.formatDate(new Date(date), 'Asia/Taipei', 'M月d日（E）');
  const fOffset = (date, offset) => {
    const d = new Date(date); d.setDate(d.getDate() + offset); return format(d);
  };

  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.9;">
<b>【Mercari代購｜${group}開始啦！${format(endDate)}截】</b><br><br>
୨୧┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈୨୧<br>
<b>收單時間</b>｜${format(startDate)} 至 ${format(endDate)}<br>
<b>日本寄出日</b>｜預計 ${fOffset(endDate,1)}<br>
<b>香港到貨日</b>｜預計 ${fOffset(endDate,7)} 後<br>
୨୧┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈୨୧<br><br>
✓ 無其他手續費<br>
✓ 收到款項即時代拍<br>
✓ 到港後以順豐到付／郵局易寄取／平郵寄出<br><br>
<b>本團匯率（以每團每位客人總金額計算）：</b><br>
・¥1～10,000 → ${rate1}算<br>
・¥10,001～50,000 → ${rate2}算<br>
・¥50,001或以上 → ${rate3}算<br>
<b>到港運費：</b>HK$4.5／50g（50g起跳，超過50g以實重計算）<br><br>
👉🏻 歡迎dm/wts查詢 🔍<br>
*<i>wts link可以喺profile搵到</i> 🥰<br>
📱 +852 9337 5712<br><br>
#Mercari代購 #日本限定 #代購推薦</div>`;

  return { html };
}

// ─────────────────────────────────────────────
//  寄貨通知預覽（返回 HTML，唔寄）
// ─────────────────────────────────────────────
function getShippingNotificationPreview_(groupTitle) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet = ss.getSheetByName('Record');
  const ordersSheet = ss.getSheetByName('訂單');

  if (!groupTitle) return { error: '請提供團次' };
  const raw     = String(groupTitle).trim();
  const currTag = raw.includes('到貨') ? raw : raw + '到貨';
  const lastRow = recordSheet.getLastRow();
  if (lastRow < 2) return { error: 'Record 表沒有資料' };

  const data     = recordSheet.getRange(2, 1, lastRow - 1, 14).getValues();
  const filtered = data.filter(r => String(r[2] || '').trim() === currTag);
  if (!filtered.length) return { error: `找不到「${currTag}」的資料` };

  const ordersLastRow = ordersSheet.getLastRow();
  const ordersRange   = ordersLastRow >= 2
    ? ordersSheet.getRange(2, 15, ordersLastRow - 1, 14).getValues()
    : [];

  function findItemName(pid) {
    const p = String(pid || '').trim();
    if (!p) return '';
    for (let r = ordersRange.length - 1; r >= 0; r--) {
      if (String(ordersRange[r][0] || '').trim() === p) return String(ordersRange[r][13] || '').trim();
    }
    return '';
  }

  const HOME_KEYWORDS = ["等下團一齊寄", "Michelle自己"];
  let prevGroupOverallIds = [];
  try {
    const m = raw.match(/第\s*(\d+)\s*團/);
    if (m && parseInt(m[1]) > 1) {
      const prevTag = "第" + (parseInt(m[1]) - 1) + "團到貨";
      data.filter(r => String(r[2]||'').trim() === prevTag).forEach(rowArr => {
        const methodVal = String(rowArr[8]||'').toLowerCase();
        if (HOME_KEYWORDS.some(kw => methodVal.includes(kw.toLowerCase()))) {
          const oid = String(rowArr[5]||'').trim();
          if (oid) prevGroupOverallIds.push(oid);
        }
      });
    }
  } catch(err) {}

  const plainMarks=[], easyMarks=[], sfMarks=[], homeMarks=[];
  let sfWeight=0, homeWeight=0;
  const plainMails=[];

  let html = `<div style="font-family:sans-serif;font-size:13px;line-height:1.8;">
<h3 style="margin:0 0 8px;color:#0D1B2A;">${currTag} 寄送通知</h3>
<p style="margin:0 0 12px;color:#666;">一共 ${filtered.length} 件貨</p>`;

  filtered.forEach(row => {
    const user      = row[0];
    const productId = row[4];
    const overallId = row[5];
    const weight    = row[7];
    const method    = row[8];
    const recipient = row[9];
    const phone     = row[10];
    const address   = row[11];
    const tracking  = row[12];
    if (!user || !method) return;
    const mark      = String(overallId || productId || '').trim();
    const ids       = String(productId || '').split(/[,，\s]+/).filter(Boolean);
    const itemNames = [...new Set(ids.map(id => findItemName(id)).filter(Boolean))].join(', ');

    let color = '#C9A84C';
    let methodLabel = method;
    if (String(method).includes('易寄取'))   { easyMarks.push(mark); color = '#2563EB'; }
    else if (String(method).toUpperCase().includes('SF')) { sfMarks.push(mark); sfWeight += Number(weight)||0; color = '#059669'; }
    else if (String(method).includes('平郵')) { plainMarks.push(mark); color = '#7C3AED'; plainMails.push(`編號: ${mark} | 收件人: ${recipient} | 地址: ${address}`); }
    else { homeMarks.push(mark); homeWeight += Number(weight)||0; color = '#D97706'; }

    html += `<div style="margin-bottom:12px;padding:10px 12px;background:#f9f9f9;border-radius:8px;border-left:3px solid ${color};">
<b style="color:#0D1B2A;">${user}</b> <span style="font-size:11px;color:#888;font-family:monospace;">(${mark})</span><br>`;

    if (String(method).includes('平郵')) {
      html += `方式：平郵 ｜ 收件人：${recipient}<br>地址：${address}<br>郵費：$${tracking||''}`;
    } else if (String(method).includes('易寄取')) {
      html += `方式：${method}<br>運單號：<b>${tracking||'（未提供）'}</b>`;
    } else if (String(method).toUpperCase().includes('SF')) {
      html += `方式：順豐 ｜ 運單號：<b>${tracking||'（未提供）'}</b><br>貨品：${itemNames||'—'}`;
    } else {
      html += `方式：${method}（拎翻屋企）`;
    }
    html += `</div>`;
  });

  // Summary
  html += `<div style="margin-top:14px;padding:10px 12px;background:#EFF6FF;border-radius:8px;font-size:12px;color:#1E3A8A;">`;
  if (plainMarks.length)  html += `📮 平郵 ${plainMarks.length} 件：${plainMarks.join(', ')}<br>`;
  if (easyMarks.length)   html += `📬 易寄取 ${easyMarks.length} 件：${easyMarks.join(', ')}<br>`;
  if (sfMarks.length)     html += `📦 順豐 ${sfMarks.length} 件（共${Math.round(sfWeight)}g）：${sfMarks.join(', ')}<br>`;
  if (homeMarks.length)   html += `🏠 拎翻屋企 ${homeMarks.length} 件（共${Math.round(homeWeight)}g）：${homeMarks.join(', ')}<br>`;
  if (prevGroupOverallIds.length > 0) html += `<br>上一團拎翻屋企貨品編號：${prevGroupOverallIds.join(', ')}`;
  html += `</div>`;

  if (plainMails.length) {
    html += `<div style="margin-top:10px;padding:10px;background:#F5F3FF;border-radius:8px;font-size:11px;font-family:monospace;">`;
    plainMails.forEach(l => { html += l + '<br>'; });
    html += `</div>`;
  }

  html += '</div>';
  return { html };
}

// ─────────────────────────────────────────────
//  チャージ J欄最後有數值 = 餘額
// ─────────────────────────────────────────────
function getChargeBalance_() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const chargeSheet = ss.getSheetByName('チャージ');
  if (!chargeSheet) return { error: '找不到 チャージ 工作表' };

  const lastRow = chargeSheet.getLastRow();
  if (lastRow < 2) return { balance: 0, note: 'チャージ 沒有資料' };

  // J欄 = 第10欄，由下往上搵最後有數值
  const jCol = chargeSheet.getRange(2, 10, lastRow - 1, 1).getValues();
  let balance = null;
  for (let i = jCol.length - 1; i >= 0; i--) {
    const v = jCol[i][0];
    if (v !== '' && v !== null && !isNaN(Number(v))) {
      balance = Number(v);
      break;
    }
  }

  return {
    balance : balance != null ? Math.round(balance) : 0,
    note    : 'チャージ J欄最後有數值'
  };
}

// ─────────────────────────────────────────────
//  チャージ 增值地點清單 + 上一行預設值
//  B=日期, C=日幣, D=港幣, F=地點
// ─────────────────────────────────────────────
function getChargePlaces_() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const chargeSheet = ss.getSheetByName('チャージ');
  if (!chargeSheet) return { places: [] };

  const lastRow = chargeSheet.getLastRow();
  if (lastRow < 2) return { places: [] };

  const data = chargeSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const places = [...new Set(data.map(r => String(r[5] || '').trim()).filter(Boolean))];

  let lastJpy = '', lastHkd = '';
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][2]) { lastJpy = data[i][2]; lastHkd = data[i][3] || ''; break; }
  }

  return { places, lastJpy, lastHkd };
}

// ─────────────────────────────────────────────
//  新增 チャージ 記錄
//  B=日期, C=日幣, D=港幣, F=地點
// ─────────────────────────────────────────────
function addChargeRecord_(date, jpy, hkd, place) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const chargeSheet = ss.getSheetByName('チャージ');
  if (!chargeSheet) return { error: '找不到 チャージ 工作表' };

  // 搵 B欄最後有數據嘅行，新記錄寫入下一行
  const bCol    = chargeSheet.getRange('B:B').getValues();
  let lastBRow  = 1;
  for (let i = bCol.length - 1; i >= 0; i--) {
    if (bCol[i][0] !== '' && bCol[i][0] !== null) { lastBRow = i + 1; break; }
  }
  const nextRow = lastBRow + 1;

  chargeSheet.getRange(nextRow, 2).setValue(date);
  chargeSheet.getRange(nextRow, 2).setNumberFormat('yyyy/m/d');
  chargeSheet.getRange(nextRow, 3).setValue(Number(jpy));
  chargeSheet.getRange(nextRow, 4).setValue(Number(hkd));
  if (place) chargeSheet.getRange(nextRow, 6).setValue(place);
  SpreadsheetApp.flush();

  try { updateOrdersCurrencyAndChargeWeighted(); } catch(e) { Logger.log('重算匯率失敗: ' + e); }

  return { success: true };
}

// ─────────────────────────────────────────────
//  Buyer 分頁摘要
//  E=名稱, F=金額, G=匯率, F1=當前團號
// ─────────────────────────────────────────────
function getBuyerSummary_() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const buyerSheet = ss.getSheetByName('Buyer');
  if (!buyerSheet) return { error: '找不到 Buyer 工作表' };

  const group   = String(buyerSheet.getRange('F1').getValue() || '').trim();
  const lastRow = buyerSheet.getLastRow();
  if (lastRow < 2) return { group, rows: [] };

  const data = buyerSheet.getRange(2, 5, lastRow - 1, 3).getValues();
  const rows = data
    .filter(r => r[0])
    .map(r => ({
      name  : String(r[0] || '').trim(),
      amount: r[1] !== '' ? r[1] : null,
      rate  : r[2] !== '' ? r[2] : null
    }));

  return { group, rows };
}

// ─────────────────────────────────────────────
//  Analysis 分頁數據
//  C=團號, D=貨品數, E=購入日幣, F=收到港幣,
//  G=賺取港幣, I=每人賺, J=重量, L=客郵費, M=實際郵費
// ─────────────────────────────────────────────
function getAnalysisData_() {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const analysisSheet = ss.getSheetByName('Analysis');
  if (!analysisSheet) return { error: '找不到 Analysis 工作表' };

  const lastRow = analysisSheet.getLastRow();
  if (lastRow < 2) return { rows: [] };

  // C至M欄 = 第3至13欄，共11欄
  const data = analysisSheet.getRange(2, 3, lastRow - 1, 11).getValues();

  // 單獨讀 I欄背景顏色（第9欄）
  const iColors = analysisSheet.getRange(2, 9, lastRow - 1, 1).getBackgrounds();

  const rows = data
    .filter(r => r[0])
    .map((r, i) => {
      const bg = iColors[i][0];
      // 有底色 = 已結算，無底色（null/'#ffffff'/''）= 未結算
      const hasColor = !!(bg && bg !== '#ffffff' && bg !== '#FFFFFF' && bg !== null && bg !== '');
      return {
        analysisRow  : i + 2,
        group        : String(r[0]  || '').trim(),
        qty          : r[1]  !== '' ? r[1]  : null,
        buyJpy       : r[2]  !== '' ? r[2]  : null,
        rcvHkd       : r[3]  !== '' ? r[3]  : null,
        earnHkd      : r[4]  !== '' ? r[4]  : null,
        perPerson    : r[6]  !== '' ? r[6]  : null,
        weight       : r[7]  !== '' ? r[7]  : null,
        custPostage  : r[9]  !== '' ? r[9]  : null,
        actualPostage: r[10] !== '' ? r[10] : null,
        settled      : hasColor  // true = 有底色 = 已結算
      };
    });

  return { rows };
}

// ─────────────────────────────────────────────
//  儲存實際郵費到 Analysis M欄（第13欄）
// ─────────────────────────────────────────────
function saveActualPostage_(analysisRow, value) {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const analysisSheet = ss.getSheetByName('Analysis');
  if (!analysisSheet) return { error: '找不到 Analysis 工作表' };

  const row = parseInt(analysisRow);
  if (isNaN(row) || row < 2) return { error: '無效行號' };

  analysisSheet.getRange(row, 13).setValue(parseFloat(value) || 0);
  SpreadsheetApp.flush();
  return { success: true };
}

// ─────────────────────────────────────────────
//  清除 Analysis I欄底色（第9欄，只清該行）
// ─────────────────────────────────────────────
function clearIColumnColor_(analysisRow) {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const analysisSheet = ss.getSheetByName('Analysis');
  if (!analysisSheet) return { error: '找不到 Analysis 工作表' };

  const row = parseInt(analysisRow);
  if (isNaN(row) || row < 2) return { error: '無效行號' };

  const cell    = analysisSheet.getRange(row, 9); // I欄
  const current = cell.getBackground();
  const hasColor = current && current !== '#ffffff' && current !== null && current !== '';

  if (hasColor) {
    // 已有底色 → 清除（取消結算）
    cell.setBackground(null);
  } else {
    // 無底色 → 加綠色（標記已結算）
    cell.setBackground('#b7e1cd');
  }
  SpreadsheetApp.flush();
  return { success: true, settled: !hasColor };
}

// ─────────────────────────────────────────────
//  從 Public Sheet User name 分頁查找用戶
//  A=ID, B=username, C=網址
// ─────────────────────────────────────────────
function findUserByIdFromPublic_(custId) {
  if (!custId) return { error: '請提供客戶 ID' };

  const publicSS  = SpreadsheetApp.openById(PUBLIC_SHEET_ID);
  const userSheet = publicSS.getSheetByName(USER_SHEET_NAME);
  const lastRow   = userSheet.getLastRow();
  if (lastRow < 2) return { error: '找不到用戶資料' };

  const data = userSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (const [id, username, url] of data) {
    if (String(id).trim() === String(custId).trim()) {
      return {
        custId,
        username: String(username).trim(),
        url     : String(url).trim()
      };
    }
  }
  return { error: `找不到 ID: ${custId}` };
}

// ─────────────────────────────────────────────
//  新團設定：讀取 Currency 分頁最後一行，計算下一團預設值
//  A=團號, B=Start, C=End, E=r1, F=r5k, G=r10k, H=r50k
// ─────────────────────────────────────────────
function getNewGroupDefaults_() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const curSheet = ss.getSheetByName('Currency');
  if (!curSheet) return { error: '找不到 Currency 工作表' };

  const lastRow = curSheet.getLastRow();
  // A10 起係資料，A9 係標題
  if (lastRow < 10) return { group: '第1團', start: '', end: '', r1: '', r5k: '', r10k: '', r50k: '' };

  // Scan backwards from lastRow to find last row with non-empty column A
  const allData = curSheet.getRange(10, 1, lastRow - 9, 8).getValues();
  let lastIdx = -1;
  for (let i = allData.length - 1; i >= 0; i--) {
    if (String(allData[i][0] || '').trim()) { lastIdx = i; break; }
  }
  if (lastIdx < 0) return { group: '第1團', start: '', end: '', r1: '', r5k: '', r10k: '', r50k: '' };
  const row = allData[lastIdx];

  // 解析最後一團號，+1
  const lastGroup = String(row[0] || '').trim();
  const numMatch  = lastGroup.match(/\d+/);
  const nextNum   = numMatch ? parseInt(numMatch[0]) + 1 : 1;
  const nextGroup = `第${nextNum}團`;

  // Start date = lastRow B欄 + 14天
  // End date   = lastRow C欄 + 14天
  function addDays(val, days) {
    if (!val) return '';
    const d = val instanceof Date ? new Date(val) : new Date(val);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return Utilities.formatDate(d, 'Asia/Hong_Kong', 'yyyy-MM-dd');
  }

  const nextStart = addDays(row[1], 14); // B: Start date + 14
  const nextEnd   = addDays(row[2], 14); // C: End date + 14

  return {
    group : nextGroup,
    start : nextStart,
    end   : nextEnd,
    r1    : row[4] || '', // E
    r5k   : row[5] || '', // F
    r10k  : row[6] || '', // G
    r50k  : row[7] || ''  // H
  };
}

// ─────────────────────────────────────────────
//  新團設定：儲存到 Currency 分頁下一行
// ─────────────────────────────────────────────
function saveNewGroup_(params) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const curSheet = ss.getSheetByName('Currency');
  if (!curSheet) return { error: '找不到 Currency 工作表' };

  const { group, start, end, r1, r5k, r10k, r50k } = params;
  if (!group || !start || !end) return { error: '請提供團號、開始及結束日期' };

  const nextRow = curSheet.getLastRow() + 1;

  // A=團號, B=Start, C=End, E=r1, F=r5k, G=r10k, H=r50k
  curSheet.getRange(nextRow, 1).setValue(group);
  curSheet.getRange(nextRow, 2).setValue(start);
  curSheet.getRange(nextRow, 2).setNumberFormat('yyyy/m/d');
  curSheet.getRange(nextRow, 3).setValue(end);
  curSheet.getRange(nextRow, 3).setNumberFormat('yyyy/m/d');
  if (r1)   curSheet.getRange(nextRow, 5).setValue(parseFloat(r1));
  if (r5k)  curSheet.getRange(nextRow, 6).setValue(parseFloat(r5k));
  if (r10k) curSheet.getRange(nextRow, 7).setValue(parseFloat(r10k));
  if (r50k) curSheet.getRange(nextRow, 8).setValue(parseFloat(r50k));

  SpreadsheetApp.flush();
  return { success: true };
}

// ─────────────────────────────────────────────
//  Helper: extract numeric part from group name (e.g. '第48團' → 48)
// ─────────────────────────────────────────────
function getGroupNum_(groupName) {
  const m = String(groupName || '').match(/\d+/);
  return m ? parseInt(m[0]) : -1;
}

// ─────────────────────────────────────────────
//  B=1(購買日期), C=2(Position), D=3(ID),
//  F=5(Link), G=6(商品名), O=14(Code),
//  P=15(到貨日期), Q=16(重量KG), S=18(到貨圖片)
// ─────────────────────────────────────────────
function getCustomerReceipt_(group, userName) {
  if (!group || !userName) return { error: '請提供團次及客戶名稱' };

  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName('訂單');
  const lastRow    = orderSheet.getLastRow();
  if (lastRow < 2) return { items: [] };

  const data = orderSheet.getRange(2, 1, lastRow - 1, 19).getValues();
  // userName 格式：Position--ID
  const parts    = userName.split('--');
  const position = parts[0] || '';
  const id       = parts.slice(1).join('--') || '';

  const items = [];
  for (const row of data) {
    const rowPos      = String(row[2]  || '').trim(); // C
    const rowId       = String(row[3]  || '').trim(); // D
    const rowArrival  = String(row[0]  || '').trim(); // A: 到貨團次
    const arrivalDate = row[15]; // P: 到貨日期

    // 篩選條件：
    // 1. 屬於此客人（C--D 匹配）
    // 2. A欄 = 選擇團號（本團已到貨）OR P欄空白（未到貨）
    if (rowPos !== position || rowId !== id) continue;

    const selectedNum  = getGroupNum_(group);
    const rowGroupNum  = rowArrival ? getGroupNum_(rowArrival) : -1;
    const isFutureGrp  = rowArrival && rowGroupNum > selectedNum;
    const isThisGroup  = rowArrival === String(group).trim();
    const isNotArrived = !arrivalDate; // P欄空白 = 未到貨

    if (!isThisGroup && !isNotArrived && !isFutureGrp) continue;

    // Future group items treated as not arrived
    const effectiveArrivalDate = isFutureGrp ? null : arrivalDate;

    const orderedDate = row[1]; // B
    const link        = String(row[5]  || '').trim(); // F
    const itemName    = String(row[6]  || '').trim(); // G
    const code        = String(row[14] || '').trim(); // O
    const weightKg    = parseFloat(row[16]) || 0;     // Q
    const image       = isFutureGrp ? '' : String(row[18] || '').trim(); // S: 未來團不顯示到貨圖

    let orderedDateStr = '';
    if (orderedDate instanceof Date) {
      orderedDateStr = `${orderedDate.getFullYear()}/${orderedDate.getMonth()+1}/${orderedDate.getDate()}`;
    } else if (orderedDate) {
      orderedDateStr = String(orderedDate).trim();
    }

    let arrivalDateStr = '';
    if (effectiveArrivalDate instanceof Date) {
      arrivalDateStr = `${effectiveArrivalDate.getFullYear()}/${effectiveArrivalDate.getMonth()+1}/${effectiveArrivalDate.getDate()}`;
    } else if (effectiveArrivalDate) {
      arrivalDateStr = String(effectiveArrivalDate).trim();
    }

    items.push({
      code        : code,
      orderedDate : orderedDateStr,
      arrivalDate : arrivalDateStr, // 空字串 = 未到貨
      itemName    : itemName,
      weightKg    : weightKg,
      image       : image,
      link        : link,
      arrived     : !!arrivalDateStr
    });
  }

  // 排序：已到貨在前（按 code），未到貨在後
  items.sort((a, b) => {
    if (a.arrived !== b.arrived) return a.arrived ? -1 : 1;
    return (parseInt(a.code) || 0) - (parseInt(b.code) || 0);
  });

  return { items, group, userName };
}

// ─────────────────────────────────────────────
//  A=用戶名稱, C=第X團到貨, D=到貨數量, E=貨品編號,
//  F=整體貨品編號, G=郵費, H=重量(g), I=郵寄方式,
//  J=收件人, K=電話, L=地址, M=Tracking no.
// ─────────────────────────────────────────────
function getRecordData_(group) {
  if (!group) return { error: '請提供團次' };

  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet = ss.getSheetByName('Record');
  const lastRow     = recordSheet.getLastRow();
  if (lastRow < 2) return { rows: [] };

  const data    = recordSheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const arrTag  = String(group).trim() + '到貨';

  const rows = data
    .map((r, i) => ({ r, rowNum: i + 2 }))
    .filter(({ r }) => String(r[2] || '').trim() === arrTag)
    .map(({ r, rowNum }) => ({
      rowNum,
      userName    : String(r[0]  || '').trim(), // A
      arrivalTag  : String(r[2]  || '').trim(), // C
      qty         : r[3]  !== '' ? r[3]  : 0,  // D
      codes       : String(r[4]  || '').trim(), // E
      mark        : String(r[5]  || '').trim(), // F
      postage     : r[6]  !== '' ? Number(r[6])  : 0, // G
      weightG     : r[7]  !== '' ? Number(r[7])  : 0, // H
      method      : String(r[8]  || '').trim(), // I
      receiver    : String(r[9]  || '').trim(), // J
      phone       : String(r[10] || '').trim(), // K
      address     : String(r[11] || '').trim(), // L
      tracking    : String(r[12] || '').trim()  // M
    }));

  return { rows };
}

// ─────────────────────────────────────────────
//  儲存 Tracking No. 到 Record M欄（第13欄）
// ─────────────────────────────────────────────
function saveTrackingNo_(recordRow, tracking) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet = ss.getSheetByName('Record');
  const row         = parseInt(recordRow);
  if (isNaN(row) || row < 2) return { error: '無效行號' };
  recordSheet.getRange(row, 13).setValue(tracking || '');
  SpreadsheetApp.flush();
  return { success: true };
}

// ─────────────────────────────────────────────
//  儲存 Record 收件資料（J=收件人, K=電話, L=地址）
// ─────────────────────────────────────────────
function saveRecordDelivery_(recordRow, receiver, phone, address) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet = ss.getSheetByName('Record');
  const row         = parseInt(recordRow);
  if (isNaN(row) || row < 2) return { error: '無效行號' };
  recordSheet.getRange(row, 10).setValue(receiver || ''); // J
  recordSheet.getRange(row, 11).setValue(phone    || ''); // K
  recordSheet.getRange(row, 12).setValue(address  || ''); // L
  SpreadsheetApp.flush();
  return { success: true };
}

// ─────────────────────────────────────────────
//  儲存 IG 帖子圖片到「IG post - mercari」Sheet
//  A=Picture(URL), B=Content, C=Status, D=Date
// ─────────────────────────────────────────────
function saveIgPost_(imageUrl, content, date) {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const igSheet   = ss.getSheetByName('IG post - mercari');
  if (!igSheet) return { error: '找不到「IG post - mercari」分頁' };
  igSheet.appendRow([imageUrl || '', content || '', 'pending', date || '']);
  SpreadsheetApp.flush();
  return { success: true };
}

// ─────────────────────────────────────────────
//  A=到貨團次, C=Position, D=ID, O=Code,
//  Q=Net weight(KG), S=到貨圖片
// ─────────────────────────────────────────────
function getPickListFromOrders_() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName('訂單');
  const lastRow    = orderSheet.getLastRow();
  if (lastRow < 2) return { allGroups: {}, latestGroup: '' };

  const data = orderSheet.getRange(2, 1, lastRow - 1, 19).getValues();
  // A=0(到貨團次), C=2(Position), D=3(ID), O=14(Code),
  // Q=16(Net weight KG), S=18(到貨圖片)

  const allGroups = {};
  let latestGroupNum = -1, latestGroup = '';

  for (const row of data) {
    const arrival  = String(row[0]  || '').trim(); // A: 到貨團次
    const position = String(row[2]  || '').trim(); // C: Position
    const id       = String(row[3]  || '').trim(); // D: ID
    const code     = String(row[14] || '').trim(); // O: Code
    const weightKg = parseFloat(row[16]) || 0;     // Q: Net weight (KG)
    const image    = String(row[18] || '').trim(); // S: 到貨圖片
    const link     = String(row[5]  || '').trim(); // F: Link（商品連結）
    const itemName = String(row[6]  || '').trim(); // G: Item

    // 只顯示已到貨（A欄有團次）的訂單
    if (!arrival || !position || !id) continue;

    // 用戶名稱格式：Position--ID（例如 IG--abc）
    const userName = `${position}--${id}`;

    // 地區判斷：TW = 台灣，其他 = HK
    const region = (position === 'Taiwan' || position === 'TW') ? 'TW' : 'HK';

    if (!allGroups[arrival]) {
      allGroups[arrival] = {
        HK: { customers: {}, totalWeightKg: 0 },
        TW: { customers: {}, totalWeightKg: 0 }
      };
    }

    const grp = allGroups[arrival][region];
    grp.totalWeightKg += weightKg;

    if (!grp.customers[userName]) {
      grp.customers[userName] = [];
    }
    if (code) {
      grp.customers[userName].push({
        code    : code,
        img     : image,
        link    : link,
        itemName: itemName
      });
    }

    // 搵最新一團
    const gNum = parseInt(String(arrival).match(/\d+/) || ['-1']);
    if (gNum > latestGroupNum) { latestGroupNum = gNum; latestGroup = arrival; }
  }

  return { allGroups, latestGroup };
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
function generatePostData(selectedGroup) {
  Logger.log('--- 開始處理團次: ' + selectedGroup + ' ---');

  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet  = ss.getSheetByName('Record');
  const outputSheet  = ss.getSheetByName('易寄取批量上傳用');
  const addressSheet = ss.getSheetByName('地址');
  const orderSheet   = ss.getSheetByName('訂單');

  const recordData    = recordSheet.getDataRange().getValues();
  const headers       = recordData[0];
  const dataRows      = recordData.slice(1);
  const colIndex      = name => headers.indexOf(name);
  const fullGroupName = selectedGroup + '到貨';
  const attachments   = [];

  if (dataRows.length === 0) {
    SpreadsheetApp.getUi().alert("Record 工作表中沒有資料需要處理。");
    return "失敗：Record 工作表中沒有資料。";
  }
  if (!addressSheet) {
    SpreadsheetApp.getUi().alert("錯誤：找不到名為「地址」的工作表。");
    return "失敗：找不到「地址」工作表。";
  }

  const sfAddressRange  = addressSheet.getRange('B:F').getValues();
  const sfAddressLookup = createSFAddressLookup(sfAddressRange);
  const validSFCodes    = Object.keys(sfAddressLookup).sort((a, b) => b.length - a.length);

  const orderRange        = orderSheet.getDataRange().getValues();
  const productNameLookup = createProductNameLookup(orderRange);

  const addrData    = addressSheet.getDataRange().getValues();
  const addrHeaders = addrData[0];
  const idxName     = addrHeaders.indexOf('名稱');
  const idxCode     = addrHeaders.indexOf('編號');
  const ecshipAddressMap = {};
  for (let i = 1; i < addrData.length; i++) {
    const name = String(addrData[i][idxName] || '').trim();
    const code = String(addrData[i][idxCode] || '').trim();
    if (name) ecshipAddressMap[name] = { code, name };
  }
  function ecshipLookup(address, field) {
    for (let key in ecshipAddressMap) {
      if (address.includes(key)) return ecshipAddressMap[key][field] || '';
    }
    return '';
  }

  // ── 易寄取 ──
  if (outputSheet && outputSheet.getLastRow() > 1) {
    outputSheet.getRange(2, 1, outputSheet.getLastRow() - 1, 18).clearContent();
  }
  const ecshipOutput = [];
  for (let row of dataRows) {
    const groupName = row[colIndex('第X團到貨')];
    const method    = String(row[colIndex('郵寄方式')] || '').trim();
    if (groupName !== fullGroupName || !(method === '易寄取 (7-11)' || method === '易寄取 (櫃位/ 智郵站)')) continue;

    const name      = row[colIndex('收件人')];
    const address   = String(row[colIndex('地址')] || '').trim();
    const phone     = String(row[colIndex('電話')] || '').trim();
    const weight_kg = ((parseFloat(row[colIndex('重量(g)')]) || 0) / 1000).toFixed(2);

    let pickupPostOffice = '', iPostal = '', convenienceStore = '', serviceType = '';
    const storeMatch = address.match(/\b(\d{3,4})\b/);
    let storeCode = storeMatch ? storeMatch[1] : '';
    if (!storeCode && (address.toLowerCase().includes('7-eleven') || address.toLowerCase().includes('7-11'))) {
      storeCode = ecshipLookup(address, 'code');
    }
    if (storeCode) {
      convenienceStore = "'" + String(storeCode).padStart(4, '0');
      serviceType = '易寄取（便利店取件）';
    } else if (address.includes('智郵站')) {
      iPostal = ecshipLookup(address, 'name');
      serviceType = '易寄取（智郵站取件）';
    } else {
      pickupPostOffice = ecshipLookup(address, 'name');
      serviceType = '易寄取（櫃位取件）';
    }
    const ref = 'REF-' + Math.floor(Math.random() * 100000);
    ecshipOutput.push([ref,'852hk.81jp','灣仔愛群道28號','64896051','',name,pickupPostOffice,'',iPostal,convenienceStore,'','短訊','中文',formatPhoneNumber(phone),'','',weight_kg,serviceType]);
  }

  if (ecshipOutput.length > 0) {
    if (outputSheet) outputSheet.getRange(2,1,ecshipOutput.length,ecshipOutput[0].length).setValues(ecshipOutput);
    try {
      const targetSpreadsheet = SpreadsheetApp.openById(TARGET_ECSHIP_SPREADSHEET_ID);
      const targetSheet       = targetSpreadsheet.getSheetByName('batch upload sample');
      const dataToCopy        = ecshipOutput.map(r=>[...r]);
      const numRows           = dataToCopy.length;
      const numCols           = dataToCopy[0].length;
      targetSheet.getRange(3,1,targetSheet.getMaxRows()-2,numCols).clearContent();
      for (let i=0;i<numRows;i++) {
        if(dataToCopy[i][9]) dataToCopy[i][9]="'"+String(dataToCopy[i][9]).replace(/^'/,'').padStart(4,'0');
        dataToCopy[i][13]=formatPhoneNumber(dataToCopy[i][13]);
      }
      targetSheet.getRange(3,10,numRows,1).setNumberFormat('@');
      targetSheet.getRange(3,14,numRows,1).setNumberFormat('@');
      targetSheet.getRange(3,1,numRows,numCols).setValues(dataToCopy);
      Utilities.sleep(5000);
    } catch(e) { Logger.log('寫入EC Ship錯誤：'+e.message); SpreadsheetApp.getUi().alert('警告：無法寫入EC Ship。'+e.message); }
    try {
      const url=`https://docs.google.com/spreadsheets/d/${TARGET_ECSHIP_SPREADSHEET_ID}/export?exportFormat=xlsx`;
      const token=ScriptApp.getOAuthToken();
      const response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+token},muteHttpExceptions:true});
      attachments.push(response.getBlob().setName(`${selectedGroup} 易寄取批量上傳.xlsx`));
    } catch(e) { Logger.log('獲取易寄取附件錯誤：'+e.message); }
  }

  // ── 順豐 ──
  const sfDataRows=[],sfTextRows=[];
  const COL_GROUP=colIndex('第X團到貨'),COL_METHOD=colIndex('郵寄方式'),
        COL_RECIPIENT=colIndex('收件人'),COL_PHONE=colIndex('電話'),
        COL_ADDRESS=colIndex('地址'),COL_PRODUCT_CODES=colIndex('貨品編號'),
        COL_RECORD_F=colIndex('整體貨品編號'),COL_USER_NAME=colIndex('用戶名稱');
  let sfOrderCount=0;

  dataRows.forEach(row=>{
    const groupName=row[COL_GROUP],method=String(row[COL_METHOD]||'').trim();
    if(groupName!==fullGroupName||method!=='SF')return;
    sfOrderCount++;
    const recipient=String(row[COL_RECIPIENT]).trim();
    if(!recipient)return;
    const fullAddress=String(row[COL_ADDRESS]);
    const sfCode=extractAndValidateSFCode(fullAddress,sfAddressLookup,validSFCodes);
    const consignmentName=processConsignmentName(String(row[COL_PRODUCT_CODES]),productNameLookup);
    let [province,city,district,detailAddress]=['','','',''];
    if(sfCode)[province,city,district,detailAddress]=sfAddressLookup[sfCode]||['','','',''];
    const newRow=Array(14).fill('');
    newRow[1]=recipient;newRow[2]='852';newRow[3]=String(row[COL_PHONE]).trim();
    newRow[6]=province;newRow[7]=city;newRow[8]=district;newRow[9]=detailAddress;
    newRow[10]='到付';newRow[12]=consignmentName;newRow[13]=sfCode||'';
    sfDataRows.push(newRow);
    sfTextRows.push({product:consignmentName,receiver:recipient,phone:String(row[COL_PHONE]).trim(),address:fullAddress,recordF:String(row[COL_RECORD_F]||'').trim(),userName:String(row[COL_USER_NAME]||'').trim()});
  });

  if(sfDataRows.length>0){
    try{
      const targetSFSpreadsheet=SpreadsheetApp.openById(TARGET_SF_SPREADSHEET_ID);
      const targetSFSheet=targetSFSpreadsheet.getSheetByName(SF_TEMPLATE_SHEET_NAME);
      if(!targetSFSheet){SpreadsheetApp.getUi().alert(`錯誤：找不到分頁 "${SF_TEMPLATE_SHEET_NAME}"`);return '失敗：順豐分頁名稱錯誤。';}
      const startRow=5,numRowsToClear=Math.max(targetSFSheet.getLastRow()-startRow+1,100);
      targetSFSheet.getRange(startRow,1,numRowsToClear,14).clearContent();
      targetSFSheet.getRange(startRow,1,sfDataRows.length,sfDataRows[0].length).setValues(sfDataRows);
      Utilities.sleep(5000);
      const url=`https://docs.google.com/spreadsheets/d/${TARGET_SF_SPREADSHEET_ID}/export?exportFormat=xlsx`;
      const token=ScriptApp.getOAuthToken();
      const response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+token},muteHttpExceptions:true});
      attachments.push(response.getBlob().setName(`${selectedGroup} 順豐收件人範本.xlsx`));
    }catch(e){Logger.log('處理順豐附件錯誤：'+e.message);SpreadsheetApp.getUi().alert('警告：'+e.message);}
  }

  const sfText=sfTextRows.length>0
    ?"📦【順豐寄送資料】\n\n"+sfTextRows.map(s=>`${s.recordF}\n${s.userName}\n貨品種類：${s.product}\n收件人：${s.receiver}\n電話：${s.phone}\n地址：${s.address}\n\n`).join('')
    :"（本團沒有順豐訂單）\n\n";

  if(attachments.length>0){
    try{
      MailApp.sendEmail({to:RECIPIENT_EMAIL,subject:`${selectedGroup} 易寄取 + 順豐寄件資料通知`,body:`您好，\n\n「${selectedGroup}」的易寄取資料已完成匯出。\n\n以下為本團順豐寄件資料：\n\n${sfText}EC Ship 連結：\nhttps://ec-ship.hongkongpost.hk/platform/index.jsf\n`,attachments});
      return `完成：${selectedGroup} 易寄取 + 順豐資料已處理並發送到 ${RECIPIENT_EMAIL}`;
    }catch(e){SpreadsheetApp.getUi().alert('寄信錯誤：'+e.message);return '失敗：'+e.message;}
  }else{
    return sfOrderCount>0||ecshipOutput.length>0?'失敗：有訂單但無法產生附件':'完成：沒有符合條件的訂單。';
  }
}

// ─────────────────────────────────────────────
//  sendShippingNotification（寄貨通知 Email）
//  ★ SF QR Code：直接用 tracking number 生成 QR
// ─────────────────────────────────────────────
function sendShippingNotification(groupTitle) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet = ss.getSheetByName("Record");
  const ordersSheet = ss.getSheetByName("訂單");
  if (!groupTitle) throw new Error("未接收到團編號！");

  const HOME_KEYWORDS = ["等下團一齊寄", "Michelle自己"];
  const lastRow       = recordSheet.getLastRow();
  if (lastRow < 2) throw new Error("Record 表沒有資料。");

  const data     = recordSheet.getRange(2, 1, lastRow - 1, 14).getValues();
  const raw      = String(groupTitle).trim();
  const currTag  = raw.includes("到貨") ? raw : raw + "到貨";
  const filtered = data.filter(r => String(r[2]||'').trim() === currTag);
  if (!filtered.length) throw new Error("找不到屬於 " + currTag + " 的資料！");

  const ordersLastRow = ordersSheet.getLastRow();
  const ordersRange   = ordersLastRow >= 2 ? ordersSheet.getRange(2,15,ordersLastRow-1,14).getValues() : [];

  function findItemContentByCode(pid) {
    const p=String(pid||'').trim();if(!p)return'';
    for(let r=ordersRange.length-1;r>=0;r--){if(String(ordersRange[r][0]||'').trim()===p)return String(ordersRange[r][13]||'').trim();}
    return'';
  }
  function getItemNames(str){
    if(!str)return[];
    const ids=String(str).split(/[,，\s]+/).filter(Boolean);
    const names=[],seen=new Set();
    ids.forEach(id=>{const n=findItemContentByCode(id);if(n&&!seen.has(n)){names.push(n);seen.add(n);}});
    return names;
  }
  function isHomePickup(rowArray){const m=String(rowArray[8]||'').toLowerCase();return HOME_KEYWORDS.some(kw=>m.includes(kw.toLowerCase()));}

  let prevGroupOverallIds=[];
  try{
    const m=raw.match(/第\s*(\d+)\s*團/);
    if(m&&parseInt(m[1])>1){
      const prevTag="第"+(parseInt(m[1])-1)+"團到貨";
      data.filter(r=>String(r[2]||'').trim()===prevTag).forEach(rowArr=>{
        if(isHomePickup(rowArr)){const oid=String(rowArr[5]||'').trim();if(oid)prevGroupOverallIds.push(oid);}
      });
    }
  }catch(err){Logger.log("上一團錯誤:"+err);}

  const plainMarks=[],easyMarks=[],sfMarks=[],homeMarks=[];
  let sfWeight=0,homeWeight=0;
  const plainMails=[],inlineImages={};
  let qrIndex=1,easyQrHtml='',sfQrHtml='',messageHtml="<h4>個別寄件通知</h4>";

  filtered.forEach(row=>{
    const user=row[0],productId=row[4],overallId=row[5],weight=row[7],method=row[8],
          recipient=row[9],phone=row[10],address=row[11],tracking=row[12];
    if(!user||!method)return;
    const mark=String(overallId||productId||'').trim();

    if(String(method).includes("平郵")){
      plainMarks.push(mark);
      plainMails.push("編號: "+mark+"\n收件人: "+recipient+"\n地址: "+address+"\n");
      messageHtml+=`<div style="margin-bottom:15px;"><b>${user}</b><br>收件人：${recipient}<br>地址：${address}<br>你好～${currTag}嘅貨件已寄出，香港平郵郵費為$${tracking||""}☺️🙇🏻‍♀️<br>謝謝🙏🏻</div>`;
    }
    else if(String(method).includes("易寄取")){
      easyMarks.push(mark);
      if(tracking){
        try{
          const qrUrl="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="+encodeURIComponent(tracking);
          const qrBlob=UrlFetchApp.fetch(qrUrl).getBlob().setName(mark+"_easyqr.png");
          const cid="qr"+qrIndex++;inlineImages[cid]=qrBlob;
          easyQrHtml+=`<div style="margin-bottom:20px;text-align:center;"><div style="font-size:14px;color:red;"><b>${mark}</b></div><img src="cid:${cid}" alt="QR Code"><div>${method} ${tracking}</div></div>`;
        }catch(err){Logger.log("易寄取QR錯誤:"+err);}
      }
      messageHtml+=`<div style="margin-bottom:15px;"><b>${user}</b><br>你好～${currTag}嘅貨件已寄出，易寄取嘅運單編號為${tracking||""}☺️🙇🏻‍♀️<br>謝謝🙏🏻</div>`;
    }
    // ★ SF：直接用 tracking number 生成 QR（同易寄取一樣）
    else if(String(method).toUpperCase().includes("SF")){
      sfMarks.push(mark);sfWeight+=(Number(weight)||0);
      const itemNames=getItemNames(productId);
      const baseText=String(overallId||mark||'').trim();
      const itemsText=itemNames.join(", ");
      if(tracking){
        try{
          const qrUrl="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="+encodeURIComponent(tracking);
          const sfBlob=UrlFetchApp.fetch(qrUrl).getBlob().setName(mark+"_SFqr.png");
          const sfCid="qr"+qrIndex++;inlineImages[sfCid]=sfBlob;
          sfQrHtml+=`<div style="margin-bottom:20px;text-align:center;"><div style="font-size:14px;color:red;"><b>${baseText}</b></div><div>${itemsText}</div><img src="cid:${sfCid}" alt="SF QR Code"><div>順豐 ${tracking}</div></div>`;
        }catch(err){
          Logger.log("順豐QR錯誤:"+err);
          sfQrHtml+=`<div style="margin-bottom:10px;text-align:center;"><div style="font-size:14px;color:red;"><b>${baseText}</b></div><div>${itemsText}</div><div>順豐 ${tracking}（QR生成失敗）</div></div>`;
        }
      }else{
        sfQrHtml+=`<div style="margin-bottom:10px;text-align:center;"><div style="font-size:14px;color:red;"><b>${baseText}</b></div><div>${itemsText}</div><div>順豐（未提供運單號）</div></div>`;
      }
      messageHtml+=`<div style="margin-bottom:15px;"><b>${user}</b><br>你好～${currTag}嘅貨件已寄出，順豐嘅運單編號為${tracking||""}☺️🙇🏻‍♀️<br>謝謝🙏🏻</div>`;
    }
    else{
      homeMarks.push(mark);homeWeight+=(Number(weight)||0);
      messageHtml+=`<div style="margin-bottom:15px;"><b>${user}</b><br>你好～${currTag}嘅貨件已準備好，請拎翻屋企☺️🙇🏻‍♀️<br>謝謝🙏🏻</div>`;
    }
  });

  let summaryHtml="<p>";
  if(plainMarks.length)summaryHtml+=`平郵 ${plainMarks.length} 件: ${plainMarks.join(", ")}<br>`;
  if(easyMarks.length) summaryHtml+=`易寄取 ${easyMarks.length} 件: ${easyMarks.join(", ")}<br>`;
  if(sfMarks.length)   summaryHtml+=`順豐 ${sfMarks.length} 件（共${Math.round(sfWeight)}g）: ${sfMarks.join(", ")}<br>`;
  if(homeMarks.length) summaryHtml+=`拎翻屋企 ${homeMarks.length} 件（共${Math.round(homeWeight)}g）: ${homeMarks.join(", ")}<br>`;
  summaryHtml+="</p>";
  if(prevGroupOverallIds.length>0) summaryHtml+=`<p>上一團拎翻屋企嘅貨品編號為: ${prevGroupOverallIds.join(", ")}</p>`;

  let qrCombinedHtml="";
  if(easyQrHtml)qrCombinedHtml+="<h4>易寄取 QR Code</h4>"+easyQrHtml;
  if(sfQrHtml)  qrCombinedHtml+="<h4>順豐 QR Code</h4>"+sfQrHtml;

  const htmlBody=`<div><h3>${currTag}</h3><p>一共會收到 ${filtered.length} 件貨：</p>${summaryHtml}${plainMails.length?"<h4>平郵資料</h4><pre>"+plainMails.join("\n")+"</pre>":""}${qrCombinedHtml?"<h4>QR / 順豐資訊</h4>"+qrCombinedHtml:""}${messageHtml}</div>`;

  MailApp.sendEmail({to:RECIPIENT_EMAIL,subject:String(currTag)+" 寄送通知",body:"請使用支持 HTML 的郵件檢視器查看完整內容。",htmlBody,inlineImages});
  return "通知 Email 已寄出 ("+currTag+")";
}

// ─────────────────────────────────────────────
//  sendGroupEmail（開團通知 Email）
// ─────────────────────────────────────────────
function sendGroupEmail(groupId) {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet     = ss.getSheetByName("Data");
  const currencySheet = ss.getSheetByName("Currency");
  const groupData     = dataSheet.getRange("H2:J").getValues();
  const currencyData  = currencySheet.getRange("A2:H").getValues();
  const normalize     = str => String(str).trim();

  const selectedGroupRow    = groupData.find(row => normalize(row[0]) === normalize(groupId));
  const selectedCurrencyRow = currencyData.find(row => normalize(row[0]) === normalize(groupId));
  if (!selectedGroupRow)    throw new Error(`找不到團號 ${groupId} 的日期資料`);
  if (!selectedCurrencyRow) throw new Error(`找不到團號 ${groupId} 的匯率資料`);

  const [group, startDate, endDate] = selectedGroupRow;
  const rate1=selectedCurrencyRow[4],rate2=selectedCurrencyRow[6],rate3=selectedCurrencyRow[7];
  const format = date => Utilities.formatDate(new Date(date), "Asia/Taipei", "M月d日（E）");
  const fOffset = (date, offset) => { const d=new Date(date);d.setDate(d.getDate()+offset);return format(d); };

  const subject=`【Mercari代購｜${group}開始啦！${format(endDate)}截】`;
  const htmlBody=`【Mercari代購｜${group}開始啦！${format(endDate)}截】<br><br>
୨୧┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈୨୧<br>
<b>收單時間</b>｜${format(startDate)} 至 ${format(endDate)}<br>
<b>日本寄出日</b>｜預計 ${fOffset(endDate,1)}<br>
<b>香港到貨日</b>｜預計 ${fOffset(endDate,7)} 後<br>
୨୧┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈୨୧<br><br>
✓ 無其他手續費<br>✓ 收到款項即時代拍<br>✓ 到港後以順豐到付／郵局易寄取／平郵寄出<br><br>
<b>本團匯率（以每團每位客人總金額計算）：</b><br>
・¥1～10,000 → ${rate1}算<br>・¥10,001～50,000 → ${rate2}算<br>・¥50,001或以上 → ${rate3}算<br>
<b>到港運費：</b>HK$4.5／50g（50g起跳，超過50g以實重計算）<br><br>
&#128073;&#127995; 歡迎dm/wts查詢 &#128269;<br>
*<i>wts link可以喺profile搵到</i> &#129392;<br>
&#128242; +852 9337 5712<br><br>
#Mercari代購 #日本限定 #代購推薦`;

  GmailApp.sendEmail(RECIPIENT_EMAIL, subject, "", { htmlBody });
  return subject;
}

// ─────────────────────────────────────────────
//  sendGroupReceiptsAsPdf
// ─────────────────────────────────────────────
function sendGroupReceiptsAsPdf(group) {
  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet  = ss.getSheetByName("Record");
  const receiptSheet = ss.getSheetByName("Receipt");
  const emailTo      = Session.getActiveUser().getEmail();
  if (!recordSheet || !receiptSheet) throw new Error("找不到 Record 或 Receipt 工作表");

  const recordData  = recordSheet.getDataRange().getValues();
  const matchedRows = recordData.slice(1).filter(row => row[2] === `${group}到貨`);
  if (!matchedRows.length) throw new Error(`找不到符合「${group}到貨」的紀錄`);

  const folder=DriveApp.createFolder(`Receipts_${group}_${new Date().toISOString()}`);
  const pdfBlobs=[],messageParts=[];

  matchedRows.forEach(row=>{
    const name=row[0],groupTag=row[2],amount=parseFloat(row[6]),total=parseFloat(row[7]),
          method=row[8],code=row[9],phone=row[10],addr=row[11],trackingNo=row[12];
    receiptSheet.getRange("B2:E2").clearContent();
    receiptSheet.getRange("G1").setValue(name);
    receiptSheet.getRange("G3").setValue(groupTag);
    receiptSheet.getRange("B2").setValue(method);
    receiptSheet.getRange("C2").setValue(code);
    receiptSheet.getRange("D2").setValue(phone);
    receiptSheet.getRange("E2").setValue(addr);
    SpreadsheetApp.flush();
    const finalName=receiptSheet.getRange("G1").getValue().toString().trim();
    const finalGroup=receiptSheet.getRange("G3").getValue().toString().trim();
    const pdf=createPdfFromSheet(receiptSheet,`Receipt_${finalName}_${finalGroup}`);
    folder.createFile(pdf);pdfBlobs.push(pdf);

    let part=`${name}\n客人你好, ${group}到貨嘅貨品已運往香港途中~\n\n請客人核對表格中嘅收件資料, 並可以隨時支付國際運費HK$${amount}`;
    if(method==="易寄取 (7-11)"||method==="易寄取 (櫃位/ 智郵站)"){
      const local=method==="易寄取 (7-11)"?13:total<500?10:13;
      part+=`\n及易寄取郵費HK$${local}, 共HK$${(amount+local).toFixed(1)}🙏🏻\n\n如果收件資料冇更改，我哋會用以下運單編號寄出：\n${trackingNo||"（未提供）"}`;
    }else if(method==="SF"){
      part+=`\n香港運費部分會由順豐收取\n\n如果收件資料冇更改，我哋會用以下運單編號寄出：\n${trackingNo||"（未提供）"}`;
    }else if(method==="平郵"){
      part+=`\n🙏🏻\n香港平郵郵費部分會於寄出後提供寄出證明時收取`;
    }
    part+="\n\n謝謝!\n";
    messageParts.push(part);
    Utilities.sleep(500);
  });

  MailApp.sendEmail({to:emailTo,subject:`📎 ${group} 到貨收據 PDF`,body:`附件為 ${group} 的到貨收據，共 ${pdfBlobs.length} 份\n\n${messageParts.join("\n")}`,attachments:pdfBlobs});
  folder.setTrashed(true);
  return `✅ 已產生 ${pdfBlobs.length} 份收據 PDF 並寄出`;
}

function createPdfFromSheet(sheet, filename) {
  const spreadsheet=sheet.getParent(),sheetId=sheet.getSheetId();
  const url=`https://docs.google.com/spreadsheets/d/${spreadsheet.getId()}/export?`;
  const lastDataRow=getLastDataRowBeforeFirstN(sheet);
  const exportOptions={exportFormat:"pdf",format:"pdf",size:"A4",portrait:true,fitw:true,sheetnames:false,printtitle:false,pagenumbers:false,gridlines:false,fzr:false,gid:sheetId,range:`A1:J${lastDataRow}`};
  const params=Object.keys(exportOptions).map(k=>`${k}=${encodeURIComponent(exportOptions[k])}`).join("&");
  const token=ScriptApp.getOAuthToken(),headers={Authorization:`Bearer ${token}`};
  for(let attempts=1;attempts<=5;attempts++){
    try{
      const response=UrlFetchApp.fetch(url+params,{headers,muteHttpExceptions:true});
      const blob=response.getBlob();
      if(!blob.getContentType().includes("pdf")||blob.getDataAsString().includes("<html"))throw new Error("Invalid PDF");
      return blob.setName(`${filename}.pdf`);
    }catch(e){if(attempts===5)throw new Error("Google 拒絕導出 PDF");Utilities.sleep(1000*attempts);}
  }
}

function getLastDataRowBeforeFirstN(sheet) {
  const aValues=sheet.getRange("A10:A101").getDisplayValues();
  const kValues=sheet.getRange("K10:K101").getDisplayValues();
  for(let i=0;i<kValues.length;i++){if(kValues[i][0].toString().trim().toUpperCase()==="N")return 9+i;}
  for(let i=aValues.length-1;i>=0;i--){if(aValues[i][0].toString().trim()!=="")return 9+i+1;}
  return 9;
}

// ─────────────────────────────────────────────
//  exportArrivalData（執貨 → Record）
// ─────────────────────────────────────────────
function exportArrivalData(group) {
  if (!group) return '請提供團次';

  const ss              = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet      = ss.getSheetByName('訂單');
  const recordSheet     = ss.getSheetByName('Record');
  const deliverySheet   = ss.getSheetByName('收件資料');

  const arrivalTitle    = String(group).trim() + '到貨';

  // ── 讀取「訂單」分頁 ──
  // A=0(編號/到貨團次), B=1(date), C=2(Position), D=3(ID),
  // O=14(Code), Q=16(Net weight KG), R=17(Postage HKD), A欄即係到貨團次
  const orderData  = orderSheet.getDataRange().getValues();
  const orderHeader= orderData[0];

  // 篩選：A欄（index 0）等於所選團號的訂單
  const groupRows  = orderData.slice(1).filter(row =>
    String(row[0]).trim() === String(group).trim()
  );

  if (!groupRows.length) {
    return `找不到「${group}」的訂單，請確認訂單分頁 A 欄已分配團次`;
  }

  // ── 讀取「收件資料」分頁 ──
  // A=0(用戶名稱前半), B=1(用戶名稱後半), C=2(第X團購買),
  // D=3(郵寄方式), E=4(收件人), F=5(電話), G=6(地址)
  const deliveryData = deliverySheet.getLastRow() >= 2
    ? deliverySheet.getRange(2, 1, deliverySheet.getLastRow() - 1, 7).getValues()
    : [];

  // 建立查找表：key = "A--B"（用戶名稱），value = 最後一筆收件資料
  // 由底部開始計算，所以先反轉再建 Map（後面相同 key 唔會覆蓋前面，即保留最底部）
  const deliveryMap = new Map();
  for (let i = deliveryData.length - 1; i >= 0; i--) {
    const row     = deliveryData[i];
    const partA   = String(row[0] || '').trim();
    const partB   = String(row[1] || '').trim();
    if (!partA && !partB) continue;
    const key     = partA && partB ? `${partA}--${partB}` : partA || partB;
    if (!deliveryMap.has(key)) {
      deliveryMap.set(key, {
        method   : String(row[3] || '').trim(), // D: 郵寄方式
        receiver : String(row[4] || '').trim(), // E: 收件人
        phone    : String(row[5] || '').trim(), // F: 電話
        address  : String(row[6] || '').trim()  // G: 地址
      });
    }
  }

  // ── 按用戶名稱整合訂單 ──
  // 用戶名稱格式：C欄--D欄（例如 IG--abc）
  const custMap = new Map(); // key = 用戶名稱

  for (const row of groupRows) {
    const pos    = String(row[2]  || '').trim(); // C: Position
    const id     = String(row[3]  || '').trim(); // D: ID
    const code   = String(row[14] || '').trim(); // O: Code
    const weightKg = parseFloat(row[16]) || 0;   // Q: Net weight (KG) — 已是 KG
    const postage  = parseFloat(row[17]) || 0;   // R: Postage (HKD)

    if (!pos || !id) continue;
    const userName = `${pos}--${id}`;

    if (!custMap.has(userName)) {
      custMap.set(userName, { codes: [], totalWeightKg: 0, totalPostage: 0, qty: 0 });
    }
    const d = custMap.get(userName);
    if (code) d.codes.push(code);
    d.totalWeightKg += weightKg;
    d.totalPostage  += postage;
    d.qty           += 1;
  }

  // ── 計算「整體貨品編號」──
  // 取所有 code 中數字最細的那個
  // 注意：code 超過 1000 會從頭計算（即 1001→1, 1002→2...）
  // 所以比較時用原始數字，取最細值
  function getMarkFromCodes(codes) {
    if (!codes.length) return '';
    const nums = codes.map(c => parseInt(c) || 0);
    const minNum = Math.min(...nums);
    const minIdx = nums.indexOf(minNum);
    return codes[minIdx];
  }

  // ── 建立 Record 輸出 ──
  const output = [];

  for (const [userName, d] of custMap.entries()) {
    const codesStr  = d.codes.join(', ');
    const mark      = getMarkFromCodes(d.codes);
    const postage   = parseFloat((d.totalPostage < 4.5 ? 4.5 : d.totalPostage).toFixed(1));
    const weightG   = Math.round(d.totalWeightKg * 1000); // KG → g

    // 從「收件資料」搵最新收件資訊
    const delivery  = deliveryMap.get(userName) || {};
    const method    = delivery.method   || '';
    const receiver  = delivery.receiver || '';
    const phone     = delivery.phone    || '';
    const address   = delivery.address  || '';

    output.push([
      userName,      // A: 用戶名稱
      '',            // B: 第X團購買（空白）
      arrivalTitle,  // C: 第X團到貨
      d.qty,         // D: 到貨數量
      codesStr,      // E: 貨品編號
      mark,          // F: 整體貨品編號
      postage,       // G: 郵費
      weightG,       // H: 重量(g)
      method,        // I: 郵寄方式
      receiver,      // J: 收件人
      phone,         // K: 電話
      address,       // L: 地址
      ''             // M: Tracking no.（空白）
    ]);
  }

  if (!output.length) return `「${group}」沒有可匯出的資料`;

  // ── 寫入 Record ──
  const recordLastRow = recordSheet.getLastRow();
  recordSheet.getRange(recordLastRow + 1, 1, output.length, output[0].length).setValues(output);

  return `已匯出 ${output.length} 筆到貨資料到 Record（${arrivalTitle}）`;
}

// ─────────────────────────────────────────────
//  onEdit
// ─────────────────────────────────────────────
function onEdit(e) {
  if(!e||!e.range)return;
  const lock=LockService.getScriptLock();
  try{lock.tryLock(3000);}catch(err){return;}
  try{
    const sheet=e.range.getSheet(),range=e.range,row=range.getRow(),col=range.getColumn();
    if(sheet.getName()!=="訂單")return;
    if(range.getNumRows()>1||range.getNumColumns()>1){
      const triggerCols=[3,4,5,6,7,8,16];
      if(triggerCols.includes(col)){if(col===16)assignGroupByArrivalDate();if(col===7)populateArrivals();}
      if(col===8)updateOrdersCurrencyAndChargeWeighted();
      if(col===4){updateUniquePlatformUser();updateUniqueRecipients();}
      if(col===7)updateSerialNumberInColO();
      return;
    }
    const AB_COL=28,abCell=sheet.getRange(row,AB_COL),originalAbValue=abCell.getValue();
    const abHadManualValue=(originalAbValue!==null&&originalAbValue.toString().trim()!=="");
    const triggerCols=[3,4,5,6,7,8,16];
    if(triggerCols.includes(col)){if(col===16)assignGroupByArrivalDate();if(col===7)populateArrivals();}
    if(col===8)updateOrdersCurrencyAndChargeWeighted();
    if(col===4){updateUniquePlatformUser();updateUniqueRecipients();}
    if(col===7)updateSerialNumberInColO();
    const abAfterOtherFuncs=abCell.getValue();
    if(abHadManualValue){if(abAfterOtherFuncs===null||abAfterOtherFuncs.toString().trim()==="")abCell.setValue(originalAbValue);return;}
    if(col===7){
      const jpText=sheet.getRange(row,col).getValue();
      if(jpText===""||jpText===null){abCell.clearContent();return;}
      const dataSheet=e.source.getSheetByName("Data");if(!dataSheet)return;
      const lastRow2=Math.max(2,dataSheet.getLastRow());
      const dataRangeValues=dataSheet.getRange("AC2:AD"+lastRow2).getValues();
      const keywordMap=dataRangeValues.filter(r=>r[0]&&r[1]).map(r=>[r[0].toString().trim(),r[1].toString().trim()]).sort((a,b)=>b[0].length-a[0].length);
      if(!keywordMap.length)return;
      let tempText=jpText.toString();
      const foundCn=[],seenCn=new Set();
      for(const[jpKeyword,cnName]of keywordMap){
        const idx=tempText.indexOf(jpKeyword);
        if(idx!==-1){if(!seenCn.has(cnName)){foundCn.push(cnName);seenCn.add(cnName);}tempText=tempText.substring(0,idx)+" ".repeat(jpKeyword.length)+tempText.substring(idx+jpKeyword.length);}
      }
      if(foundCn.length>0)abCell.setValue(foundCn.join(", "));
    }
  }catch(err){Logger.log("onEdit 錯誤："+err);}
  finally{try{lock.releaseLock();}catch(e){}}
}

// ─────────────────────────────────────────────
//  updateOrdersCurrencyAndChargeWeighted
// ─────────────────────────────────────────────
function updateOrdersCurrencyAndChargeWeighted() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName('訂單'),chargeSheet=ss.getSheetByName('チャージ');
  const orderData=orderSheet.getDataRange().getValues(),chargeData=chargeSheet.getDataRange().getValues();
  const orderJPYCol=7,orderCurrencyCol=12,chargeBuyJPYCol=2,chargeCurrencyCol=4,chargeAccBuyCol=6,chargeAccSellCol=7,chargeBalanceCol=8;

  let totalOrderJPY=0;
  for(let i=1;i<orderData.length;i++){const val=Number(orderData[i][orderJPYCol]);if(!isNaN(val)&&val>0)totalOrderJPY+=val;}

  const chargeRemain=[null];
  for(let i=1;i<chargeData.length;i++)chargeRemain.push(Number(chargeData[i][chargeBuyJPYCol])||0);

  let chargeIndex=1,chargeLeft=chargeRemain[chargeIndex];
  for(let i=1;i<orderData.length;i++){
    let orderJPY=Number(orderData[i][orderJPYCol])||0;
    if(orderJPY<=0){orderSheet.getRange(i+1,orderCurrencyCol+1).clearContent();continue;}
    let weightedSum=0,totalUsed=0;
    while(orderJPY>0&&chargeIndex<chargeRemain.length){
      const rate=Number(chargeData[chargeIndex][chargeCurrencyCol]);
      if(chargeLeft>=orderJPY){weightedSum+=orderJPY*rate;chargeLeft-=orderJPY;totalUsed+=orderJPY;orderJPY=0;}
      else{weightedSum+=chargeLeft*rate;totalUsed+=chargeLeft;orderJPY-=chargeLeft;chargeIndex++;chargeLeft=chargeRemain[chargeIndex]||0;}
    }
    const avgRate=totalUsed>0?weightedSum/totalUsed:0;
    const cell=orderSheet.getRange(i+1,orderCurrencyCol+1);
    cell.setValue(Number(avgRate.toFixed(4)));cell.setNumberFormat("0.0000");
  }

  let remainingOrderJPY=totalOrderJPY;
  for(let i=1;i<chargeData.length;i++){
    const buy=Number(chargeData[i][chargeBuyJPYCol])||0,accBuy=Number(chargeData[i][chargeAccBuyCol])||0;
    let used=remainingOrderJPY>=buy?buy:remainingOrderJPY;remainingOrderJPY-=used;
    const cellH=chargeSheet.getRange(i+1,chargeAccSellCol+1);
    if(buy===used){cellH.clearContent();cellH.setBackground("#eeeeee");}else{cellH.setValue(used);cellH.setBackground(null);}
    const balance=accBuy-used;
    const cellI=chargeSheet.getRange(i+1,chargeBalanceCol+1);
    if(accBuy===balance){cellI.clearContent();cellI.setBackground("#eeeeee");}else{cellI.setValue(balance);cellI.setFontColor(balance<0?'red':'black');cellI.setBackground(null);}
  }
}

// ─────────────────────────────────────────────
//  populateArrivals
// ─────────────────────────────────────────────
function populateArrivals() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName('訂單'),arrivalSheet=ss.getSheetByName('到貨');
  const orderData=orderSheet.getDataRange().getValues();
  const filtered=orderData.filter((row,i)=>i>0&&!row[15]).map(row=>{
    let formattedDate='';
    const orderedDate=row[1];
    if(orderedDate instanceof Date)formattedDate=`${orderedDate.getFullYear()}/${String(orderedDate.getMonth()+1).padStart(2,'0')}/${String(orderedDate.getDate()).padStart(2,'0')}`;
    return[formattedDate,row[2],row[3],row[4],row[5],row[6],row[13],row[14]];
  });
  const lastArrivalRow=arrivalSheet.getLastRow();
  if(lastArrivalRow>1)arrivalSheet.getRange(2,1,lastArrivalRow-1,10).clearContent();
  if(filtered.length>0)arrivalSheet.getRange(2,1,filtered.length,8).setValues(filtered);
}

// ─────────────────────────────────────────────
//  syncArrivalData
// ─────────────────────────────────────────────
function syncArrivalData() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName('訂單'),arrivalSheet=ss.getSheetByName('到貨');
  const lastRow=arrivalSheet.getLastRow();
  if(lastRow<=1){SpreadsheetApp.getUi().alert("沒有可同步的到貨資料！");return;}
  const arrivalData=arrivalSheet.getRange(2,1,lastRow-1,10).getValues();
  const orderData=orderSheet.getDataRange().getValues();
  const orderMap={},orderMapByCode={};
  for(let i=1;i<orderData.length;i++){
    const pos=orderData[i][2],id=orderData[i][3],code=orderData[i][14],rowNum=i+1;
    if(pos&&id&&code)orderMap[`${pos}|||${id}|||${code}`]=rowNum;
    if(code)orderMapByCode[code]=rowNum;
  }
  const rowsToDelete=[];let updatedRows=0;const transactionUrls=[];
  for(let i=0;i<arrivalData.length;i++){
    const row=arrivalData[i],pos=row[1],id=row[2],code=row[7],arrivalDate=row[8],netWeight=row[9];
    if(!code||!arrivalDate||!netWeight)continue;
    const orderRow=orderMap[`${pos}|||${id}|||${code}`]||orderMapByCode[code];
    if(orderRow){
      const dateObj=arrivalDate instanceof Date?arrivalDate:new Date(arrivalDate);
      orderSheet.getRange(orderRow,16).setValue(dateObj);orderSheet.getRange(orderRow,16).setNumberFormat("yyyy/m/d");
      orderSheet.getRange(orderRow,17).setValue(netWeight);
      const url=row[4];if(url&&url.includes("mercari.com/item/"))transactionUrls.push(`• ${url.replace("/item/","/transaction/")}`);
      rowsToDelete.push(i+2);updatedRows++;
    }
  }
  rowsToDelete.sort((a,b)=>b-a).forEach(row=>arrivalSheet.deleteRow(row));
  assignGroupByArrivalDate();
  SpreadsheetApp.getUi().alert(`完成同步，更新 ${updatedRows} 筆資料！`);
  if(transactionUrls.length>0)GmailApp.sendEmail(RECIPIENT_EMAIL,"Mercari代購--已到貨商品","以下商品已到貨：\n\nこの度はお取引ありがとうございました。\nまた機会がありましたらよろしくお願い致します。\n\n"+transactionUrls.join("\n\n"));
}

// ─────────────────────────────────────────────
//  assignGroupByArrivalDate / assignGroupByOrderDate
// ─────────────────────────────────────────────
function assignGroupByArrivalDate() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName("訂單"),dataSheet=ss.getSheetByName("Data");
  const orderData=orderSheet.getRange(2,1,orderSheet.getLastRow()-1,16).getValues();
  const dataRows=dataSheet.getRange(2,8,dataSheet.getLastRow()-1,3).getValues();
  const results=[];
  for(const orderRow of orderData){
    let arrival=orderRow[15],groupId="";
    if(arrival&&!(arrival instanceof Date)){const parsed=new Date(arrival);if(!isNaN(parsed.getTime()))arrival=parsed;}
    if(arrival instanceof Date){
      for(let[group,start,end]of dataRows){
        if(start&&!(start instanceof Date)){const p=new Date(start);if(!isNaN(p.getTime()))start=p;}
        if(end&&!(end instanceof Date)){const p=new Date(end);if(!isNaN(p.getTime()))end=p;}
        if(start instanceof Date&&end instanceof Date&&arrival>=start&&arrival<=end){groupId=group;break;}
      }
    }
    results.push([groupId]);
  }
  orderSheet.getRange(2,1,results.length,1).setValues(results);
}

function assignGroupByOrderDate() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName("訂單"),dataSheet=ss.getSheetByName("Data");
  const orderData=orderSheet.getRange(2,1,orderSheet.getLastRow()-1,27).getValues();
  const dataRows=dataSheet.getRange(2,8,dataSheet.getLastRow()-1,3).getValues();
  const result=[];
  for(const orderRow of orderData){
    const orderDate=orderRow[1];let groupId="";
    if(orderDate instanceof Date){for(const[group,start,end]of dataRows){if(start instanceof Date&&end instanceof Date&&orderDate>=start&&orderDate<=end){groupId=group;break;}}}
    result.push([groupId]);
  }
  orderSheet.getRange(2,27,result.length,1).setValues(result);
}

// ─────────────────────────────────────────────
//  updateSerialNumberInColO
// ─────────────────────────────────────────────
function updateSerialNumberInColO() {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("訂單");
  const lastRow=sheet.getLastRow(),itemValues=sheet.getRange(2,7,lastRow-1,1).getValues();
  const result=[];let counter=1;
  for(const[hasValue]of itemValues){if(hasValue){result.push([counter]);counter=counter>=1000?1:counter+1;}else result.push([""]);}
  sheet.getRange(2,15,result.length,1).setValues(result);
}

// ─────────────────────────────────────────────
//  updateUniquePlatformUser / updateUniqueRecipients
// ─────────────────────────────────────────────
function updateUniquePlatformUser() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName("訂單"),dataSheet=ss.getSheetByName("Data");
  const orderData=orderSheet.getRange(2,3,orderSheet.getLastRow()-1,2).getValues();
  const uniquePairs=new Map();
  orderData.forEach(([platform,user])=>{if(platform&&user)uniquePairs.set(`${platform}|||${user}`,[platform,user]);});
  const output=Array.from(uniquePairs.values());
  dataSheet.getRange(2,12,dataSheet.getLastRow(),2).clearContent();
  if(output.length>0)dataSheet.getRange(2,12,output.length,2).setValues(output);
}

function updateUniqueRecipients() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName("訂單"),targetSheet=ss.getSheetByName("收件資料");
  const lastRow=orderSheet.getLastRow();if(lastRow<2)return;
  const orderData=orderSheet.getRange(2,3,lastRow-1,25).getValues();
  const targetData=targetSheet.getRange(2,1,Math.max(targetSheet.getLastRow()-1,0),3).getValues();
  const existingKeys=new Set(targetData.filter(r=>r[0]&&r[1]&&r[2]).map(r=>`${r[0]}||${r[1]}||${r[2]}`));
  const newRows=[];
  for(const row of orderData){
    const c=row[0],d=row[1],aa=row[24];
    if(c&&d&&aa){const key=`${c}||${d}||${aa}購買`;if(!existingKeys.has(key)){newRows.push([c,d,aa+'購買']);existingKeys.add(key);}}
  }
  if(newRows.length>0){const lastRowColA=targetSheet.getRange("A:A").getValues().filter(String).length;targetSheet.getRange(lastRowColA+1,1,newRows.length,3).setValues(newRows);}
}

// ─────────────────────────────────────────────
//  Gmail 自動化
// ─────────────────────────────────────────────
function logMercariOrders() {
  const labelName="Processed-Mercari";
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("訂單");
  const threads=GmailApp.search(`label:inbox -label:${labelName} subject:"【メルカリ】ご購入ありがとうございます"`);
  for(const thread of threads){
    for(const message of thread.getMessages()){
      if(message.getSubject()!=="【メルカリ】ご購入ありがとうございます")continue;
      const body=message.getPlainBody();
      const dateReceived=Utilities.formatDate(message.getDate(),Session.getScriptTimeZone(),"yyyy/MM/dd");
      const itemIdMatch=body.match(/商品ID\s*:\s*(m\d+)/),itemNameMatch=body.match(/商品名\s*:\s*(.+)/),itemPriceMatch=body.match(/商品代金\s*:\s*￥([\d,]+)/);
      if(!itemIdMatch||!itemNameMatch||!itemPriceMatch)continue;
      const itemUrl="https://jp.mercari.com/item/"+itemIdMatch[1];
      const existingUrls=sheet.getRange("F2:F"+sheet.getLastRow()).getValues().flat();
      if(existingUrls.includes(itemUrl))continue;
      const nextRow=sheet.getRange("B:B").getValues().filter(r=>r[0]).length+1;
      sheet.getRange(nextRow,2).setValue(dateReceived);sheet.getRange(nextRow,5).setValue("Mercari");
      sheet.getRange(nextRow,6).setValue(itemUrl);sheet.getRange(nextRow,7).setValue(itemNameMatch[1].trim());
      sheet.getRange(nextRow,8).setValue(itemPriceMatch[1].replace(/,/g,""));
    }
    thread.addLabel(GmailApp.createLabel(labelName));
  }
  try{assignGroupByOrderDate();}catch(e){console.error(e);}
  try{populateArrivals();}catch(e){console.error(e);}
  try{updateSerialNumberInColO();}catch(e){console.error(e);}
  try{updateOrdersCurrencyAndChargeWeighted();}catch(e){console.error(e);}
}

/**
 * 處理 Mercari Shops 訂單確認 email
 * Subject 格式：【Shop名】ご注文ありがとうございます
 * 提取：訂單 link、商品名、價格、日期 → 寫入「訂單」分頁
 */
function processMercariShopsEmails() {
  const labelName = "Processed-MercariShops";
  const sheet     = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("訂單");

  // 搵所有 Mercari Shops 訂單確認 email（未處理過）
  // Subject 包含「ご注文ありがとうございます」同 from mercari-shops.com
  // 三種搜尋：直接收到 / Fwd: 前綴 / forwarded body 含 mercari-shops
  const q1 = `label:inbox -label:${labelName} from:no-reply@mercari-shops.com newer_than:30d`;
  const q2 = `label:inbox -label:${labelName} subject:"ご注文ありがとうございます" newer_than:30d`;
  const q3 = `label:inbox -label:${labelName} subject:"Fwd" "mercari-shops.com" "ご注文ありがとうございます" newer_than:30d`;

  const seenIds = new Set();
  const threads = [...GmailApp.search(q1), ...GmailApp.search(q2), ...GmailApp.search(q3)]
    .filter(t => { if(seenIds.has(t.getId()))return false; seenIds.add(t.getId()); return true; });

  if (threads.length === 0) return;

  // 取得 F欄現有所有 link，避免重複
  const lastRow      = sheet.getLastRow();
  const existingUrls = lastRow >= 2
    ? sheet.getRange("F2:F" + lastRow).getValues().flat().map(v => String(v).trim())
    : [];

  const label = GmailApp.createLabel(labelName);

  for (const thread of threads) {
    let threadHasProcessed = false;

    for (const message of thread.getMessages()) {
      const plainBody = message.getPlainBody();

      // 只處理包含「ご注文ありがとうございます」嘅 message
      // 避免同 thread 嘅「発送されました」等其他 email 被標籤
      const isOrderConfirm = plainBody.includes('ご注文ありがとうございます') ||
                             message.getSubject().includes('ご注文ありがとうございます');
      if (!isOrderConfirm) continue;

      // 1. 訂單 link
      const orderMatch = plainBody.match(/https?:\/\/mercari-shops\.com\/orders\/([A-Za-z0-9]+)/);
      if (!orderMatch) continue;
      const orderUrl = `https://mercari-shops.com/orders/${orderMatch[1]}`;

      // 重複檢查
      if (existingUrls.includes(orderUrl)) continue;

      // 2. 商品名（支援全形冒號）
      const itemNameMatch = plainBody.match(/商品名\s*[：:]\s*(.+)/);
      if (!itemNameMatch) continue;
      const itemName = itemNameMatch[1].trim();

      // 3. 價格（支援全形冒號）
      let price = '';
      const priceMatch1 = plainBody.match(/商品価格\s*[：:]\s*[¥￥]([\d,]+)/);
      const priceMatch2 = plainBody.match(/注文金額合計\s*[：:]\s*[¥￥]([\d,]+)/);
      const priceMatch3 = plainBody.match(/商品代金\s*[：:]\s*[¥￥]([\d,]+)/);
      const pm = priceMatch1 || priceMatch3 || priceMatch2;
      if (pm) price = pm[1].replace(/,/g, '');

      // 4. 日期
      const dateReceived = Utilities.formatDate(
        message.getDate(), Session.getScriptTimeZone(), "yyyy/MM/dd"
      );

      // 5. 寫入訂單分頁
      const nextRow = sheet.getRange("B:B").getValues().filter(r => r[0]).length + 1;
      sheet.getRange(nextRow, 2).setValue(dateReceived);
      sheet.getRange(nextRow, 5).setValue("Mercari");
      sheet.getRange(nextRow, 6).setValue(orderUrl);
      sheet.getRange(nextRow, 7).setValue(itemName);
      if (price) sheet.getRange(nextRow, 8).setValue(price);

      existingUrls.push(orderUrl);
      threadHasProcessed = true;
      Logger.log(`Mercari Shops 新增：${itemName} | ${orderUrl}`);
    }

    // 只有成功處理過訂單確認 email 才加 label
    if (threadHasProcessed) thread.addLabel(label);
  }

  try { assignGroupByOrderDate(); }               catch(e) { console.error(e); }
  try { populateArrivals(); }                      catch(e) { console.error(e); }
  try { updateSerialNumberInColO(); }              catch(e) { console.error(e); }
  try { updateOrdersCurrencyAndChargeWeighted(); } catch(e) { console.error(e); }
}

function updateOrdersFromGmail() {
  processTrackingNumberEmails();
  processBuyerInfoEmails();
  processMercariShopsEmails();
  [{name:"populateArrivals",fn:populateArrivals},{name:"updateChineseNamesByKeyword",fn:updateChineseNamesByKeyword}].forEach(task=>{
    try{task.fn();console.log(task.name+" ✅");}catch(e){console.error(task.name+" ❌:",e);}
  });
}

function processTrackingNumberEmails() {
  const threads=GmailApp.search('subject:"メルカリ送り状番号" newer_than:7d');
  if(!threads.length)return;
  const ss=SpreadsheetApp.getActiveSpreadsheet(),orderSheet=ss.getSheetByName('訂單');
  const data=orderSheet.getDataRange().getValues();if(data.length<2)return;
  const header=data[0],linkCol=header.indexOf('Link'),trackingCol=header.indexOf('Photo/送り状番号');
  if(linkCol===-1||trackingCol===-1)return;
  threads.forEach(thread=>{
    let updated=false;
    thread.getMessages().forEach(msg=>{
      const body=msg.getPlainBody(),idMatch=body.match(/m\d{11}/),trackingMatch=body.match(/\b\d{12}\b/);
      if(!idMatch||!trackingMatch)return;
      const linkToFind=`https://jp.mercari.com/item/${idMatch[0].trim()}`;
      for(let r=1;r<data.length;r++){
        if(String(data[r][linkCol]).trim()===linkToFind){
          if(String(data[r][trackingCol]).trim()!=='')break;
          orderSheet.getRange(r+1,trackingCol+1).setValue(`送り状番号：${trackingMatch[0].trim()}`);
          updated=true;break;
        }
      }
    });
    if(updated)thread.moveToArchive();
  });
}

function processBuyerInfoEmails() {
  const threads=GmailApp.search('subject:"メルカリ購入者" newer_than:7d');
  if(!threads.length)return;
  const ss=SpreadsheetApp.getActiveSpreadsheet(),orderSheet=ss.getSheetByName('訂單');
  const data=orderSheet.getDataRange().getValues();if(data.length<2)return;
  const linkCol=data[0].indexOf('Link');if(linkCol===-1)return;
  threads.forEach(thread=>{
    let updated=false;
    thread.getMessages().forEach(msg=>{
      const body=msg.getPlainBody(),idMatches=[...body.matchAll(/m\d{11}/g)];
      if(!idMatches.length)return;
      let platform='';
      if(/IG/i.test(body))platform='IG';else if(/Whatsapp/i.test(body))platform='Whatsapp';else if(/Carousell/i.test(body))platform='Carousell';
      const buyerMatch=body.match(/購入者：\s*(.+)/),buyerName=buyerMatch?buyerMatch[1].trim():'';
      idMatches.forEach(match=>{
        const linkToFind=`https://jp.mercari.com/item/${match[0]}`;
        for(let r=1;r<data.length;r++){
          if(String(data[r][linkCol]).trim()===linkToFind){
            if(platform&&String(data[r][2]).trim()==='')orderSheet.getRange(r+1,3).setValue(platform);
            if(buyerName&&String(data[r][3]).trim()==='')orderSheet.getRange(r+1,4).setValue(buyerName);
            updated=true;break;
          }
        }
      });
    });
    if(updated)thread.moveToArchive();
  });
  updateUniqueRecipients();
}

function updateChineseNamesByKeyword() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet=ss.getSheetByName("訂單"),dataSheet=ss.getSheetByName("Data");
  const dataRange=dataSheet.getRange("AC2:AD"+dataSheet.getLastRow()).getValues();
  const keywordMap=dataRange.filter(r=>r[0]&&r[1]).map(r=>[r[0].toString().trim(),r[1].toString().trim()]);
  const lastRow=orderSheet.getLastRow(),jpValues=orderSheet.getRange("G2:G"+lastRow).getValues();
  const output=jpValues.map(row=>{
    const cellText=row[0]?row[0].toString():"";if(!cellText)return[""];
    for(const[jp,cn]of keywordMap){if(cellText.includes(jp))return[cn];}
    return[""];
  });
  orderSheet.getRange("AB2:AB"+lastRow).setValues(output);
}

function emailBuyerSheetDaily() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const buyerSheet=ss.getSheetByName("Buyer"),arrivalSheet=ss.getSheetByName("到貨");
  const emailTo=Session.getActiveUser().getEmail();
  let buyerData=[],lastRow=buyerSheet.getLastRow();
  if(lastRow>=2){const values=buyerSheet.getRange(1,5,lastRow,3).getDisplayValues();values.forEach((row,i)=>{if(i===0)buyerData.push(row);else if(row[0]&&row[1]&&row[2])buyerData.push(row);});}
  let arrivalData=[],missingIDList=[],arrivalLastRow=arrivalSheet.getLastRow();
  if(arrivalLastRow>=2){
    const arrRange=arrivalSheet.getRange(1,2,arrivalLastRow,7).getDisplayValues();
    arrRange.slice(1).forEach(row=>{
      const[position,itemId,,link,item,,code]=row;
      if(link&&item&&code)arrivalData.push({link,item,code});
      if((!position||!itemId)&&link&&link.includes("https://jp.mercari.com/item/")){const match=link.match(/item\/([a-zA-Z0-9]+)/);if(match)missingIDList.push({id:match[1],link});}
    });
  }
  if(buyerData.length<=1&&!arrivalData.length&&!missingIDList.length){MailApp.sendEmail({to:emailTo,subject:"每日 Buyer + 到貨 分頁資料",body:"目前沒有符合條件的資料。"});return;}
  let html="<h2>每日 Buyer + 到貨 分頁資料</h2>";
  if(buyerData.length>1){html+="<h3>Buyer 分頁資料</h3><table border='1' cellspacing='0' cellpadding='5' style='border-collapse:collapse;'>";buyerData.forEach((row,i)=>{html+="<tr>"+row.map(cell=>i===0?`<th style='background:#f2f2f2;'>${cell}</th>`:`<td>${cell||""}</td>`).join('')+"</tr>";});html+="</table>";}
  else html+="<h3>Buyer 分頁資料</h3><p>沒有符合條件的 Buyer 資料。</p>";
  if(arrivalData.length){html+="<br><h3>到貨分頁資料</h3><table border='1' cellspacing='0' cellpadding='5' style='border-collapse:collapse;'><tr><th style='background:#f2f2f2;'>Code</th><th style='background:#f2f2f2;'>Link</th><th style='background:#f2f2f2;'>Item</th></tr>";arrivalData.forEach(obj=>{html+=`<tr><td>${obj.code}</td><td><a href='${obj.link}' target='_blank'>${obj.link}</a></td><td>${obj.item}</td></tr>`;});html+="</table>";}
  if(missingIDList.length){html+="<br><br>";missingIDList.forEach(obj=>{html+=obj.link+"<br>商品ID："+obj.id+"<br><br>購入者：<br><br>";});}
  MailApp.sendEmail({to:emailTo,subject:"每日 Buyer + 到貨 分頁資料 ("+Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd")+")",htmlBody:html});
}

// ─────────────────────────────────────────────
//  Public Sheet 同步（每 10 分鐘）
// ─────────────────────────────────────────────
function syncMainDataAndUsers() {
  const sourceSS=SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet=sourceSS.getSheetByName(SOURCE_SHEET_NAME);
  const lastRow=sourceSheet.getLastRow();if(lastRow<2)return;
  const publicSS=SpreadsheetApp.openById(PUBLIC_SHEET_ID);
  const recordSheet=publicSS.getSheetByName(RECORD_SHEET_NAME),userSheet=publicSS.getSheetByName(USER_SHEET_NAME);
  const bToH=sourceSheet.getRange(2,2,lastRow-1,7).getValues(),colL=sourceSheet.getRange(2,12,lastRow-1,1).getValues();
  const colO=sourceSheet.getRange(2,15,lastRow-1,1).getValues(),colAA=sourceSheet.getRange(2,27,lastRow-1,1).getValues();
  const clearRows=recordSheet.getLastRow()-1;
  if(clearRows>0){recordSheet.getRange(2,2,clearRows,7).clearContent();recordSheet.getRange(2,12,clearRows,1).clearContent();recordSheet.getRange(2,15,clearRows,1).clearContent();recordSheet.getRange(2,27,clearRows,1).clearContent();}
  recordSheet.getRange(2,2,bToH.length,7).setValues(bToH);recordSheet.getRange(2,12,colL.length,1).setValues(colL);
  recordSheet.getRange(2,15,colO.length,1).setValues(colO);recordSheet.getRange(2,27,colAA.length,1).setValues(colAA);
  syncUserNamesInternal_(recordSheet,userSheet);
}

function syncUserNamesInternal_(recordSheet, userSheet) {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const lastRow=recordSheet.getLastRow();if(lastRow<2)return;
    const customerIds=recordSheet.getRange(2,4,lastRow-1,1).getValues().flat().filter(String);
    const uniqueIds=[...new Set(customerIds)];
    const userLastRow=userSheet.getLastRow();
    const userData=userLastRow>1?userSheet.getRange(2,1,userLastRow-1,2).getValues():[];
    const idToUsername={},usedUsernames=new Set();
    userData.forEach(([id,username])=>{if(id&&username){idToUsername[id]=username;usedUsernames.add(username);}});
    const output=[],repairOutput=[];
    uniqueIds.forEach(id=>{
      if(!idToUsername[id]){let username;do{username=generateUsername();}while(usedUsernames.has(username));usedUsernames.add(username);output.push([id,username]);}
      else if(idToUsername[id]===''){let username;do{username=generateUsername();}while(usedUsernames.has(username));usedUsernames.add(username);repairOutput.push([id,username]);}
    });
    if(output.length>0)userSheet.getRange(userLastRow+1,1,output.length,2).setValues(output);
    if(repairOutput.length>0){const idColumn=userSheet.getRange(2,1,userLastRow-1,1).getValues().flat();repairOutput.forEach(([id,username])=>{const rowIndex=idColumn.indexOf(id);if(rowIndex!==-1)userSheet.getRange(rowIndex+2,2).setValue(username);});}
  }finally{lock.releaseLock();}
}

function syncDailyColumns() {
  const sourceSS=SpreadsheetApp.getActiveSpreadsheet(),sourceSheet=sourceSS.getSheetByName(SOURCE_SHEET_NAME);
  const publicSS=SpreadsheetApp.openById(PUBLIC_SHEET_ID),recordSheet=publicSS.getSheetByName(RECORD_SHEET_NAME);
  const lastRow=sourceSheet.getLastRow();if(lastRow<2)return;
  const n=lastRow-1;
  recordSheet.getRange(2,1,n,1).setValues(sourceSheet.getRange(2,1,n,1).getValues());
  recordSheet.getRange(2,16,n,1).setValues(sourceSheet.getRange(2,16,n,1).getValues());
  recordSheet.getRange(2,17,n,1).setValues(sourceSheet.getRange(2,17,n,1).getValues());
  recordSheet.getRange(2,19,n,1).setValues(sourceSheet.getRange(2,19,n,1).getValues());
}

// ─────────────────────────────────────────────
//  輔助函數
// ─────────────────────────────────────────────
function generateUsername(length=15){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';let result='';for(let i=0;i<length;i++)result+=chars.charAt(Math.floor(Math.random()*chars.length));return result;}
function formatDate(date){if(!date)return'';if(!(date instanceof Date)){const parsed=new Date(date);if(!isNaN(parsed.getTime()))date=parsed;else return String(date);}return`${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;}
function formatPhoneNumber(phone){const p=String(phone).replace(/[^0-9]/g,'').trim();return p.length===8?p.slice(0,4)+' '+p.slice(4):p;}

function createSFAddressLookup(addressRange){
  const lookup={};
  addressRange.slice(1).forEach(row=>{
    const code=String(row[0]||'').trim().toUpperCase();
    if(code&&/[A-Z0-9]/.test(code))lookup[code]=['香港',String(row[2]||'').trim(),String(row[3]||'').trim(),String(row[4]||'').trim()];
    else if(code)Logger.log(`警告：地址表忽略了非標準編號: "${code}"`);
  });
  return lookup;
}

function createProductNameLookup(orderRange){
  const lookup={},headers=orderRange[0];
  const idxCode=headers.indexOf('Code'),idxDesc=headers.indexOf('物品內容');
  if(idxCode===-1||idxDesc===-1){Logger.log("錯誤：缺少 'Code' 或 '物品內容' 標頭");return lookup;}
  for(let i=orderRange.length-1;i>=1;i--){
    const productId=String(orderRange[i][idxCode]||'').trim(),productName=String(orderRange[i][idxDesc]||'').trim();
    if(productId&&productName)lookup[productId]=productName;
  }
  return lookup;
}

function processConsignmentName(productCodeStr,productNameLookup){
  if(!productCodeStr)return'';
  const rawCodes=String(productCodeStr).split(',').map(c=>c.trim()).filter(Boolean);
  const nameCounts={};
  rawCodes.forEach(code=>{const resolvedName=productNameLookup[code]||code;nameCounts[resolvedName]=(nameCounts[resolvedName]||0)+1;});
  return Object.entries(nameCounts).map(([name,count])=>count>1?`${name}*${count}`:name).join(', ');
}

function extractAndValidateSFCode(addressStr,addressLookup,validCodes){
  if(!addressStr)return null;
  const str=String(addressStr).trim().toUpperCase();
  const matchSecure=str.match(/\^([A-Z0-9]+)\^/);
  if(matchSecure&&matchSecure[1]&&addressLookup[matchSecure[1]])return matchSecure[1];
  for(const code of validCodes){
    const boundaryRegex=new RegExp(`(^|[^A-Z0-9])(${code})([^A-Z0-9]|$)`,'i');
    const match=str.match(boundaryRegex);
    if(match&&addressLookup[match[2].trim()])return match[2].trim();
  }
  return null;
}

// ─── getCustomerGroupSummary_ ───
// Reads 訂單 sheet, filters by AA column (購入時團號),
// groups by C--D, sums H (JPY), weighted-avg I (Currency)
function getCustomerGroupSummary_(group) {
  if (!group) return { error: '請提供團號' };
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName('訂單');
  const lastRow    = orderSheet.getLastRow();
  if (lastRow < 2) return { group, rows: [] };

  const data = orderSheet.getRange(2, 1, lastRow - 1, 27).getValues();
  const custMap = new Map();

  for (const row of data) {
    const groupAA = String(row[26] || '').trim(); // AA
    if (groupAA !== String(group).trim()) continue;
    const pos  = String(row[2] || '').trim();  // C
    const id   = String(row[3] || '').trim();  // D
    const jpy  = parseFloat(row[7]) || 0;      // H
    const rate = parseFloat(row[8]) || 0;      // I

    if (!pos || !id) continue;
    const userName = `${pos}--${id}`;
    if (!custMap.has(userName)) custMap.set(userName, { totalJpy: 0, rateSum: 0 });
    const d = custMap.get(userName);
    d.totalJpy += jpy;
    d.rateSum  += jpy * rate;
  }

  const rows = [];
  for (const [name, d] of custMap.entries()) {
    const avgRate = d.totalJpy > 0 ? d.rateSum / d.totalJpy : 0;
    rows.push({
      name,
      totalJpy: Math.round(d.totalJpy),
      rate    : avgRate > 0 ? Number(avgRate.toFixed(4)) : null
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { group, rows };
}
