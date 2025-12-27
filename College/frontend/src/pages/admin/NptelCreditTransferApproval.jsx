import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/authService';
import { Search, CheckCircle, XCircle, Clock, User, BookOpen, AlertCircle ,RefreshCw} from 'lucide-react';

const NptelCreditTransferApproval = () => {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/nptel-credit-transfers');
      setRequests(res.data.data || []);
      setFiltered(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filteredList = requests;

    if (search) {
      filteredList = filteredList.filter(r =>
        r.regno.toLowerCase().includes(search.toLowerCase()) ||
        r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.courseCode.toLowerCase().includes(search.toLowerCase()) ||
        r.courseTitle.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filteredList = filteredList.filter(r => r.status === filterStatus);
    }

    setFiltered(filteredList);
  }, [search, filterStatus, requests]);

  const handleAction = async (transferId, action, remarks = '') => {
    if (processing) return;

    setProcessing(transferId);
    try {
      await api.post('/admin/nptel-credit-transfer-action', {
        transferId,
        action, // 'approved' or 'rejected'
        remarks
      });

      toast.success(`Request ${action === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchRequests(); // refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5" />;
      case 'rejected': return <XCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-2xl">Loading requests...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black mb-3">NPTEL Credit Transfer Approval</h1>
        <p className="text-xl text-gray-600">Review and approve/reject student requests for NPTEL credit transfer</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Total Requests</p>
              <p className="text-3xl font-bold text-gray-800">{requests.length}</p>
            </div>
            <BookOpen className="w-10 h-10 text-indigo-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">
                {requests.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Approved</p>
              <p className="text-3xl font-bold text-green-600">
                {requests.filter(r => r.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Rejected</p>
              <p className="text-3xl font-bold text-red-600">
                {requests.filter(r => r.status === 'rejected').length}
              </p>
            </div>
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Reg No, Name, Course Code or Title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-6 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={fetchRequests}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xl">
            {search || filterStatus !== 'all' ? 'No requests match your filters' : 'No credit transfer requests yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map(request => (
              <div key={request.transferId} className="p-6 hover:bg-gray-50 transition">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <User className="w-10 h-10 text-indigo-600 mt-1" />
                      <div>
                        <p className="text-xl font-bold text-gray-800">
                          {request.studentName} ({request.regno})
                        </p>
                        <p className="text-gray-600 mt-1">
                          <span className="font-medium">Course:</span> {request.courseTitle}
                          <span className="ml-4 font-mono bg-gray-100 px-2 py-1 rounded">{request.courseCode}</span>
                        </p>
                        <p className="text-gray-600 mt-2">
                          <span className="font-medium">Type:</span>{' '}
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            request.type === 'OEC' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {request.type}
                          </span>
                          <span className="ml-4 font-medium">Credits:</span> {request.credits}
                          <span className="ml-4 font-medium">Grade:</span>{' '}
                          <span className="text-m font-bold text-green-600">{request.grade}</span>
                        </p>
                        <p className="text-sm text-gray-500 mt-3">
                          Requested on: {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-4">
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-full border-2 font-bold text-lg ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status.toUpperCase()}
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleAction(request.transferId, 'approved')}
                          disabled={processing === request.transferId}
                          className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow transition flex items-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const remarks = prompt('Reason for rejection (optional):');
                            handleAction(request.transferId, 'rejected', remarks || '');
                          }}
                          disabled={processing === request.transferId}
                          className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow transition flex items-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </button>
                      </div>
                    )}

                    {request.status !== 'pending' && request.remarks && (
                      <p className="text-sm text-gray-600 italic mt-2 max-w-xs text-right">
                        Remarks: {request.remarks}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NptelCreditTransferApproval;