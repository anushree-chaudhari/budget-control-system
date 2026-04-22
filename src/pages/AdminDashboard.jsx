import React, { useState, useEffect } from 'react';
import API from '../api';
import Sidebar from '../components/Sidebar';
import API_BASE_URL from '../config';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const pct = (spent, total) => { if (!total) return 0; return Math.min(100, Math.round((spent / total) * 100)); };
const pctColor = (p) => { if (p >= 90) return 'progress-red'; if (p >= 70) return 'progress-amber'; return 'progress-green'; };
const pctTextColor = (p) => { if (p >= 90) return 'stat-red'; if (p >= 70) return 'stat-amber'; return 'stat-green'; };
const getStatusBadge = (s) => {
  const map = { PENDING: 'badge-pending', APPROVED: 'badge-approved', REJECTED: 'badge-rejected', ESCALATED: 'badge-manager' };
  const icons = { PENDING: '◔', APPROVED: '✓', REJECTED: '✕', ESCALATED: '↑' };
  const str = s ? s.toUpperCase() : 'PENDING';
  return <span className={`badge ${map[str] || 'badge-pending'}`}>{icons[str] || ''}{str}</span>;
};

const AdminDashboard = () => {
  const [currentTab, setCurrentTab] = useState('overview');
  const [requests, setRequests] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [users, setUsers] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [adminBudget, setAdminBudget] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  
  // Forms
  const [budgetForm, setBudgetForm] = useState({ managerId: '', totalBudget: '', remarks: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'employee', department: 'IT', password: '', specialKey: '', budgetAmount: '' });

  const fetchAll = async () => {
    try {
      const [{ data: reqs }, { data: bgets }, { data: usrs }, { data: hist }] = await Promise.all([
        API.get('/admin/all-requests'),
        API.get('/admin/all-budgets'),
        API.get('/admin/all-users'),
        API.get('/admin/all-history')
      ]);
      setRequests(reqs.reverse());
      setBudgets(bgets);
      setUsers(usrs);
      setHistoryItems(hist.reverse());

      try {
        const { data: adminBudg } = await API.get('/admin/my-budget');
        setAdminBudget(adminBudg);
      } catch (err) {
        setAdminBudget(null);
      }
      
      try {
        const { data: notifs } = await API.get('/admin/notifications');
        setNotifications(notifs);
      } catch (err) {
        console.error("Failed fetching notifications", err);
      }
    } catch (err) {
      console.error("Failed fetching Admin data", err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [currentTab]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'budgets', label: 'Manager Budgets', icon: '⊟' },
    { id: 'users', label: 'Users', icon: '◎' },
    { id: 'escalated', label: 'Escalated Requests', icon: '↑' },
    { id: 'history', label: 'Full History Log', icon: '⊞' }
  ];

  const openAssignBudget = () => { setModalType('assignBudget'); setBudgetForm({ managerId: '', totalBudget: '', remarks: '' }); setModalOpen(true); };
  const openAddUser = () => { setModalType('addUser'); setUserForm({ name: '', email: '', role: 'employee', department: 'IT', password: '', specialKey: '', budgetAmount: '' }); setModalOpen(true); };

  const saveBudget = async () => {
    if (!budgetForm.managerId || !budgetForm.totalBudget || !budgetForm.remarks) return alert("Select Manager, specify amount, and provide a reason");
    if (adminBudget) {
       const remaining = adminBudget.totalBudget - adminBudget.usedBudget;
       if (parseFloat(budgetForm.totalBudget) > remaining) {
           return alert("Amount exceeds your available admin budget.");
       }
    }
    try {
      await API.post('/admin/assign-budget', { managerId: budgetForm.managerId, totalBudget: parseFloat(budgetForm.totalBudget), remarks: budgetForm.remarks });
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      alert("Failed to assign budget: " + (err.response?.data || err.message));
    }
  };

  const saveUser = async () => {
    try {
      const payload = { ...userForm, role: userForm.role.toUpperCase(), budgetAmount: parseFloat(userForm.budgetAmount) || 0 };
      await API.post('/admin/create-user', payload);
      setModalOpen(false);
      fetchAll();
      alert("User created successfully and email sent!");
    } catch (err) {
      alert("Failed to add user: " + (err.response?.data || err.message));
    }
  };

  const handleAction = async (id, actionType) => {
    try {
      await API.post('/admin/action', { requestId: id, action: actionType });
      fetchAll();
    } catch (err) {
      alert("Error: " + (err.response?.data || err.message));
    }
  };

  const renderOverview = () => {
    const totalAllocated = budgets.reduce((s, b) => s + b.totalBudget, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.usedBudget, 0);
    const remaining = totalAllocated - totalSpent;
    const managers = users.filter(u => u.role === 'MANAGER');
    const usedPct = pct(totalSpent, totalAllocated);

    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Admin Overview</h1>
          <p className="page-subtitle">System-wide control pane</p>
        </div>
        {!adminBudget ? (
          <div className="section" style={{ background: 'var(--bg2)', borderColor: 'var(--amber)', textAlign: 'center' }}>
             <h3 style={{ color: 'var(--amber)', marginTop: 0 }}>Initialize your company budget pool to get started</h3>
             <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => { setModalType('initBudget'); setModalOpen(true); }}>Initialize Budget</button>
          </div>
        ) : (
          <div className="section" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
             <div className="section-header">
                <div>
                   <div className="section-title">Admin Budget Pool</div>
                   <div className="section-sub">Company-level allocation logic</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentTab('budgets')}>View Allocations</button>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="stat-card"><div className="stat-label">Total Pool</div><div className="stat-value">{fmt(adminBudget.totalBudget)}</div></div>
                <div className="stat-card"><div className="stat-label">Used (Allocated)</div><div className="stat-value" style={{ color: 'var(--amber)' }}>{fmt(adminBudget.usedBudget)}</div></div>
                <div className="stat-card"><div className="stat-label">Available Backup</div><div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(adminBudget.totalBudget - adminBudget.usedBudget)}</div></div>
             </div>
             <div className="progress-wrap"><div className={`progress-bar ${pctColor(pct(adminBudget.usedBudget, adminBudget.totalBudget))}`} style={{ width: `${pct(adminBudget.usedBudget, adminBudget.totalBudget)}%` }}></div></div>
          </div>
        )}
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Total Allocated</div><div className="stat-value stat-accent">{fmt(totalAllocated)}</div><div className="stat-sub">{budgets.length} managers funded</div></div>
          <div className="stat-card"><div className="stat-label">Total Spent</div><div className={`stat-value ${pctTextColor(usedPct)}`}>{fmt(totalSpent)}</div><div className="stat-sub">{usedPct}% utilized</div></div>
          <div className="stat-card"><div className="stat-label">Remaining In Play</div><div className="stat-value stat-green">{fmt(remaining)}</div><div className="stat-sub">Funds dispersed but not used</div></div>
          <div className="stat-card"><div className="stat-label">Action Required</div><div className="stat-value stat-red">{requests.length}</div><div className="stat-sub">Escalated Requests pending</div></div>
        </div>
        
        <div className="section">
          <div className="section-header"><div><div className="section-title">Manager Budget Health</div><div className="section-sub">Real-time depletion tracking</div></div></div>
          {budgets.map(b => {
             const manager = users.find(u => u.userId === b.managerId);
             const name = manager ? `${manager.name} (${b.managerId})` : b.managerId;
             const p = pct(b.usedBudget + (b.reservedBudget || 0), b.totalBudget);
             return (
               <div className="dept-row" key={b.id}>
                 <div className="dept-name">{name}</div>
                 <div className="dept-meta mono">{fmt(b.usedBudget)} / {fmt(b.totalBudget)}</div>
                 <div className="dept-bar-wrap">
                   <div className="progress-wrap"><div className={`progress-bar ${pctColor(p)}`} style={{ width: `${p}%` }}></div></div>
                 </div>
                 <div className={`dept-meta mono ${pctTextColor(p)}`}>{p}%</div>
               </div>
             );
          })}
        </div>
      </>
    );
  };

  const renderBudgets = () => (
    <>
      <div className="page-header">
        <h1 className="page-title">Manager Budgets</h1>
        <p className="page-subtitle">Assign budgets directly to authorized Managers</p>
      </div>
      <div className="section">
        <div className="section-header">
          <div className="section-title">Allocations</div>
          <button className="btn btn-primary btn-sm" onClick={openAssignBudget}>+ Assign Budget</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Manager ID</th><th>Total Budget</th><th>Spent Budget</th><th>Reserved</th><th>Remaining</th><th>Utilization</th></tr></thead>
            <tbody>
              {budgets.map(b => {
                const p = pct((b.usedBudget + (b.reservedBudget || 0)), b.totalBudget);
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{b.managerId}</td>
                    <td className="mono" style={{ color: 'var(--accent2)' }}>{fmt(b.totalBudget)}</td>
                    <td className="mono">{fmt(b.usedBudget)}</td>
                    <td className="mono" style={{ color: 'var(--amber)' }}>{fmt(b.reservedBudget || 0)}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{fmt(b.totalBudget - b.usedBudget - (b.reservedBudget || 0))}</td>
                    <td style={{ minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <div className="progress-wrap" style={{ flex: 1 }}><div className={`progress-bar ${pctColor(p)}`} style={{ width: `${p}%` }}></div></div>
                        <span className="mono" style={{ fontSize: '.7rem', color: p >= 90 ? 'var(--red)' : p >= 70 ? 'var(--amber)' : 'var(--green)' }}>{p}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderUsers = () => {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">User Roster</h1>
          <p className="page-subtitle">Overview of all system identities</p>
        </div>
        <div className="section">
          <div className="section-header">
            <div className="section-title">All Users ({users.length})</div>
            <button className="btn btn-primary btn-sm" onClick={openAddUser}>+ Quick Add User</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Department</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="mono" style={{ color: 'var(--text3)' }}>{u.userId}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{u.name}</td>
                    <td><span className={`badge badge-${u.role.toLowerCase()}`}>{u.role.toLowerCase()}</span></td>
                    <td>{u.department || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const renderEscalated = () => {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Escalated Requests</h1>
          <p className="page-subtitle">{requests.length} request(s) exceeded manager budget and bypassed to you</p>
        </div>
        <div id="pending-list">
          {!requests.length ? (
            <div className="section"><div className="empty"><div className="empty-icon">✅</div><div className="empty-text">No escalated requests outstanding.</div></div></div>
          ) : (
            requests.map(r => (
              <div className="section" key={r.id}>
                <div className="section-header">
                  <div>
                    <div className="section-title">
                       {r.purpose} 
                       {r.attachmentPath && <a href={`${API_BASE_URL}${r.attachmentPath}`} target="_blank" rel="noopener noreferrer" style={{fontSize:'.8rem', marginLeft:'10px', color:'var(--blue)'}}>📎 View Attachment</a>}
                    </div>
                    <div className="section-sub">Req: {r.id} • Emp: {r.employeeId} • Byps Mgr: {r.managerId} • {fmtDate(r.createdAt)}</div>
                  </div>
                  {getStatusBadge(r.status)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="stat-card"><div className="stat-label">Amount Required</div><div className="stat-value stat-red" style={{ fontSize: '1.25rem' }}>{fmt(r.amount)}</div></div>
                  <div className="stat-card"><div className="stat-label">Department</div><div className="stat-value" style={{ fontSize: '1rem' }}>{r.department}</div></div>
                  <div className="stat-card"><div className="stat-label">Note</div><div className="stat-value" style={{ fontSize: '.9rem', color:'var(--amber)' }}>Manager out of funds</div></div>
                </div>
                {r.description && (
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius2)', padding: '1rem', marginBottom: '1.25rem', color: 'var(--text2)', fontSize: '.875rem', lineHeight: '1.6' }}>
                    <strong style={{ color: 'var(--text3)', fontSize: '.7rem', fontFamily: 'DM Mono', display: 'block', marginBottom: '.4rem', textTransform: 'uppercase' }}>Description</strong>{r.description}
                  </div>
                )}
                <div className="action-row">
                  <button className="btn btn-success" onClick={() => handleAction(r.id, 'APPROVE')}>✓ Approve Override</button>
                  <button className="btn btn-danger" onClick={() => handleAction(r.id, 'REJECT')}>✕ Reject Request</button>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  const renderHistory = () => {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Master Log Timeline</h1>
          <p className="page-subtitle">Every system action recorded immutably</p>
        </div>
        <div className="section">
           <div className="table-wrap">
             <table>
               <thead><tr><th>Log ID</th><th>Request ID</th><th>Action Taken</th><th>Action By (ID)</th><th>Timestamp</th></tr></thead>
               <tbody>
                  {historyItems.map(h => (
                    <tr key={h.id}>
                      <td className="mono" style={{ color: 'var(--text3)' }}>{h.id}</td>
                      <td className="mono" style={{ color: 'var(--accent2)' }}>{h.requestId}</td>
                      <td>{getStatusBadge(h.action)}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{h.actionBy}</td>
                      <td className="mono" style={{ fontSize: '.75rem' }}>{new Date(h.timestamp).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
               </tbody>
             </table>
           </div>
        </div>
      </>
    );
  }

  return (
    <div id="dashboard" onClick={() => setShowNotifPanel(false)}>
      <Sidebar currentTab={currentTab} navItems={navItems} navigateTo={setCurrentTab} />
      <div className="main-content" id="main-content">
        <div style={{ position: 'absolute', top: '1rem', right: '2rem', zIndex: 100 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setShowNotifPanel(!showNotifPanel); }}>
              🔔
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  background: 'var(--red)', color: '#fff',
                  borderRadius: '50%', fontSize: '.6rem',
                  width: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
            {showNotifPanel && (
              <div onClick={(e) => e.stopPropagation()} style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 999,
                width: '320px', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '1rem'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '.75rem' }}>Notifications</div>
                {notifications.length === 0 && <div style={{ color: 'var(--text2)', fontSize: '.85rem' }}>No notifications</div>}
                {notifications.map(n => (
                  <div key={n.id} style={{
                    padding: '.6rem .75rem', marginBottom: '.5rem',
                    background: n.isRead ? 'transparent' : 'var(--bg3)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    fontSize: '.8rem', color: n.isRead ? 'var(--text2)' : 'var(--text)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem'
                  }}>
                    <span>{n.message}</span>
                    {!n.isRead && (
                      <button className="btn btn-ghost" style={{ fontSize: '.7rem', padding: '.2rem .5rem', whiteSpace: 'nowrap' }}
                        onClick={async () => {
                          await API.post(`/admin/mark-read/${n.id}`);
                          fetchAll();
                        }}>
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {currentTab === 'overview' && renderOverview()}
        {currentTab === 'budgets' && renderBudgets()}
        {currentTab === 'users' && renderUsers()}
        {currentTab === 'escalated' && renderEscalated()}
        {currentTab === 'history' && renderHistory()}
      </div>

      {modalOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            <div id="modal-content">
              
              {modalType === 'assignBudget' && (
                <>
                  <div className="modal-title">Assign Budget</div>
                  
                  {adminBudget && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg2)', borderRadius: 'var(--radius2)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '.25rem', fontWeight: 500, textTransform: 'uppercase' }}>Admin Budget Pool</div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
                        <span className="mono" style={{ color: 'var(--text)' }}>Total: {fmt(adminBudget.totalBudget)}</span>
                        <span className="mono" style={{ color: 'var(--text)' }}>Used: {fmt(adminBudget.usedBudget)}</span>
                        {(() => {
                           const remaining = adminBudget.totalBudget - adminBudget.usedBudget;
                           const isLow = remaining < (adminBudget.totalBudget * 0.1);
                           return <span className="mono" style={{ color: isLow ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>Available: {fmt(remaining)}</span>;
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="form-group"><label className="form-label">Manager ID</label>
                     <select className="form-input" value={budgetForm.managerId} onChange={e => setBudgetForm({...budgetForm, managerId: e.target.value})}>
                        <option value="">-- Select Manager --</option>
                        {users.filter(u => u.role === 'MANAGER').map(u => (
                           <option key={u.userId} value={u.userId}>{u.name} ({u.userId}) - {u.department}</option>
                        ))}
                     </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount to Allocate (Top-up)</label>
                    <input className="form-input" type="number" placeholder="500000" value={budgetForm.totalBudget} onChange={e => setBudgetForm({...budgetForm, totalBudget: e.target.value})} />
                    <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.25rem' }}>This amount will be ADDED to manager's existing budget.</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason for allocation</label>
                    <input className="form-input" type="text" placeholder="Remarks" value={budgetForm.remarks} onChange={e => setBudgetForm({...budgetForm, remarks: e.target.value})} required />
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveBudget}>Save Assignment</button>
                  </div>
                </>
              )}

              {modalType === 'addUser' && (
                <>
                  <div className="modal-title">Quick Add User</div>
                  <p className="page-subtitle" style={{marginBottom:'1rem'}}>Admin UI automatically bypasses typical signup checks & ID sequences are omitted here manually if needed.</p>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="Full name" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="Email Address" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Role</label>
                      <select className="form-input" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                        <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                      </select>
                    </div>
                    {userForm.role !== 'admin' && (
                      <div className="form-group"><label className="form-label">Department</label>
                        <select className="form-input" value={userForm.department} onChange={e => setUserForm({...userForm, department: e.target.value})}>
                           <option>IT</option><option>HR</option><option>FINANCE</option><option>OPERATIONS</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="Set a password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} /></div>
                  {userForm.role === 'manager' && (
                    <div className="form-group"><label className="form-label">Initial Budget Amount (Optional)</label><input className="form-input" type="number" placeholder="e.g. 500000" value={userForm.budgetAmount} onChange={e => setUserForm({...userForm, budgetAmount: e.target.value})} /></div>
                  )}
                  {['admin', 'manager'].includes(userForm.role) && (
                    <div className="form-group"><label className="form-label">Special Key (Optional)</label><input className="form-input" type="text" placeholder="Auth Key" value={userForm.specialKey} onChange={e => setUserForm({...userForm, specialKey: e.target.value})} /></div>
                  )}
                  <div className="form-actions">
                    <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={saveUser}>Add User</button>
                  </div>
                </>
              )}

              {modalType === 'initBudget' && (
                <>
                  <div className="modal-title">Initialize Corporate Budget</div>
                  <div className="form-group">
                     <label className="form-label">Total Company Pool (₹)</label>
                     <input className="form-input" type="number" placeholder="50000000" id="initBudgetInput" />
                  </div>
                  <div className="form-actions">
                     <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                     <button className="btn btn-primary" onClick={async () => {
                         const val = document.getElementById('initBudgetInput').value;
                         if(!val) return;
                         try {
                             await API.post('/admin/set-total-budget', { totalBudget: parseFloat(val) });
                             setModalOpen(false);
                             fetchAll();
                         } catch(e) { alert("Failed to init budget: " + (e.response?.data || e.message)); }
                     }}>Set Budget</button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
