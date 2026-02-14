import React from 'react';

const Terms = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 sm:p-12 border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">條款及細則</h1>
        <p className="text-slate-500 text-sm mb-8">最後更新日期：2026年2月14日</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">1. 服務性質</h2>
            <p>歡迎使用 Huntarmpeople Limited ("本公司") 的 DOOH Advertising Platform ("本平台")。閣下使用本平台即表示同意遵守以下條款。本平台提供數碼戶外廣告 (DOOH) 的競價及投放服務。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">2. 競價與付款 (重要)</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>競價機制：</strong> 廣告時段採用「價高者得」機制。在截標前，閣下的出價可能會被更高出價者超越。</li>
              <li><strong>預授權 (Pre-authorization)：</strong> 當閣下提交出價時，系統會透過 Stripe 向閣下的信用卡進行資金預授權（凍結額度）。<span className="text-red-600 font-bold">此時尚未正式扣款。</span></li>
              <li><strong>結算 (Settlement)：</strong> 系統會於每小時整點進行結算：
                <ul className="list-circle pl-5 mt-1 text-slate-600 text-sm">
                  <li><strong>中標 (Won)：</strong> 我們將從預授權金額中扣除（Capture）最終成交金額。</li>
                  <li><strong>未中標 (Lost)：</strong> 預授權額度將自動釋放（Release），退款時間視乎發卡銀行而定（通常為即時或數個工作天）。</li>
                </ul>
              </li>
              <li><strong>不設退款：</strong> 一旦競投成功並完成扣款，除因技術故障導致廣告無法播放外，所有款項<strong>不設退款</strong>。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">3. 廣告內容政策與審核</h2>
            <p className="mb-2">為保障公眾利益及屏幕擁有者權益，所有上傳之影片必須經過審核。<strong>嚴禁上傳以下內容：</strong></p>
            <ul className="list-disc pl-5 space-y-1 text-red-600 font-medium">
              <li>色情、暴力、血腥、恐怖內容。</li>
              <li>涉及政治敏感、仇恨言論、歧視或誹謗內容。</li>
              <li>侵犯版權（如未經授權的音樂、商標）的內容。</li>
              <li>虛假或誤導性內容。</li>
            </ul>
            {/* 🔥 優化退款與重交通知 */}
            <p className="mt-2 text-sm bg-slate-100 p-3 rounded">
              <strong>權利保留與審核失敗處理：</strong> Huntarmpeople Limited 保留最終決定權。如廣告內容被判定違規，我們有權拒絕播放。<strong>若因素材違規被拒，閣下將有一次機會於播放前重新提交修改後的素材。</strong> 若最終仍未能通過審核或逾期未交，該訂單將被取消，且款項將不予退還。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">4. 責任限制</h2>
            <p>如因屏幕故障、電力中斷或網絡問題導致廣告無法播放，本公司的賠償上限僅限於該受影響時段的廣告費用。本公司不對閣下的間接損失（如生意流失）負責。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">5. 法律管轄</h2>
            <p>本條款受香港特別行政區法律管轄。</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500">&copy; Huntarmpeople Limited</p>
        </div>
      </div>
    </div>
  );
};

export default Terms;