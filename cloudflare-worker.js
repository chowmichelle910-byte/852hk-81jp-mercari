// ─── 設定 ───────────────────────────────────────
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
async function handleUpdate(update) {
  // ── 文字訊息 ──
  const msg = update.message;
  if (msg && msg.text) {
    const chatId = String(msg.chat.id);
    const text   = msg.text.trim();

    // 手動輸入客人 ID（回覆含 _ref:rowNum:pos_ 的訊息）
    if (msg.reply_to_message) {
      const ref = msg.reply_to_message.text || '';
      const m   = ref.match(/_ref:(\d+):(.+)_/);
      if (m) {
        const rowNum = m[1], pos = m[2], id = text;
        await gas({ action: 'writePositionId', row: rowNum, pos, id });
        await tg('sendMessage', {
          chat_id: chatId,
          text: `✅ <b>已填入</b>\nPosition：<b>${pos}</b>\n客人 ID：<b>${id}</b>`,
          parse_mode: 'HTML'
        });
        return;
      }
    }

    if (text === '/unrated' || text.startsWith('/unrated@')) {
      const result = await gas({ action: 'getUnratedItems' });
      const items  = result.items || [];
      if (!items.length) {
        await tg('sendMessage', { chat_id: chatId, text: '✅ 沒有待評價的商品' });
        return;
      }
      const lines   = items.map((u, i) => `${i + 1}. <a href="${u.tUrl}">${u.tUrl}</a>`).join('\n');
      const allRows = items.map(u => u.rowNum).join(',');
      await tg('sendMessage', {
        chat_id: chatId,
        text: `⭐ <b>待評價（${items.length} 件）</b>\n\n${lines}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⭐ 已評價', callback_data: ('rated:' + allRows).substring(0, 64) }]] }
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

      for (const order of data.orders) {
        const kb = positions.length
          ? positions.map(p => [{ text: p, callback_data: `pos:${order.rowNum}:${p}`.substring(0, 64) }])
          : [['IG', 'WTS', '其他'].map(p => ({ text: p, callback_data: `pos:${order.rowNum}:${p}` }))];
        await tg('sendMessage', {
          chat_id: chatId,
          text: `📋 <b>待填訂單</b>${order.code ? '  ' + order.code : ''}\n` +
                (order.itemUrl ? `🔗 ${order.itemUrl}\n` : '') +
                `\n係哪個 <b>Position</b>？`,
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

  if (action === 'pos') {
    const rowNum = parts[1];
    const pos    = parts.slice(2).join(':');
    const result = await gas({ action: 'getCustomersByPosition', pos });
    const ids    = result.ids || [];

    // 取訂單資料顯示（從原訊息解析）
    const origText = cb.message.text || '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: origText.split('\n係哪個')[0] + `\nPosition：<b>${pos}</b>\n\n係哪個客人購入？`,
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
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: `✅ <b>已填入</b>\nPosition：<b>${pos}</b>\n客人 ID：<b>${selId}</b>`,
      parse_mode: 'HTML'
    });

  } else if (action === 'new_id') {
    const rowNum = parts[1];
    const pos    = parts.slice(2).join(':');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✏️ 請輸入客人 ID：\n_ref:${rowNum}:${pos}_`,
      reply_markup: { force_reply: true, selective: true }
    });

  } else if (action === 'skip') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '已跳過' });
    await tg('editMessageText', {
      chat_id: chatId, message_id: msgId,
      text: (cb.message.text || '') + '\n\n⏭ 已跳過，請手動填入'
    });

  } else if (action === 'rated') {
    const orderRows = parts.slice(1).join(':').split(',').filter(Boolean);
    // Call other GAS to mark all as evaluated
    await Promise.all(orderRows.map(orderRow => {
      const url2 = new URL(GAS_API2);
      url2.searchParams.set('password', GAS_PASS);
      url2.searchParams.set('action', 'saveArrivalData');
      url2.searchParams.set('row', orderRow);
      url2.searchParams.set('status', '');
      return fetch(url2.toString(), { redirect: 'follow' });
    }));
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
