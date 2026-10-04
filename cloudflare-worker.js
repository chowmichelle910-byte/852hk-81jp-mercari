// ─── 設定 ──────────────────────────────────────
const TG_TOKEN   = '8932041338:AAHRcNR1BNoLHU4sXdVSD2uZyQQ2PQN0ECI';
const TG_CHAT_ID = '8392318130';
const TG_API     = `https://api.telegram.org/bot${TG_TOKEN}`;
const GAS_URL    = 'https://script.google.com/macros/s/AKfycbwT9_K4m0UvBUrZRveZJ3clzfuUCLtR1TrEok7gYDdamRtqHjk1HkZrTmLPpHuLXTRckA/exec';
const GAS_API2   = 'https://script.google.com/macros/s/AKfycby2I6Q2M67npEFW-Vqi14JS3L7rtuQ9DLD35KwhwCaGpyt3xBnRfNyeLcOGXfslA9sx/exec';
const GAS_PASS   = '4916';
const PAGE       = 6;

// ─── Telegram API ────────────────────────────────
async function tg(method, params) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return res.json();
}

// ─── 商品資料抓取 ─────────────────────────────────
async function scrapeProduct(url) {
  const fetchHtml = async (ua) => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.google.co.jp/'
      },
      redirect: 'follow'
    });
    return res.text();
  };

  try {
    const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const UA_SP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    let html = await fetchHtml(UA_PC);
    let name = null, price = null;

    // 1. Next.js __NEXT_DATA__ (Fril / PayPay FM / Rakuma)
    const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nd) {
      try {
        const d = JSON.parse(nd[1]);
        const pp = d?.props?.pageProps;
        // Yahoo FM: item is at props.initialState.itemsState.items.item
        const yItem = d?.props?.initialState?.itemsState?.items?.item;
        if (yItem) {
          name  = yItem.title || yItem.name || null;
          price = yItem.price != null ? parseInt(yItem.price) : null;
        }
        if (!name || price == null) {
          const item = pp?.item || pp?.itemData || pp?.itemDetail?.item
                    || pp?.data?.item || pp?.initialState?.item || {};
          if (!name)       name  = item.name  || item.title || null;
          if (price == null) price = item.price != null ? parseInt(item.price) : null;
          // PayPay FM: price may be nested
          if (!price && item.buyNowPrice != null) price = parseInt(item.buyNowPrice);
        }
      } catch(e) {}
    }

    // 2. JSON-LD
    if (!name || price == null) {
      const jlds = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const [, content] of jlds) {
        try {
          const obj = JSON.parse(content);
          const arr = Array.isArray(obj) ? obj : [obj];
          for (const o of arr) {
            if (!name)  name  = o.name || null;
            if (price == null) {
              const p = o.offers?.price ?? o.price ?? null;
              if (p != null) price = parseInt(p);
            }
            if (name && price != null) break;
          }
          if (name && price != null) break;
        } catch(e) {}
      }
    }

    // 3. og:title + price regex
    if (!name) {
      const m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"'<>]+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']og:title["']/i);
      if (m) name = m[1].replace(/\s*[-–|ー]\s*(フリル|Fril|ラクマ|PayPay|メルカリ|Mercari|Yahoo).*$/i, '').trim();
    }
    if (price == null) {
      const m = html.match(/"price"\s*:\s*"?(\d+)"?/i) || html.match(/¥\s*([\d,]+)/);
      if (m) price = parseInt(m[1].replace(/,/g, ''));
    }

    // 4. SP fallback if PC fetch got no data (some sites block bots with PC UA)
    if (!name && price == null) {
      html = await fetchHtml(UA_SP);
      const nd2 = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nd2) {
        try {
          const d = JSON.parse(nd2[1]);
          const pp = d?.props?.pageProps;
          const item = pp?.item || pp?.itemData || pp?.itemDetail?.item
                    || pp?.data?.item || pp?.initialState?.item || {};
          name  = item.name  || item.title || null;
          price = item.price != null ? parseInt(item.price) : null;
          if (!price && item.buyNowPrice != null) price = parseInt(item.buyNowPrice);
        } catch(e) {}
      }
      if (!name || price == null) {
        const m2 = html.match(/"price"\s*:\s*"?(\d+)"?/i) || html.match(/¥\s*([\d,]+)/);
        if (!name) {
          const mt = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"'<>]+)["']/i)
                  || html.match(/<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']og:title["']/i);
          if (mt) name = mt[1].replace(/\s*[-–|ー]\s*(フリル|Fril|ラクマ|PayPay|メルカリ|Mercari|Yahoo).*$/i, '').trim();
        }
        if (price == null && m2) price = parseInt(m2[1].replace(/,/g, ''));
      }
    }

    return { name: name || null, price: price != null ? price : null };
  } catch(e) { return { name: null, price: null }; }
}

// ─── 新訂單預覽訊息 ───────────────────────────────
async function sendNewOrderPreview(chatId, url, name, price) {
  const nd = name  != null ? String(name)  : '';
  const np = price != null ? String(price) : '';
  const nameDisplay  = nd || '❓ 未能自動取得';
  const priceDisplay = np ? `¥${parseInt(np).toLocaleString()}` : '❓ 未能自動取得';
  await tg('sendMessage', {
    chat_id: chatId,
    text: `🛒 <b>新訂單預覽</b>\n\n商品：${nameDisplay}\n價格：${priceDisplay}\n🔗 ${url}\n<tg-spoiler>_nou_:${url}\n_non_:${nd}\n_nop_:${np}</tg-spoiler>`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[
      { text: '✅ 確認新增', callback_data: 'confirm_no' },
      { text: '✏️ 改名稱',  callback_data: 'edit_no_name' },
      { text: '✏️ 改價格',  callback_data: 'edit_no_price' }
    ]] }
  });
}

// ─── GAS API ─────────────────────────────────────
async function gas(params, timeoutMs = 25000) {
  const body = new URLSearchParams({ password: GAS_PASS, ...params });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(GAS_URL, { method: 'POST', body, redirect: 'follow', signal: ctrl.signal });
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('GAS 逾時（' + timeoutMs / 1000 + 's）');
    throw e;
  }
  clearTimeout(timer);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    console.error('gas() JSON parse error. Status:', res.status, 'Body:', text.substring(0, 200));
    throw new Error('GAS returned non-JSON (status ' + res.status + '): ' + text.substring(0, 100));
  }
}

// ─── Supabase 讀取（比 GAS 快，直接查快取資料）────────
const SB_URL  = 'https://ifrjaxpgrnvjesboelra.supabase.co';
const SB_SVC  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmcmpheHBncm52amVzYm9lbHJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQwNTY5MCwiZXhwIjoyMDk3OTgxNjkwfQ.4CdxnLRiYIxg-ag1e9wSOVk_HLVxS6JoHtLMRpGQWho';

let _sbItemsCache = null;
async function sbItems() {
  if (_sbItemsCache) return _sbItemsCache;
  const res = await fetch(`${SB_URL}/rest/v1/admin_items?id=eq.1&select=payload`, {
    headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC }
  });
  const rows = await res.json();
  const payload = rows[0] && rows[0].payload ? JSON.parse(rows[0].payload) : { items: [] };
  _sbItemsCache = payload.items || [];
  return _sbItemsCache;
}

// ─── 顯示客人分頁 ─────────────────────────────────
function custKeyboard(ids, rowNum, pos, offset) {
  const page = ids.slice(offset, offset + PAGE);
  const buttons = page.map(id => [{
    text: id,
    callback_data: `id:${rowNum}:${pos}:${id}`.substring(0, 64)
  }]);
  const nav = [];
  if (offset + PAGE < ids.length)
    nav.push({ text: '➡️ 再多6個', callback_data: `pg:${rowNum}:${offset + PAGE}:${pos}`.substring(0, 64) });
  nav.push({ text: '✏️ 自己輸入', callback_data: `new_id:${rowNum}:${pos}` });
  buttons.push(nav);
  return { inline_keyboard: buttons };
}

// ─── 主邏輯 ─────────────────────────────────────
const SPAM_KEYWORDS = ['t.me/'];
const CYRILLIC_RE = /[Ѐ-ӿ]/;

async function handleUpdate(update) {
  // ── 垃圾訊息過濾（西里爾字母 or 關鍵字）──
  const msg = update.message;
  if (msg && msg.text) {
    const isSpam = CYRILLIC_RE.test(msg.text) || SPAM_KEYWORDS.some(kw => msg.text.includes(kw));
    if (isSpam) return;
  }

  // ── 文字訊息 ──
  if (msg && msg.text) {
    const chatId = String(msg.chat.id);
    const text   = msg.text.trim();

    // 回覆訊息處理
    if (msg.reply_to_message) {
      const ref = msg.reply_to_message.text || '';

      // 回覆編輯新訂單名稱
      if (ref.includes('_no_edit_name_')) {
        const url   = (ref.match(/_nou_:(\S+)/) || [])[1] || '';
        const price = (ref.match(/_nop_:(\d*)/)  || [])[1] || '';
        await sendNewOrderPreview(chatId, url, text, price ? parseInt(price) : null);
        return;
      }

      // 回覆編輯新訂單價格
      if (ref.includes('_no_edit_price_')) {
        const url  = (ref.match(/_nou_:(\S+)/) || [])[1] || '';
        const name = (ref.match(/_non_:([^\n]*)/) || [])[1] || '';
        const price = parseInt(text.replace(/[^\d]/g, ''));
        await sendNewOrderPreview(chatId, url, name, isNaN(price) ? null : price);
        return;
      }


      // 手動輸入客人 ID（回覆含 _ref:rowNum:pos_ 的訊息）
      const mRef = ref.match(/_ref:(\d+):(.+?)_/);
      if (mRef) {
        const rowNum  = mRef[1], pos = mRef[2], id = text;
        const mCode   = ref.match(/_code:(.+?)_/);
        const mUrl    = ref.match(/_url:(https?:\/\/\S+?)_/);
        const refCode = mCode ? mCode[1] : '';
        const refUrl  = mUrl  ? mUrl[1]  : '';
        const mMid = ref.match(/_mid:(\d+)_/);
        await gas({ action: 'writePositionId', row: rowNum, pos, id });
        const confirmText   = `✅${refCode ? ' (' + refCode + ')' : ''} <b>已填入</b>` +
                              (refUrl ? `\n${refUrl}` : '') +
                              `\nPosition：<b>${pos}</b>\n客人 ID：<b>${id}</b>`;
        const confirmMarkup = { inline_keyboard: [[{ text: '📬 送り状番號', callback_data: `shipped_track:${rowNum}` }]] };
        if (mMid) {
          await tg('editMessageText', { chat_id: chatId, message_id: parseInt(mMid[1]), text: confirmText, parse_mode: 'HTML', reply_markup: confirmMarkup });
        } else {
          await tg('sendMessage', { chat_id: chatId, text: confirmText, parse_mode: 'HTML', reply_markup: confirmMarkup });
        }
        return;
      }

      // 輸入送り状番号（回覆含 _ship:rowNum_ 的訊息）
      const mShip = ref.match(/_ship:(\d+)_/);
      if (mShip) {
        const rowNum = mShip[1];
        const shipResult = await gas({ action: 'writeTrackingNumber', row: rowNum, number: text });
        await tg('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>已記錄</b>\n送り状番号：<b>${text}</b>` + (shipResult.link ? `\n${shipResult.link}` : ''),
          parse_mode: 'HTML'
        });
        return;
      }

      // 充值第一步：輸入 JPY（回覆含 _charge:jpy_ 的訊息）
      if (ref.includes('_charge:jpy_')) {
        const jpy = parseFloat(text.replace(/[^\d.]/g, ''));
        if (isNaN(jpy) || jpy <= 0) {
          await tg('sendMessage', { chat_id: chatId, text: '請輸入有效嘅日圓金額（例如：50000）' });
          return;
        }
        await tg('sendMessage', {
          chat_id: chatId,
          text: `JPY：¥${jpy.toLocaleString()}\n\n請輸入港幣金額（HKD）：\n_charge:hkd:${jpy}_`,
          reply_markup: { force_reply: true, selective: true }
        });
        return;
      }

      // 充值第二步：輸入 HKD（回覆含 _charge:hkd:JPY_ 的訊息）
      const mChargeHkd = ref.match(/_charge:hkd:([\d.]+)_/);
      if (mChargeHkd) {
        const jpy = parseFloat(mChargeHkd[1]);
        const hkd = parseFloat(text.replace(/[^\d.]/g, ''));
        if (isNaN(hkd) || hkd <= 0) {
          await tg('sendMessage', { chat_id: chatId, text: '請輸入有效嘅港幣金額（例如：2500）' });
          return;
        }
        const today = new Date();
        const dateStr = `${today.getFullYear()}/${today.getMonth()+1}/${today.getDate()}`;
        const result = await gas({ action: 'addChargeRecord', date: dateStr, jpy: String(jpy), hkd: String(hkd) });
        if (result.error) {
          await tg('sendMessage', { chat_id: chatId, text: '❌ 新增失敗：' + result.error });
        } else {
          await tg('sendMessage', {
            chat_id: chatId,
            text: `✅ <b>充值記錄已新增</b>\n\n日期：${dateStr}\nJPY：¥${jpy.toLocaleString()}\nHKD：HK$${hkd.toLocaleString()}`,
            parse_mode: 'HTML'
          });
        }
        return;
      }
    }

    // /lawson ローソン到着確認
    if (text === '/lawson') {
      const d = await gas({ action: 'getLawsonPickups' });
      if (d.error) {
        await tg('sendMessage', { chat_id: chatId, text: '❌ 取得失敗：' + d.error });
        return;
      }
      const items = d.items || [];
      if (!items.length) {
        await tg('sendMessage', { chat_id: chatId, text: '📭 目前沒有「が店舗に届きました」的郵件' });
        return;
      }
      const lines = items.map((it, i) => {
        const idx = items.length > 1 ? `${i + 1}. ` : '';
        return [
          `${idx}📦 ${it.name || '（名稱未知）'}`,
          `🏪 ${it.place || '（地點未知）'}`,
          `🔢 お問い合わせ：${it.trackNo || '—'}`,
          `🔑 認証番号：${it.authNo || '—'}`,
          it.url ? `🔗 ${it.url}` : ''
        ].filter(Boolean).join('\n');
      });
      await tg('sendMessage', { chat_id: chatId, text: lines.join('\n\n') });
      return;
    }

    // /neworder 新增訂單
    if (text.startsWith('/neworder')) {
      const urlMatch = text.match(/https?:\/\/\S+/);
      if (!urlMatch) {
        await tg('sendMessage', { chat_id: chatId, text: '📎 請提供商品連結，例如：\n/neworder https://item.fril.jp/xxx' });
        return;
      }
      const url = urlMatch[0].replace(/[）)。、\s]+$/, '');
      const { name, price } = await scrapeProduct(url);
      await sendNewOrderPreview(chatId, url, name, price);
      return;
    }

    if (text === '/unrated' || text.startsWith('/unrated@')) {
      const all   = await sbItems();
      const items = all.filter(it => it.status === '未評價');
      if (!items.length) {
        await tg('sendMessage', { chat_id: chatId, text: '✅ 沒有待評價的商品' });
        return;
      }
      const lines = items.map((it, i) => {
        const label = [it.code, it.item].filter(Boolean).join('  ');
        const tUrl  = (it.link || '').includes('mercari.com/item/') ? it.link.replace('/item/', '/transaction/') : (it.link || '');
        return `${i + 1}. ${label ? label + '\n' : ''}${tUrl ? `<a href="${tUrl}">${tUrl}</a>` : ''}`;
      }).join('\n\n');
      await tg('sendMessage', {
        chat_id: chatId,
        text: `⭐ <b>待評價（${items.length} 件）</b>\n\n${lines}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⭐ 已評價', callback_data: 'rated_all' }]] }
      });
      return;
    }

    const checkMatch = text.match(/^\/check(?:@\S+)?\s+(.+)$/i);
    if (checkMatch) {
      const queryCode = checkMatch[1].trim().toUpperCase();
      const all    = await sbItems();
      const orders = all.filter(it => String(it.code || '').toUpperCase() === queryCode);
      if (!orders.length) {
        await tg('sendMessage', { chat_id: chatId, text: `❌ 找不到 code <b>${queryCode}</b> 的訂單`, parse_mode: 'HTML' });
      } else {
        const lines = orders.map((o, idx) => {
          const parts2 = [];
          parts2.push(`🔢 Code：<b>${o.code}</b>`);
          if (o.orderedDate) parts2.push(`📅 購買日期：${o.orderedDate}`);
          if (o.item)  parts2.push(`📦 商品名：${o.item}`);
          if (o.link)  parts2.push(`🔗 ${o.link}`);
          return (orders.length > 1 ? `<b>${idx+1}.</b>\n` : '') + parts2.join('\n');
        });
        await tg('sendMessage', { chat_id: chatId, text: lines.join('\n\n'), parse_mode: 'HTML' });
      }
      return;
    }

    if (text === '/charge' || text.startsWith('/charge@')) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '請輸入充值日圓金額（JPY）：\n_charge:jpy_',
        reply_markup: { force_reply: true, selective: true }
      });
      return;
    }

    if (text === '/help' || text.startsWith('/help@') || text === '/start' || text.startsWith('/start@')) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '📋 <b>可用指令</b>\n\n' +
              '/pending — 列出未填 Position/ID 的訂單\n' +
              '/sent — 列出已發送但未入 tracking 的訂單\n' +
              '/unrated — 列出待評價商品\n' +
              '/check [code] — 查詢訂單\n' +
              '/cg [position] [ID] [團號] — 查詢客人指定團號到貨狀態\n' +
              '/charge — 新增充值記錄\n' +
              '/lawson — 查詢 Lawson 到店包裹\n' +
              '/neworder [連結] — 新增訂單',
        parse_mode: 'HTML'
      });
      return;
    }

    if (text.startsWith('/cg') && (text === '/cg' || text[3] === ' ' || text[3] === '@')) {
      const all       = await sbItems();
      const positions = [...new Set(all.map(it => String(it.position || '').trim()).filter(Boolean))].sort();
      if (!positions.length) {
        await tg('sendMessage', { chat_id: chatId, text: '❌ 找不到任何訂單' });
        return;
      }
      const posButtons = positions.map(p => [{ text: p, callback_data: `cg_pos:${p}`.substring(0, 64) }]);
      await tg('sendMessage', {
        chat_id: chatId,
        text: '📦 <b>查詢到貨狀態</b>\n\n請選擇 Position：',
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: posButtons }
      });
      return;
    }

    if (text === '/sent' || text.startsWith('/sent@')) {
      const all   = await sbItems();
      const items = all.filter(it => String(it.track || '').trim() === '已發送');
      if (!items.length) {
        await tg('sendMessage', { chat_id: chatId, text: '✅ 沒有已發送待填 tracking 的訂單' });
        return;
      }
      for (const it of items) {
        const tUrl = (it.link || '').includes('mercari.com/item/') ? it.link.replace('/item/', '/transaction/') : (it.link || '');
        await tg('sendMessage', {
          chat_id: chatId,
          text: `📦 <b>已發送 — 待入 Tracking</b>${it.code ? '  ' + it.code : ''}` +
                (it.item ? '\n' + it.item : '') +
                (tUrl ? '\n' + tUrl : ''),
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[
            { text: '📮 普通郵便',   callback_data: 'shipped_futsuu:' + it.row },
            { text: '📬 送り状番号', callback_data: 'shipped_track:'  + it.row }
          ], [
            { text: '🗑️ 清除已發送', callback_data: 'clear_sent:' + it.row }
          ]] }
        });
      }
      return;
    }

    if (text === '/pending' || text.startsWith('/pending@')) {
      const all      = await sbItems();
      const orders   = all.filter(it => !it.position && !it.custId && (it.item || it.shop || it.link || it.code));
      const posSet   = [...new Set(all.map(it => String(it.position || '').trim()).filter(Boolean))].sort();
      // find most recent pos+id combo
      let prevPos = '', prevId = '';
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].position && all[i].custId) { prevPos = all[i].position; prevId = all[i].custId; break; }
      }
      if (!orders.length) {
        await tg('sendMessage', { chat_id: chatId, text: '✅ 沒有待填 Position/ID 的訂單' });
        return;
      }
      for (const order of orders) {
        const kb = posSet.length
          ? posSet.map(p => [{ text: p, callback_data: `pos:${order.row}:${p}`.substring(0, 64) }])
          : [['IG', 'WTS', '其他'].map(p => ({ text: p, callback_data: `pos:${order.row}:${p}` }))];
        if (prevPos && prevId) {
          kb.unshift([{ text: `📋 同上 (${prevPos} ${prevId})`, callback_data: `copy_prev:${order.row}`.substring(0, 64) }]);
        }
        kb.push([{ text: '🗑️ 刪除訂單', callback_data: `del_order:${order.row}` }]);
        await tg('sendMessage', {
          chat_id: chatId,
          text: `📋 <b>待填訂單</b>${order.code ? '  ' + order.code : ''}\n` +
                (order.link ? `🔗 ${order.link}\n` : '') +
                `\n係哪個 <b>Position</b>？` +
                (order.code ? `\n_code:${order.code}_` : ''),
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: kb }
        });
      }
      return;
    }
  }

  // ── Callback Query ──
  const cb = update.callback_query;
  if (!cb) return;
  const chatId = String(cb.message.chat.id);
  const msgId  = cb.message.message_id;
  const data   = cb.data || '';
  const parts  = data.split(':');
  const action = parts[0];
  try {
  // ── callback body start ──

  if (action === 'copy_prev') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const result = await gas({ action: 'copyPrevOrder', row: rowNum });
    if (result.success) {
      await tg('editMessageText', {
        chat_id: chatId, message_id: msgId,
        text: `✅${result.code ? ' (' + result.code + ')' : ''} <b>已填入（同上）</b>` +
              (result.link ? `\n${result.link}` : '') +
              `\nPosition：<b>${result.pos}</b>\n客人 ID：<b>${result.id}</b>`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '📬 送り状番號', callback_data: `shipped_track:${rowNum}` }]] }
      });
    } else {
      await tg('editMessageText', {
        chat_id: chatId, message_id: msgId,
        text: (cb.message.text || '') + '\n\n❌ 找不到上一筆紀錄'
      });
    }

  } else if (action === 'pos') {
    const rowNum = parts[1];
    const pos    = parts.slice(2).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const all  = await sbItems();
    const seen = new Set(); const ids = [];
    for (let i = all.length - 1; i >= 0; i--) {
      const p = String(all[i].position || '').trim();
      const d = String(all[i].custId   || '').trim();
      if (p === pos && d && !seen.has(d)) { seen.add(d); ids.unshift(d); }
    }
    const origText = cb.message.text || '';
    const codeM    = origText.match(/_code:(.+?)_/);
    const posCode  = codeM ? codeM[1] : '';
    const urlM     = origText.match(/🔗\s*(https?:\/\/\S+)/);
    const posUrl   = urlM ? urlM[1] : '';
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `${posCode || '訂單'}\n` +
            (posUrl ? `🔗 ${posUrl}\n` : '') +
            `Position：<b>${pos}</b>\n\n係哪個客人購入？` +
            (posCode ? `\n_code:${posCode}_` : ''),
      parse_mode: 'HTML',
      reply_markup: custKeyboard(ids, rowNum, pos, 0)
    });

  } else if (action === 'pg') {
    const rowNum = parts[1];
    const offset = parseInt(parts[2]);
    const pos    = parts.slice(3).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const all2  = await sbItems();
    const seen2 = new Set(); const ids2 = [];
    for (let i = all2.length - 1; i >= 0; i--) {
      const p = String(all2[i].position || '').trim();
      const d = String(all2[i].custId   || '').trim();
      if (p === pos && d && !seen2.has(d)) { seen2.add(d); ids2.unshift(d); }
    }
    await tg('editMessageReplyMarkup', {
      chat_id: chatId, message_id: msgId,
      reply_markup: custKeyboard(ids2, rowNum, pos, offset)
    });

  } else if (action === 'id') {
    const rowNum = parts[1];
    const pos    = parts[2];
    const selId  = parts.slice(3).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ 已填入！' });
    await gas({ action: 'writePositionId', row: rowNum, pos, id: selId });
    const origText = cb.message.text || '';
    const codeMatch = origText.match(/_code:(.+?)_/);
    const code      = codeMatch ? codeMatch[1] : '';
    const urlMatch  = origText.match(/🔗\s*(https?:\/\/\S+)/);
    const itemUrl   = urlMatch ? urlMatch[1] : '';
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `✅${code ? ' (' + code + ')' : ''} <b>已填入</b>` +
            (itemUrl ? `\n${itemUrl}` : '') +
            `\nPosition：<b>${pos}</b>\n客人 ID：<b>${selId}</b>`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📬 送り状番號', callback_data: `shipped_track:${rowNum}` }]] }
    });

  } else if (action === 'new_id') {
    const rowNum    = parts[1];
    const pos       = parts.slice(2).join(':');
    const origText2 = cb.message.text || '';
    const cm        = origText2.match(/_code:(.+?)_/);
    const refCode   = cm ? cm[1] : '';
    const um        = origText2.match(/🔗\s*(https?:\/\/\S+)/);
    const refUrl    = um ? um[1] : '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n✏️ 請回覆以輸入客人 ID',
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ 請輸入客人 ID：\n_ref:${rowNum}:${pos}_` +
            (refCode ? `\n_code:${refCode}_` : '') +
            (refUrl  ? `\n_url:${refUrl}_`  : '') +
            `\n_mid:${msgId}_`,
      reply_markup: { force_reply: true, selective: true }
    });

  } else if (action === 'skip') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '已跳過' });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n⏭ 已跳過，請手動填入'
    });

  } else if (action === 'charge_skip') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '好的' });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n❌ 跳過',
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'charge_add') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n✅ 好，請輸入日圓金額：',
      reply_markup: { inline_keyboard: [] }
    });
    await tg('sendMessage', {
      chat_id: chatId,
      text: '請輸入充值日圓金額（JPY）：\n_charge:jpy_',
      reply_markup: { force_reply: true, selective: true }
    });

  } else if (action === 'clear_sent') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await gas({ action: 'clearSentStatus', row: rowNum });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: '✅ 已清除「已發送」',
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'shipped_futsuu') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
    await gas({ action: 'writeShipMethod', row: rowNum, method: `普通郵便 ${dateStr}` });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `✅ 已記錄：普通郵便（${dateStr}）`,
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'shipped_track') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const origText = (cb.message.text || '').replace(/\n✏️ 請輸入送り状番号：\n_ship:\d+_$/, '');
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: origText + `\n✏️ 請輸入送り状番号：\n_ship:${rowNum}_`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'cancelled_notified') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ 已記錄' });
    await gas({ action: 'markCancelled', row: rowNum });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n✅ 已通知客人',
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'del_order') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n⚠️ 確認刪除此訂單？',
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[
        { text: '✅ 確認刪除', callback_data: `del_order_confirm:${rowNum}` },
        { text: '❌ 取消', callback_data: `del_order_cancel:${rowNum}` }
      ]] }
    });

  } else if (action === 'del_order_confirm') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: '⏳ 刪除中…', reply_markup: { inline_keyboard: [] } });
    const result = await gas({ action: 'deleteOrder', row: rowNum });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: result.error ? `❌ 刪除失敗：${result.error}` : `🗑️ <b>訂單已刪除</b>（第 ${rowNum} 行）`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'del_order_cancel') {
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '已取消' });
    // 還原原本訊息（移除確認提示）
    const origText = (cb.message.text || '').replace(/\n\n⚠️ 確認刪除此訂單？$/, '');
    const data = await gas({ action: 'getPendingOrders' });
    const positions = (data && data.positions) || ['IG', 'WTS', '其他'];
    const kb = positions.map(p => [{ text: p, callback_data: `pos:${rowNum}:${p}`.substring(0, 64) }]);
    kb.push([{ text: '🗑️ 刪除訂單', callback_data: `del_order:${rowNum}` }]);
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: origText, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: kb }
    });

  } else if (action === 'confirm_no') {
    const msgText = cb.message.text || '';
    const url   = (msgText.match(/_nou_:(\S+)/)    || [])[1] || '';
    const name  = (msgText.match(/_non_:([^\n]*)/) || [])[1] || '';
    const price = (msgText.match(/_nop_:(\d*)/)    || [])[1] || '';
    if (!url) { await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '找不到連結資料' }); return; }
    // 先移除按鈕防止重複點擊
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `⏳ 新增中…\n\n商品：${name || '(未填)'}\n價格：${price ? '¥' + parseInt(price).toLocaleString() : '(未填)'}\n🔗 ${url}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    });
    const result = await gas({ action: 'addNewOrder', url, name, price });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: result.error
        ? `❌ 新增失敗：${result.error}`
        : result.duplicate
        ? `⚠️ <b>已存在（未重複新增）</b>\n\n商品：${name || '(未填)'}\n價格：${price ? '¥' + parseInt(price).toLocaleString() : '(未填)'}\n🔗 ${url}`
        : `✅ <b>新訂單已新增</b>\n\n商品：${name || '(未填)'}\n價格：${price ? '¥' + parseInt(price).toLocaleString() : '(未填)'}\n🔗 ${url}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    });

  } else if (action === 'edit_no_name') {
    const msgText = cb.message.text || '';
    const url   = (msgText.match(/_nou_:(\S+)/)    || [])[1] || '';
    const price = (msgText.match(/_nop_:(\d*)/)    || [])[1] || '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ 請輸入商品名稱：\n_no_edit_name_\n_nou_:${url}\n_nop_:${price}`,
      reply_markup: { force_reply: true, selective: true }
    });

  } else if (action === 'edit_no_price') {
    const msgText = cb.message.text || '';
    const url  = (msgText.match(/_nou_:(\S+)/)    || [])[1] || '';
    const name = (msgText.match(/_non_:([^\n]*)/) || [])[1] || '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ 請輸入商品價格（日圓數字）：\n_no_edit_price_\n_nou_:${url}\n_non_:${name}`,
      reply_markup: { force_reply: true, selective: true }
    });

  } else if (action === 'cp2') {
    // GAS-style quick fill: cp2:rowNum:pos:id
    const rowNum = parts[1];
    const pos    = parts[2];
    const id     = parts.slice(3).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: pos && id ? '✅ 已填入' : '資料不足' });
    if (pos && id && rowNum) {
      const result = await gas({ action: 'writePositionId', row: rowNum, pos, id });
      const origText = cb.message.text || '';
      const codeM  = origText.match(/_code:(.+?)_/);
      const urlM   = origText.match(/🔗\s*(https?:\/\/\S+)/);
      const code   = codeM ? codeM[1] : '';
      const link   = urlM  ? urlM[1]  : '';
      const txLink = link.includes('/item/') ? link.replace('/item/', '/transaction/') : link;
      await tg('editMessageText', {
        chat_id: chatId, message_id: msgId,
        text: `✅${code ? ' (' + code + ')' : ''} <b>已填入</b>` +
              (txLink ? '\n' + txLink : '') +
              `\nPosition：<b>${pos}</b>\n客人 ID：<b>${id}</b>`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '📬 送り状番號', callback_data: `shipped_track:${rowNum}` }]] }
      });
    }

  } else if (action === 'show_pos') {
    // GAS-style: show all positions as buttons
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const data2 = await gas({ action: 'getPendingOrders' });
    const positions = (data2 && data2.positions) || ['IG', 'WTS', '其他'];
    const posRows = positions.map(p => [{ text: p, callback_data: `pos:${rowNum}:${p}`.substring(0, 64) }]);
    posRows.push([{ text: '↩️ 返回', callback_data: `back_order:${rowNum}` }]);
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: posRows } });

  } else if (action === 'back_order') {
    // GAS-style: return to original order buttons
    const rowNum = parts[1];
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const data3 = await gas({ action: 'getPendingOrders' });
    const positions = (data3 && data3.positions) || ['IG', 'WTS', '其他'];
    const kb = positions.map(p => [{ text: p, callback_data: `pos:${rowNum}:${p}`.substring(0, 64) }]);
    kb.push([{ text: '🗑️ 刪除訂單', callback_data: `del_order:${rowNum}` }]);
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: kb } });

  } else if (action === 'cg_pos') {
    const pos = parts.slice(1).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const all3 = await sbItems();
    const seen3 = new Set(); const ids3 = [];
    for (let i = all3.length - 1; i >= 0; i--) {
      const p = String(all3[i].position || '').trim();
      const d = String(all3[i].custId   || '').trim();
      if (p.toLowerCase() === pos.toLowerCase() && d && !seen3.has(d)) { seen3.add(d); ids3.unshift(d); }
    }
    if (!ids3.length) {
      await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `❌ ${pos} 下找不到客人`, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } });
      return;
    }
    const idButtons = ids3.map(id => [{ text: id, callback_data: `cg_id:${pos}:${id}`.substring(0, 64) }]);
    idButtons.push([{ text: '↩️ 返回', callback_data: 'cg_back' }]);
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `📦 <b>查詢到貨狀態</b>\n\nPosition：<b>${pos}</b>\n請選擇客人 ID：`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: idButtons }
    });

  } else if (action === 'cg_id') {
    const pos = parts[1];
    const id  = parts.slice(2).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const all4   = await sbItems();
    const seen4  = new Set(); const groups = [];
    for (let i = 0; i < all4.length; i++) {
      const p = String(all4[i].position || '').trim();
      const d = String(all4[i].custId   || '').trim();
      const g = String(all4[i].arrival  || '').trim(); // col A = 到貨團號
      if (p.toLowerCase() === pos.toLowerCase() && d.toLowerCase() === id.toLowerCase() && g && !seen4.has(g)) {
        seen4.add(g); groups.push(g);
      }
    }
    if (!groups.length) {
      await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `❌ 找不到 ${pos} ${id} 的到貨團號`, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } });
      return;
    }
    const grpButtons = groups.map(g => [{ text: `第${g}團`, callback_data: `cg_grp:${pos}:${id}:${g}`.substring(0, 64) }]);
    grpButtons.push([{ text: '↩️ 返回', callback_data: `cg_pos:${pos}` }]);
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `📦 <b>查詢到貨狀態</b>\n\nPosition：<b>${pos}</b>\n客人 ID：<b>${id}</b>\n請選擇到貨團號：`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: grpButtons }
    });

  } else if (action === 'cg_grp') {
    const pos   = parts[1];
    const id    = parts[2];
    const group = parts.slice(3).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const all5   = await sbItems();
    const matched = all5.filter(it =>
      String(it.position || '').toLowerCase() === pos.toLowerCase() &&
      String(it.custId   || '').toLowerCase() === id.toLowerCase()  &&
      String(it.arrival  || '')               === group
    );
    if (!matched.length) {
      await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `❌ 找不到 ${pos} ${id} 第${group}團的訂單`, parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } });
      return;
    }
    const arrived = matched.filter(it => it.arrivalDate).length;
    let msg = `📦 <b>${pos} ${id}</b>　第${group}團\n共 ${matched.length} 件｜已到 ${arrived}　未到 ${matched.length - arrived}\n──────────────\n`;
    for (const it of matched) {
      const statusIcon = it.arrivalDate ? '✅' : '⏳';
      const statusText = it.arrivalDate ? `已到貨 (${it.arrivalDate})` : '未到貨';
      const codePart   = it.code ? `<b>${it.code}</b>` : '—';
      const itemPart   = it.item ? ` ${it.item.length > 20 ? it.item.slice(0,20)+'…' : it.item}` : '';
      const linkPart   = it.link ? `\n   🔗 ${it.link}` : '';
      msg += `${statusIcon} ${codePart}${itemPart}　${statusText}${linkPart}\n`;
    }
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: msg, parse_mode: 'HTML', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: '↩️ 再查', callback_data: `cg_id:${pos}:${id}` }]] }
    });

  } else if (action === 'cg_back') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    const all6 = await sbItems();
    const positions6 = [...new Set(all6.map(it => String(it.position || '').trim()).filter(Boolean))].sort();
    const posButtons6 = positions6.map(p => [{ text: p, callback_data: `cg_pos:${p}`.substring(0, 64) }]);
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: '📦 <b>查詢到貨狀態</b>\n\n請選擇 Position：',
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: posButtons6 }
    });

  } else if (action === 'rated' || action === 'rated_all') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ 已記錄！' });
    const body = new URLSearchParams({ password: GAS_PASS, action: 'clearAllUnrated' });
    const resp = await fetch(GAS_URL, { method: 'POST', body, redirect: 'follow' });
    const text = await resp.text();
    console.log(`clearAllUnrated status=${resp.status} body=${text.substring(0, 300)}`);
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n✅ 已評價！',
      parse_mode: 'HTML'
    });
  }
  // ── callback body end ──
  } catch(cbErr) {
    console.error('callback error:', cbErr.message);
    await tg('sendMessage', { chat_id: chatId, text: '❌ 錯誤：' + cbErr.message });
  }
}

// ─── CORS helper ─────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

// ─── Admin API via KV cache ───────────────────────
const CACHE_KEY = 'adminItems';
const CACHE_TTL = 3600; // 1 hour

async function handleAdminApi(request, env, ctx) {
  const url = new URL(request.url);

  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // POST /api/admin  →  auth at CF, KV cache, background GAS refresh
  if (url.pathname === '/api/admin' && request.method === 'POST') {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const action = params.get('action') || '';
    const clientPw = params.get('password') || '';

    // GAS does 302 redirect; fetch follows and converts POST→GET (HTTP spec), losing body.
    // Pass params in URL query string so they survive the redirect as GET params.
    const gasUrlWithParams = GAS_URL + '?' + body;

    if (action === 'getAdminItems' && env.KV) {
      const cached = await env.KV.get(CACHE_KEY);
      if (cached) {
        // Serve cache immediately; refresh GAS in background
        ctx.waitUntil(
          fetch(gasUrlWithParams, { method: 'POST', body, redirect: 'follow' })
            .then(r => r.json())
            .then(d => { if (!d.error) return env.KV.put(CACHE_KEY, JSON.stringify(d), { expirationTtl: CACHE_TTL }); })
            .catch(() => {})
        );
        const data = JSON.parse(cached);
        data._cached = true;
        return jsonResp(data);
      }
    }

    // Cache miss or write action — forward to GAS synchronously (28s timeout)
    const gasCtrl = new AbortController();
    const gasTimer = setTimeout(() => gasCtrl.abort(), 28000);
    let res;
    try {
      res = await fetch(gasUrlWithParams, { method: 'POST', body, redirect: 'follow', signal: gasCtrl.signal });
    } catch(e) {
      clearTimeout(gasTimer);
      if (e.name === 'AbortError') return jsonResp({ error: 'GAS 逾時，請稍後重試' }, 504);
      throw e;
    }
    clearTimeout(gasTimer);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { return new Response(text, { headers: corsHeaders() }); }

    if (action === 'getAdminItems' && env.KV && !data.error) {
      await env.KV.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
    if (['saveArrival', 'saveWeight', 'savePackItem', 'updateArrival', 'saveShipDate'].includes(action) && env.KV) {
      await env.KV.delete(CACHE_KEY);
    }

    return jsonResp(data);
  }

  // POST /api/admin/invalidate  →  clear cache
  if (url.pathname === '/api/admin/invalidate' && request.method === 'POST') {
    if (env.KV) await env.KV.delete(CACHE_KEY);
    return jsonResp({ ok: true });
  }

  // POST /api/admin/seed  →  GAS pushes fresh data directly into KV
  if (url.pathname === '/api/admin/seed' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || !env.ADMIN_PASS || body.secret !== env.ADMIN_PASS) {
      return jsonResp({ error: 'forbidden' }, 403);
    }
    if (env.KV && body.data) {
      await env.KV.put(CACHE_KEY, JSON.stringify(body.data), { expirationTtl: CACHE_TTL });
    }
    return jsonResp({ ok: true });
  }

  return jsonResp({ error: 'not found' }, 404);
}

// ─── Cloudflare Worker Entry Point ───────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Admin API routes
    if (url.pathname.startsWith('/api/admin')) {
      return handleAdminApi(request, env, ctx);
    }

    // OPTIONS preflight for other routes
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') return new Response('OK');
    try {
      const update = await request.json();
      await handleUpdate(update);
    } catch (e) {
      console.error(e);
    }
    return new Response('OK');
  }
};
