/******************** 基本設定（公開 Sheet） ********************/
const RECORD_SHEET = 'Record';
const USER_SHEET   = 'User name';
const DATA_SHEET   = 'Data';
const ADMIN_PASSWORD = '4916';

/** 主 Sheet 設定 **/
const MAIN_SPREADSHEET_ID = '1atlq0x0P0p2aBZJ-ErJGpYS69m2efnLHPpKdZTjL9LA';
const MAIN_ORDER_SHEET = '訂單';
const MAIN_POS_COL     = 3;  // C
const MAIN_ID_COL      = 4;  // D
const MAIN_LINK_COL    = 6;  // F (商品網址)
const MAIN_TRACK_COL   = 14; // N (Photo/送り状番号)
const MAIN_DATE_COL    = 16; // P
const MAIN_WEIGHT_COL  = 17; // Q
const MAIN_IMAGE_COL   = 19; // S

/** Telegram 設定 **/
const TG_TOKEN_SUB   = '8932041338:AAHRcNR1BNoLHU4sXdVSD2uZyQQ2PQN0ECI';
const TG_CHAT_ID_SUB = '8392318130';

/******************** GET：分流處理 ********************/
function doGet(e) {
  // 🆕 新增：獲取購買人清單 (私密網頁用，不需密碼)
  if (e && e.parameter && e.parameter.action === 'getBuyerList') {
    return getBuyerList_(e.parameter.platform);
  }

  // 1. 【處理寄出日期】
  if (e && e.parameter && e.parameter.action === 'getShipmentNotice') {
    return getShipmentNotice_();
  }

  const ss = SpreadsheetApp.getActive();
  const userSheet   = ss.getSheetByName(USER_SHEET);
  const recordSheet = ss.getSheetByName(RECORD_SHEET);
  const dataSheet   = ss.getSheetByName(DATA_SHEET);

  // 2. 【處理客戶查詢】
  if (e && e.parameter && e.parameter.username) {
    const username = String(e.parameter.username).trim();
    const userRows = userSheet.getRange(2, 1, Math.max(0, userSheet.getLastRow() - 1), 2).getValues();
    const user = userRows.find(r => r[1] === username);
    if (!user) return json({ error: 'Invalid username' });

    const customerId = user[0];
    const lastRecRow = recordSheet.getLastRow();
    const records = (lastRecRow < 2) ? [] : recordSheet.getRange(2, 1, lastRecRow - 1, recordSheet.getLastColumn()).getValues();

    const orders = records
      .filter(r => r[3] === customerId)
      .map(r => ({
        arrival: r[0] || '',
        orderedDate: r[1] ? Utilities.formatDate(new Date(r[1]), 'GMT+8', 'yyyy-MM-dd') : '',
        shop: r[4] || '',
        link: r[5] || '',
        item: r[6] || '',
        jpy:  r[7] || '',
        img:  r[18] || '',
        code: r[14] || '',
        weight: parseFloat(r[16]) || 0
      }));
    return json({ customerId, orders });
  }

  // 3. 【管理員與初始化預設】
  const lastRow = dataSheet.getLastRow();
  if (lastRow < 2) return json({ items: [] });

  const rows = dataSheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  const result = { items: [] };
  rows.forEach(r => {
    if (r[0]) result[String(r[0]).toLowerCase()] = { icon: r[1], url: r[2] };
  });

  return json(result);
}

/******************** POST：分流處理 ********************/
function doPost(e){
  const p = e.parameter;
  const action   = String(p.action || '').trim();
  const password = String(p.password || '').trim();

  // 🆕 關鍵修正：私密網頁的功能放在密碼檢查之前 (不需密碼)
  if (action === 'submitBuyerEmail') {
    return sendBuyerEmail_(p.ids, p.platform, p.buyerName);
  }

  // --- 以下功能需要密碼 ---
  if (password !== ADMIN_PASSWORD) return json({ error:'Unauthorized' });

  if (action === 'getAdminItems') return getAdminItems_();

  if (action === 'addNewItem') {
    return addNewItem_(p.date, p.shop, p.link, p.item, p.jpy, p.pos, p.id);
  }

  if (action === 'saveArrivalData') {
    return saveArrivalData_(
      p.row, p.image, p.weight, p.arrivalDate,
      p.position, p.custId, p.link, p.track, p.status,
      p.shipDate
    );
  }

  if (action === 'getCustomerIds') return getCustomerIds_();

  if (action === 'clearAllUnrated') {
    return clearAllUnrated_(password);
  }

  if (action === 'getPickListData') return getPickListData_();

  return json({ error:'Unknown action: ' + action });
}

/******************** 核心邏輯函數 ********************/

/** 獲取特定平台的購買人 (私密網頁用) **/
function getBuyerList_(platform) {
  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return json({ buyers: [] });

    const data = sh.getRange(2, 3, lastRow - 1, 2).getValues(); // C 欄平台, D 欄購買人
    const buyers = data
      .filter(r => String(r[0]).trim() === platform)
      .map(r => String(r[1]).trim())
      .filter((v, i, a) => v && a.indexOf(v) === i); // 去重

    return json({ buyers: buyers.sort() });
  } catch (e) {
    return json({ buyers: [], error: e.toString() });
  }
}

/** 提交購買資訊並發送 Email (私密網頁用) **/
function sendBuyerEmail_(ids, platform, buyerName) {
  const myEmail = "852hk886tw@gmail.com";
  const subject = "メルカリ購入者";
  const idList = ids.split(',').map(s => s.trim()).filter(Boolean).join(', ');
  const body = `商品ID：${idList}\n${platform}\n購入者：${buyerName}`;

  try {
    MailApp.sendEmail(myEmail, subject, body);
    return json({ success: true });
  } catch (e) {
    return json({ error: e.toString() });
  }
}

function getShipmentNotice_() {
  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Currency');
    if (!sheet) return json({ success: false, error: '找不到 Currency 工作表' });

    const lastRow = sheet.getLastRow();
    if (lastRow < 9) return json({ success: false });

    const values = sheet.getRange(9, 1, lastRow - 8, 3).getValues();
    let latestRow = null;

    for (let i = values.length - 1; i >= 0; i--) {
      const groupName = values[i][0];
      const dateVal = values[i][2];
      if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        latestRow = { group: groupName, date: dateVal };
        break;
      }
    }

    if (!latestRow) return json({ success: false, msg: '找不到有效日期' });

    const nextDate = new Date(latestRow.date.getTime());
    nextDate.setDate(nextDate.getDate() + 1);

    const weekDayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const y = nextDate.getFullYear();
    const m = nextDate.getMonth() + 1;
    const d = nextDate.getDate();
    const dayName = weekDayNames[nextDate.getDay()];

    return json({
      success: true,
      text: `${latestRow.group}寄出日期：${y}/${m}/${d}(${dayName})`
    });
  } catch (e) {
    return json({ success: false, error: e.toString() });
  }
}

function clearAllUnrated_(password) {
  if (password !== ADMIN_PASSWORD) return json({ error: 'Unauthorized' });
  const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
  const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json({ success: true, count: 0 });

  const range = sh.getRange(2, 29, lastRow - 1, 1);
  const values = range.getValues();
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === "未評價") {
      values[i][0] = "";
      count++;
    }
  }
  if (count > 0) range.setValues(values);
  return json({ success: true, count: count });
}

function saveArrivalData_(row, imageUrl, weight, arrivalDate, position, custId, link, track, status, shipDate) {
  row = Number(row);
  if (!row || row < 2) return json({ error: '無效的行號' });
  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
    if (position !== undefined) sh.getRange(row, MAIN_POS_COL).setValue(position.trim());
    if (custId !== undefined) sh.getRange(row, MAIN_ID_COL).setValue(custId.trim());
    if (weight !== undefined && weight.toString().trim() !== '') sh.getRange(row, MAIN_WEIGHT_COL).setValue(weight);
    if (imageUrl && imageUrl.trim() !== '') sh.getRange(row, MAIN_IMAGE_COL).setValue(imageUrl);
    if (link !== undefined) sh.getRange(row, MAIN_LINK_COL).setValue(link.trim());
    if (track !== undefined) sh.getRange(row, MAIN_TRACK_COL).setValue(track.trim());
    const finalDate = arrivalDate || shipDate;
    if (finalDate && finalDate.trim() !== "") sh.getRange(row, MAIN_DATE_COL).setValue(finalDate);
    if (status !== undefined) sh.getRange(row, 29).setValue(status);
    assignGroupByArrivalDateRemote(ss);
    return json({ success: true });
  } catch(e) { return json({ error: e.toString() }); }
}

function assignGroupByArrivalDateRemote(ss) {
  const orderSheet = ss.getSheetByName("訂單");
  const dataSheet = ss.getSheetByName("Data");
  const lastRow = orderSheet.getLastRow();
  if (lastRow < 2) return;
  const orderData = orderSheet.getRange(2, 1, lastRow - 1, 29).getValues();
  const dataRows = dataSheet.getRange(2, 8, Math.max(1, dataSheet.getLastRow() - 1), 3).getValues();
  const results = [];
  let hasNewUnrated = false;
  for (let i = 0; i < orderData.length; i++) {
    let arrivalDate = orderData[i][15];
    let status = orderData[i][28];
    let groupId = "";
    if (arrivalDate && !(arrivalDate instanceof Date)) {
      const parsed = new Date(arrivalDate);
      if (!isNaN(parsed.getTime())) arrivalDate = parsed;
    }
    if (arrivalDate instanceof Date) {
      for (let j = 0; j < dataRows.length; j++) {
        let [group, start, end] = dataRows[j];
        if (start && !(start instanceof Date)) start = new Date(start);
        if (end && !(end instanceof Date)) end = new Date(end);
        if (start instanceof Date && end instanceof Date) {
          if (arrivalDate >= start && arrivalDate <= end) {
            groupId = group;
            break;
          }
        }
      }
      if (status === "未評價") hasNewUnrated = true;
    }
    results.push([groupId]);
  }
  orderSheet.getRange(2, 1, results.length, 1).setValues(results);
  if (hasNewUnrated) sendUnratedNotification_();
}

// 定時觸發函數：每日自動檢查有冇未評價商品，有就發 TG 通知
function dailyUnratedCheck() {
  const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
  const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const values = sh.getRange(2, 29, lastRow - 1, 1).getValues();
  const hasUnrated = values.some(r => r[0] === '未評價');
  if (hasUnrated) sendUnratedNotification_();
}

function sendUnratedNotification_() {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyy-MM-dd');
  if (props.getProperty('lastNotifyDate') === today) return; // 今天已發過
  props.setProperty('lastNotifyDate', today);

  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN_SUB}/sendMessage`;
    const payload = JSON.stringify({
      chat_id: TG_CHAT_ID_SUB,
      text: '⭐ 提醒：後台有新到貨，請進行評價',
      parse_mode: 'HTML'
    });
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true
    });
  } catch (e) {
    console.log('TG 發送失敗: ' + e.toString());
  }
}

function triggerAuth() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "授權測試", "看到這封信代表授權成功");
}

function getAdminItems_() {
  const mainSS = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
  const sh = mainSS.getSheetByName(MAIN_ORDER_SHEET);
  const currencySh = mainSS.getSheetByName("Currency");
  if (!sh) return json({ error: "找不到工作表" });
  const lastRow = sh.getLastRow();
  const values = (lastRow < 2) ? [] : sh.getRange(2, 1, lastRow - 1, 29).getValues();
  const items = values
    .filter(r => r[1] !== "" || r[6] !== "")
    .map((r, i) => ({
        row: i + 2,
        arrival: r[0] ? String(r[0]) : '',
        orderedDate: r[1] ? (r[1] instanceof Date ? Utilities.formatDate(r[1], 'GMT+8', 'yyyy-MM-dd') : r[1]) : '',
        position: r[2] || '',
        custId: r[3] || '',
        shop: r[4] || '',
        link: r[5] || '',
        item: r[6] || '',
        track: r[13] || '',
        code: r[14] || '',
        arrivalDate: r[15] ? (r[15] instanceof Date ? Utilities.formatDate(r[15], 'GMT+8', 'yyyy-MM-dd') : r[15]) : '',
        weight: parseFloat(r[16]) || 0,
        image: r[18] || '',
        status: r[28] || '',
        shipDate: r[15] ? (r[15] instanceof Date ? Utilities.formatDate(r[15], 'GMT+8', 'yyyy-MM-dd') : r[15]) : ''
    }));

  let latestShipDateText = "未有寄出資料";
  try {
    const cLastRow = currencySh.getLastRow();
    if (cLastRow >= 9) {
      const currencyData = currencySh.getRange(9, 1, cLastRow - 8, 3).getValues();
      let targetGroup = "";
      let targetDate = null;
      for (let j = currencyData.length - 1; j >= 0; j--) {
        const groupName = currencyData[j][0];
        const dateVal = currencyData[j][2];
        if (dateVal instanceof Date) { targetGroup = groupName; targetDate = dateVal; break; }
      }
      if (targetDate) {
        const nextDate = new Date(targetDate.getTime());
        nextDate.setDate(nextDate.getDate() + 1);
        const weekDayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        latestShipDateText = `${targetGroup}寄出日期：${nextDate.getFullYear()}/${nextDate.getMonth() + 1}/${nextDate.getDate()}(${weekDayNames[nextDate.getDay()]})`;
      }
    }
  } catch(e) { latestShipDateText = "日期計算出錯"; }

  return json({ items: items, latestShipDate: latestShipDateText });
}

function getCustomerIds_(){
  const userSheet = SpreadsheetApp.getActive().getSheetByName(USER_SHEET);
  const lastRow = userSheet.getLastRow();
  if (lastRow < 2) return json({ ids: [] });
  const values = userSheet.getRange(2,1,lastRow-1,1).getValues().flat().map(v=>String(v||'').trim()).filter(Boolean);
  return json({ ids: [...new Set(values)].sort() });
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function addNewItem_(date, shop, link, item, jpy, pos, id) {
  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
    const valsG = sh.getRange("G:G").getValues();
    let targetRow = 1;
    for (let i = valsG.length - 1; i >= 0; i--) { if (valsG[i][0] !== "") { targetRow = i + 2; break; } }
    sh.getRange(targetRow, 1, 1, 8).setValues([["", date, pos, id, shop, link, item, jpy]]);
    const prevNo = sh.getRange(targetRow - 1, 15).getValue();
    let lastNum = parseInt(prevNo);
    if (isNaN(lastNum) || lastNum < 0) lastNum = 0;
    sh.getRange(targetRow, 15).setValue((lastNum >= 1000) ? 1 : lastNum + 1);
    sh.getRange(targetRow, 29).setValue("未評價");
    return json({ success: true });
  } catch (err) { return json({ error: err.toString() }); }
}

function getPickListData_() {
  const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
  const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
  const currencySh = ss.getSheetByName("Currency");
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return json({ allGroups: {}, latestGroup: "" });
  const data = sh.getRange(2, 1, lastRow - 1, 19).getValues();
  let latestGroup = "";
  try {
    const cLastRow = currencySh.getLastRow();
    const cData = currencySh.getRange(9, 1, Math.max(1, cLastRow - 8), 3).getValues();
    for (let j = cData.length - 1; j >= 0; j--) {
      const dateVal = cData[j][2];
      if (dateVal instanceof Date || (dateVal && !isNaN(Date.parse(dateVal)))) { latestGroup = String(cData[j][0]).trim(); break; }
    }
  } catch(e) { latestGroup = ""; }
  let groups = {};
  data.forEach(r => {
    const groupName = String(r[0] || "").trim();
    if (!groupName || groupName === "未到貨") return;
    if (!groups[groupName]) groups[groupName] = { HK: { totalWeight: 0, customers: {} }, TW: { totalWeight: 0, customers: {} } };
    const pos = String(r[2] || "").trim(), custId = String(r[3] || "").trim(), code = String(r[14] || "").trim(), weight = parseFloat(r[16]) || 0;
    const region = (pos === "Taiwan") ? "TW" : "HK", fullId = `${pos}_${custId}`;
    groups[groupName][region].totalWeight += weight;
    if (!groups[groupName][region].customers[fullId]) groups[groupName][region].customers[fullId] = [];
    if (code !== "") groups[groupName][region].customers[fullId].push({ code: code, img: String(r[18]||""), link: String(r[4]||""), itemName: String(r[5]||"") });
  });
  return json({ latestGroup: latestGroup, allGroups: groups });
}

function completeEvaluation(row) {
  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sh = ss.getSheetByName(MAIN_ORDER_SHEET);
    sh.getRange(parseInt(row), 29).clearContent();
    return { success: true };
  } catch (err) { return { error: err.toString() }; }
}
