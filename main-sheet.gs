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
