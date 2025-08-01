import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './AdminPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const headerData = {
  logo: { text: 'TalentJn', icon: 'house' },
  backgroundColor: '#2c3e99',
};

const AdminPage = () => {
  const { jwt, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('emails');
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const navigationData = {
    items: [
      { name: 'Dashboard', active: false, link: '/' },
      { name: 'Admin Panel', active: true, link: '/admin' },
    ],
    backgroundColor: '#2c3e99',
  };

  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const fetchAllowedEmails = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/allowed-emails`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllowedEmails(data.emails);
      } else {
        const errorData = await response.json();
        showMessage(errorData.error || 'Failed to fetch allowed emails', 'error');
      }
    } catch (error) {
      showMessage('Error fetching allowed emails', 'error');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        const errorData = await response.json();
        showMessage(errorData.error || 'Failed to fetch users', 'error');
      }
    } catch (error) {
      showMessage('Error fetching users', 'error');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const errorData = await response.json();
        showMessage(errorData.error || 'Failed to fetch stats', 'error');
      }
    } catch (error) {
      showMessage('Error fetching stats', 'error');
    }
  };

  const addEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/allowed-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewEmail('');
        showMessage(data.message, 'success');
        fetchAllowedEmails();
        if (activeTab === 'dashboard') fetchStats();
      } else {
        showMessage(data.error || 'Failed to add email', 'error');
      }
    } catch (error) {
      showMessage('Error adding email', 'error');
    }
  };

  const removeEmail = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/allowed-emails`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message, 'success');
        fetchAllowedEmails();
        if (activeTab === 'dashboard') fetchStats();
      } else {
        showMessage(data.error || 'Failed to remove email', 'error');
      }
    } catch (error) {
      showMessage('Error removing email', 'error');
    }
  };

  const toggleAdminStatus = async (userId, currentStatus) => {
    const action = currentStatus ? 'remove admin privileges from' : 'grant admin privileges to';
    const userEmail = users.find(u => u.id === userId)?.email;
    
    if (!window.confirm(`Are you sure you want to ${action} ${userEmail}?`)) return;

    try {
      const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/admin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message, 'success');
        fetchUsers();
        if (activeTab === 'dashboard') fetchStats();
      } else {
        showMessage(data.error || 'Failed to update admin status', 'error');
      }
    } catch (error) {
      showMessage('Error updating admin status', 'error');
    }
  };

  useEffect(() => {
    if (!jwt) {
      navigate('/login');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      
      if (activeTab === 'emails') {
        await fetchAllowedEmails();
      } else if (activeTab === 'users') {
        await fetchUsers();
      } else if (activeTab === 'dashboard') {
        await Promise.all([fetchStats(), fetchAllowedEmails(), fetchUsers()]);
      }
      
      setLoading(false);
    };

    loadData();
  }, [jwt, navigate, activeTab]);

  if (loading) {
    return (
      <div className="admin-page">
        <Header {...headerData} user={user} />
        <Navigation {...navigationData} />
        <div className="admin-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Header {...headerData} user={user} />
      <Navigation {...navigationData} />
      
      <div className="admin-content">
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <p>Manage user access and system settings</p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <div className="admin-tabs">
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'emails' ? 'active' : ''}`}
            onClick={() => setActiveTab('emails')}
          >
            Allowed Emails
          </button>
          <button 
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            All Users
          </button>
        </div>

        <div className="admin-tab-content">
          {activeTab === 'dashboard' && (
            <div className="dashboard-tab">
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Logged-In Users</h3>
                  <div className="stat-number">{stats.total_users || 0}</div>
                </div>
                <div className="stat-card">
                  <h3>Admin Users</h3>
                  <div className="stat-number">{stats.admin_users || 0}</div>
                </div>
                <div className="stat-card">
                  <h3>Allowed Emails</h3>
                  <div className="stat-number">{stats.allowed_emails || 0}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="emails-tab">
              <div className="add-email-form">
                <h3>Add New Allowed Email</h3>
                <form onSubmit={addEmail}>
                  <div className="form-group">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                    <button type="submit" className="btn btn-primary">
                      Add Email
                    </button>
                  </div>
                </form>
              </div>

              <div className="emails-list">
                <h3>Allowed Emails ({allowedEmails.length})</h3>
                {allowedEmails.length === 0 ? (
                  <div className="empty-state">
                    <p>No allowed emails configured. Add emails above to grant access.</p>
                  </div>
                ) : (
                  <div className="emails-table">
                    <div className="table-header">
                      <div>Email</div>
                      <div>Added By</div>
                      <div>Added Date</div>
                      <div>Actions</div>
                    </div>
                    {allowedEmails.map((emailObj) => (
                      <div key={emailObj.id} className="table-row">
                        <div>{emailObj.email}</div>
                        <div>{emailObj.added_by}</div>
                        <div>{new Date(emailObj.added_at).toLocaleDateString()}</div>
                        <div>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removeEmail(emailObj.email)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="users-tab">
              <h3>All Users ({users.length})</h3>
              {users.length === 0 ? (
                <div className="empty-state">
                  <p>No users found.</p>
                </div>
              ) : (
                <div className="users-table">
                  <div className="table-header">
                    <div>Email</div>
                    <div>Admin</div>
                    <div>Joined</div>
                    <div>Actions</div>
                  </div>
                  {users.map((userObj) => (
                    <div key={userObj.id} className="table-row">
                      <div>{userObj.email}</div>
                      <div>
                        <span className={`badge ${userObj.is_admin ? 'admin' : 'user'}`}>
                          {userObj.is_admin ? 'Admin' : 'User'}
                        </span>
                      </div>
                      <div>{userObj.created_at ? new Date(userObj.created_at).toLocaleDateString() : 'N/A'}</div>
                      <div>
                        {userObj.email !== user?.email && (
                          <button
                            className={`btn btn-sm ${userObj.is_admin ? 'btn-warning' : 'btn-success'}`}
                            onClick={() => toggleAdminStatus(userObj.id, userObj.is_admin)}
                          >
                            {userObj.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;