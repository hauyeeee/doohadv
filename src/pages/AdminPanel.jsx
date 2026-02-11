import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Monitor, 
  Calendar, 
  Settings, 
  Plus, 
  Search, 
  MoreHorizontal, 
  X, 
  Save, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

// Mock Data for Charts
const revenueData = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 2000 },
  { name: 'Thu', revenue: 2780 },
  { name: 'Fri', revenue: 8890 },
  { name: 'Sat', revenue: 9390 },
  { name: 'Sun', revenue: 3490 },
];

const hourlyTrafficData = [
  { time: '10:00', visitors: 1200 },
  { time: '12:00', visitors: 3500 },
  { time: '14:00', visitors: 2800 },
  { time: '16:00', visitors: 4100 },
  { time: '18:00', visitors: 6500 },
  { time: '20:00', visitors: 8900 },
  { time: '22:00', visitors: 9200 },
  { time: '00:00', visitors: 7000 },
];

export default function DOOHAdminPanel() {
  const [activeTab, setActiveTab] = useState('screens');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial Data (as per your request)
  const [screens, setScreens] = useState([
    {
      id: 1,
      name: '#1 中環德己立街 20-22號',
      location: '德己立街 20-22號',
      district: 'Central',
      basePrice: 65,
      status: 'Active',
      resolution: '1920x1080',
      operatingHours: '10:00 - 02:00',
      footfall: '55,000',
      audience: 'Tourists, Locals',
      images: ['','',''],
      slots: {} // Simplified for demo
    }
  ]);

  // Form State
  const [currentScreen, setCurrentScreen] = useState({
    id: null,
    name: '',
    location: '',
    district: 'Central',
    basePrice: '',
    resolution: '',
    operatingHours: '',
    footfall: '',
    audience: '',
    images: ['', '', ''],
    slots: {} 
  });

  // --- Logic to Handle Opening the Modal ---
  const openAddModal = () => {
    // 1. Calculate the next ID based on existing screens
    const maxId = screens.length > 0 ? Math.max(...screens.map(s => s.id)) : 0;
    const nextId = maxId + 1;

    // 2. Reset the form with the new ID
    setCurrentScreen({
      id: nextId,
      name: '',
      location: '',
      district: 'Central',
      basePrice: '',
      resolution: '',
      operatingHours: '',
      footfall: '',
      audience: '',
      images: ['', '', ''],
      slots: {}
    });
    
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // Basic validation
    if (!currentScreen.name || !currentScreen.basePrice) {
      alert("Please fill in Name and Base Price");
      return;
    }

    setScreens([...screens, { ...currentScreen, status: 'Active' }]);
    setIsModalOpen(false);
  };

  // Slot Configuration Helper (Visual Only for this demo)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [selectedDay, setSelectedDay] = useState('Mon');

  // Helper to toggle slot type (just visual state for now)
  const [slotConfig, setSlotConfig] = useState({}); 
  const toggleSlot = (hour) => {
    const key = `${selectedDay}-${hour}`;
    const current = slotConfig[key];
    let next = 'base';
    if (!current || current === 'base') next = 'gold';
    else if (current === 'gold') next = 'prime';
    else next = 'base';
    
    setSlotConfig({ ...slotConfig, [key]: next });
  };

  const getSlotColor = (hour) => {
    const key = `${selectedDay}-${hour}`;
    const type = slotConfig[key];
    if (type === 'prime') return 'bg-purple-500 border-purple-600';
    if (type === 'gold') return 'bg-yellow-400 border-yellow-500';
    return 'bg-white border-slate-300';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold tracking-wider">ADMIN</div>
          <h1 className="text-lg font-bold text-slate-800">DOOH 後台系統</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors">
            智能結算
          </button>
          <button className="px-4 py-2 bg-red-800 text-white rounded-lg text-sm font-medium hover:bg-red-900 transition-colors flex items-center gap-2">
            <AlertCircle size={16} />
            正式截標 (只殺過期)
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-60px)]">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 hidden md:block">
          <nav className="p-4 space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard size={18} />
              數據總覽
            </button>
            <button 
              onClick={() => setActiveTab('screens')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'screens' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Monitor size={18} />
              屏幕管理
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg">
              <Calendar size={18} />
              排程總表
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg">
              <DollarSign size={18} />
              財務報表
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg">
              <Settings size={18} />
              系統設定
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          
          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-500 text-sm font-medium">總收入 (本週)</h3>
                    <DollarSign className="text-green-500" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-slate-900">$142,380</p>
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <TrendingUp size={12} /> +12.5% vs 上週
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-500 text-sm font-medium">總人流 (LKF)</h3>
                    <Users className="text-blue-500" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-slate-900">128,400</p>
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <TrendingUp size={12} /> +8.2% vs 上週
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-500 text-sm font-medium">屏幕佔用率</h3>
                    <Monitor className="text-purple-500" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-slate-900">85%</p>
                  <p className="text-xs text-slate-400 mt-2">Prime Time 100% 滿檔</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">每週收入趨勢</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">每小時人流 (平均)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyTrafficData}>
                        <defs>
                          <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="visitors" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorVisitors)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREENS VIEW */}
          {activeTab === 'screens' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Monitor className="text-slate-400" />
                  屏幕管理
                </h2>
                <button 
                  onClick={openAddModal}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus size={16} />
                  Add Screen
                </button>
              </div>

              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search screens..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Districts</option>
                    <option>Central</option>
                    <option>Causeway Bay</option>
                    <option>Tsim Sha Tsui</option>
                  </select>
                  <select className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Status</option>
                    <option>Active</option>
                    <option>Maintenance</option>
                  </select>
                </div>
              </div>

              {/* Screens Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-600">ID</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">屏幕名稱</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">地區</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">底價 (Base)</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">狀態</th>
                      <th className="px-6 py-4 font-semibold text-slate-600 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {screens.map((screen) => (
                      <tr key={screen.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-500">#{screen.id}</td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{screen.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{screen.location}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{screen.district}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">${screen.basePrice}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {screen.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600">
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {screens.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    No screens found. Add one to get started.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ADD SCREEN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus size={20} /> Add New Screen
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              
              {/* Basic Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Screen ID (Manual)
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={currentScreen.id} 
                      disabled 
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-500 text-sm"
                    />
                    <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">ID is auto-assigned by system.</p>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Screen Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. LKF Main Tower LED" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={currentScreen.name}
                    onChange={(e) => setCurrentScreen({...currentScreen, name: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Base Price ($)
                  </label>
                  <input 
                    type="number" 
                    placeholder="e.g. 180" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={currentScreen.basePrice}
                    onChange={(e) => setCurrentScreen({...currentScreen, basePrice: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Location
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1 D'Aguilar Street" 
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={currentScreen.location}
                    onChange={(e) => setCurrentScreen({...currentScreen, location: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    District
                  </label>
                  <input 
                    type="text" 
                    value={currentScreen.district}
                    onChange={(e) => setCurrentScreen({...currentScreen, district: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Images Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Images (URL)
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((idx) => (
                    <input 
                      key={idx}
                      type="text" 
                      placeholder={`Image URL ${idx + 1}`}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={currentScreen.images[idx]}
                      onChange={(e) => {
                        const newImages = [...currentScreen.images];
                        newImages[idx] = e.target.value;
                        setCurrentScreen({...currentScreen, images: newImages});
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Tech Specs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Resolution</label>
                  <input type="text" placeholder="1920x1080" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" 
                    value={currentScreen.resolution} onChange={(e) => setCurrentScreen({...currentScreen, resolution: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operating Hours</label>
                  <input type="text" placeholder="10:00 - 04:00" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" 
                    value={currentScreen.operatingHours} onChange={(e) => setCurrentScreen({...currentScreen, operatingHours: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Footfall</label>
                  <input type="text" placeholder="50,000" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" 
                    value={currentScreen.footfall} onChange={(e) => setCurrentScreen({...currentScreen, footfall: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Audience</label>
                  <input type="text" placeholder="Tourists" className="w-full border border-slate-300 rounded px-3 py-2 text-sm" 
                    value={currentScreen.audience} onChange={(e) => setCurrentScreen({...currentScreen, audience: e.target.value})}
                  />
                </div>
              </div>

              {/* Slot Configurator */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-700 text-sm">Slot Configuration (Prime/Gold)</h4>
                  <button className="text-xs text-blue-600 font-medium hover:underline bg-blue-50 px-2 py-1 rounded">
                    Copy to All Days
                  </button>
                </div>
                
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {days.map(day => (
                    <button 
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedDay === day ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {hours.map(hour => (
                    <div 
                      key={hour} 
                      onClick={() => toggleSlot(hour)}
                      className={`
                        cursor-pointer border rounded p-2 text-center transition-all hover:shadow-md
                        ${getSlotColor(hour)}
                      `}
                    >
                      <div className="text-[10px] text-slate-500 font-medium mb-1">{hour}:00</div>
                      <div className="flex justify-center gap-1">
                         <div className={`w-2 h-2 rounded-full ${slotConfig[`${selectedDay}-${hour}`] === 'prime' ? 'bg-white' : 'border border-slate-300'}`}></div>
                         <div className={`w-2 h-2 rounded-full ${slotConfig[`${selectedDay}-${hour}`] === 'gold' ? 'bg-white' : 'border border-slate-300'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-4 text-xs text-slate-500">
                   <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded-full"></div> Prime Slot</div>
                   <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded-full"></div> Gold Slot</div>
                   <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-slate-300 rounded-full"></div> Base Slot</div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                Save Screen
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}