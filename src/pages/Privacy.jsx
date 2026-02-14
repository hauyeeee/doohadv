import React from 'react';
import SEO from '../components/SEO';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <SEO 
        title="私隱政策" 
        description="了解 Huntarmpeople Limited 如何收集及使用閣下的資料。" 
      />
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 sm:p-12 border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">私隱政策</h1>
        <p className="text-slate-500 text-sm mb-8">最後更新日期：2026年2月14日</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <p>Huntarmpeople Limited ("本公司") 重視閣下的私隱。本政策說明我們如何收集及使用閣下的資料。</p>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">1. 我們收集的資料</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>帳戶資料：</strong> 當閣下使用 Google 登入時，我們會收集閣下的姓名、電郵地址及頭像。</li>
              <li><strong>交易資料：</strong> 我們會記錄閣下的訂單詳情（時段、出價、廣告素材）。</li>
              <li><strong>付款資料：</strong> 所有信用卡交易均由第三方支付處理商 <strong>Stripe</strong> 安全處理。本公司不會儲存閣下的完整信用卡號碼。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">2. 資料用途</h2>
            <p>我們收集的資料僅用於：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>處理競價訂單及結算。</li>
              <li>發送訂單狀態通知（如：中標、被超越通知）。</li>
              <li>審核廣告內容。</li>
              <li>遵守法律法規要求。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">3. 資料披露</h2>
            <p>我們不會將閣下的個人資料出售予第三方。我們只會在以下情況披露資料：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>服務供應商：</strong> 向協助我們營運的第三方（如 Stripe、Firebase、EmailJS）提供必要資料。</li>
              <li><strong>法律要求：</strong> 應執法機關或法庭命令要求。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">4. 資料安全</h2>
            <p>我們使用業界標準的加密技術（SSL）及安全的雲端服務（Google Firebase）來保護閣下的資料。</p>
          </section>

          {/* 🔥 新增資料保留段落 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">5. 資料保留與刪除</h2>
            <p>我們只會在達成本政策所述目的之必要期間內保留閣下的個人資料。播放完成的廣告影片素材將於播放期結束後 30 天內自動從我們的伺服器中刪除。如閣下希望刪除帳戶及相關資料，請透過電郵與我們聯絡。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 border-b pb-2">6. 聯絡我們</h2>
            <p>如對本政策有任何疑問，請聯絡 Huntarmpeople Limited。</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500">&copy; Huntarmpeople Limited</p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;