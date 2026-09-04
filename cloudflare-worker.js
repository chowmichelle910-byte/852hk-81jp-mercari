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
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9'
      }
    });
    const html = await res.text();
    let name = null, price = null;

    // 1. Next.js __NEXT_DATA__ (Fril / PayPay FM)
    const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nd) {
      try {
        const d = JSON.parse(nd[1]);
        const pp = d?.props?.pageProps;
        const item = pp?.item || pp?.itemData || pp?.itemDetail?.item || {};
        name  = item.name  || item.title || null;
        price = item.price != null ? parseInt(item.price) : null;
      } catch(e) {}
    }

    // 2. JSON-LD
    if (!name || !price) {
      const jlds = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const [, content] of jlds) {
        try {
          const obj = JSON.parse(content);
          if (!name)  name  = obj.name  || obj.offers?.name  || null;
          if (!price) price = obj.offers?.price != null ? parseInt(obj.offers.price) : null;
          if (name && price) break;
        } catch(e) {}
      }
    }

    // 3. og:title + price regex
    if (!name) {
      const m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"'<>]+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']og:title["']/i);
      if (m) name = m[1].replace(/\s*[-–|ー]\s*(フリル|Fril|ラクマ|PayPay|メルカリ|Mercari).*$/i, '').trim();
    }
    if (!price) {
      const m = html.match(/"price"\s*:\s*"?(\d+)"?/i) || html.match(/¥\s*([\d,]+)/);
      if (m) price = parseInt(m[1].replace(/,/g, ''));
    }

    return { name: name || null, price: price || null };
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
async function gas(params) {
  const body = new URLSearchParams({ password: GAS_PASS, ...params });
  const res  = await fetch(GAS_URL, { method: 'POST', body, redirect: 'follow' });
  return res.json();
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
const SPAM_KEYWORDS = ['БОТЫ', 'ПРОБИВА', 'ФИО', 'Госномеру', 'VIN', 'пробив', 'пробить', 't.me/'];

async function handleUpdate(update) {
  // ── 垃圾訊息自動刪除 ──
  const msg = update.message;
  if (msg && msg.text) {
    const isSpam = SPAM_KEYWORDS.some(kw => msg.text.includes(kw));
    if (isSpam) {
      await tg('deleteMessage', { chat_id: String(msg.chat.id), message_id: msg.message_id });
      return;
    }
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
      const result = await gas({ action: 'getUnratedItems' });
      const items  = result.items || [];
      if (!items.length) {
        await tg('sendMessage', { chat_id: chatId, text: '✅ 沒有待評價的商品' });
        return;
      }
      const lines = items.map((u, i) => {
        const label = [u.code, u.name].filter(Boolean).join('  ');
        return `${i + 1}. ${label ? label + '\n' : ''}<a href="${u.tUrl}">${u.tUrl}</a>`;
      }).join('\n\n');
      await tg('sendMessage', {
        chat_id: chatId,
        text: `⭐ <b>待評價（${items.length} 件）</b>\n\n${lines}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⭐ 已評價', callback_data: 'rated_all' }]] }
      });
      return;
    }

    if (text === '/pending' || text.startsWith('/pending@')) {
      const data = await gas({ action: 'getPendingOrders' });
      if (!data.orders || !data.orders.length) {
        await tg('sendMessage', { chat_id: chatId, text: '✅ 沒有待填 Position/ID 的訂單' });
        return;
      }
      const positions = data.positions || [];
      const posButtons = positions.length
        ? positions.map(p => [{ text: p, callback_data: `pos:${p}`.substring(0, 64) }])
        : [['IG', 'WTS', '其他'].map(p => ({ text: p, callback_data: `pos:${p}` }))];

      const prevPos = data.prevPos || '';
      const prevId  = data.prevId  || '';
      for (const order of data.orders) {
        const kb = positions.length
          ? positions.map(p => [{ text: p, callback_data: `pos:${order.rowNum}:${p}`.substring(0, 64) }])
          : [['IG', 'WTS', '其他'].map(p => ({ text: p, callback_data: `pos:${order.rowNum}:${p}` }))];
        if (prevPos && prevId) {
          kb.unshift([{ text: `📋 同上 (${prevPos} ${prevId})`, callback_data: `copy_prev:${order.rowNum}`.substring(0, 64) }]);
        }
        kb.push([{ text: '🗑️ 刪除訂單', callback_data: `del_order:${order.rowNum}` }]);
        await tg('sendMessage', {
          chat_id: chatId,
          text: `📋 <b>待填訂單</b>${order.code ? '  ' + order.code : ''}\n` +
                (order.itemUrl ? `🔗 ${order.itemUrl}\n` : '') +
                `\n係哪個 <b>Position</b>？` +
                (order.code ? `\n_code:${order.code}_` : ''),
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: kb }
        });
      }
    }
    return;
  }

  // ── Callback Query ──
  const cb = update.callback_query;
  if (!cb) return;
  const chatId = String(cb.message.chat.id);
  const msgId  = cb.message.message_id;
  const data   = cb.data || '';
  const parts  = data.split(':');
  const action = parts[0];

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
    const result = await gas({ action: 'getCustomersByPosition', pos });
    const ids    = result.ids || [];

    // 取訂單資料顯示（從原訊息解析）
    const origText = cb.message.text || '';
    const codeM    = origText.match(/_code:(.+?)_/);
    const posCode  = codeM ? codeM[1] : '';
    const urlM     = origText.match(/🔗\s*(https?:\/\/\S+)/);
    const posUrl   = urlM ? urlM[1] : '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
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
    const result = await gas({ action: 'getCustomersByPosition', pos });
    const ids    = result.ids || [];
    const origText = cb.message.text || '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageReplyMarkup', {
      chat_id: chatId, message_id: msgId,
      reply_markup: custKeyboard(ids, rowNum, pos, offset)
    });

  } else if (action === 'id') {
    const rowNum = parts[1];
    const pos    = parts[2];
    const selId  = parts.slice(3).join(':');
    await gas({ action: 'writePositionId', row: rowNum, pos, id: selId });
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ 已填入！' });
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
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: '📬 送り状番号を選択しました',
      reply_markup: { inline_keyboard: [] }
    });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ 請輸入送り状番号：\n_ship:${rowNum}_`,
      reply_markup: { force_reply: true, selective: true }
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

  } else if (action === 'rated' || action === 'rated_all') {
    const body = new URLSearchParams({ password: GAS_PASS, action: 'clearAllUnrated' });
    const resp = await fetch(GAS_URL, { method: 'POST', body, redirect: 'follow' });
    const text = await resp.text();
    console.log(`clearAllUnrated status=${resp.status} body=${text.substring(0, 300)}`);
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ 已記錄！' });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n✅ 已評價！',
      parse_mode: 'HTML'
    });
  }
}

// ─── Cloudflare Worker Entry Point ───────────────
export default {
  async fetch(request, env) {
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
