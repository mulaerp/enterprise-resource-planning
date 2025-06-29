import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Download, Users, Calendar, DollarSign, Clock, Award, AlertTriangle } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  hireDate: string;
  salary: number;
  status: 'active' | 'inactive' | 'terminated';
  manager: string;
  address: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: 'present' | 'absent' | 'late' | 'half-day';
  notes?: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'vacation' | 'sick' | 'personal' | 'maternity' | 'emergency';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  appliedDate: string;
}

interface Payroll {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  basicSalary: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  netPay: number;
  status: 'draft' | 'processed' | 'paid';
}

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leaves' | 'payroll'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: 'EMP001',
      name: 'John Smith',
      email: 'john.smith@company.com',
      phone: '+1-555-0123',
      position: 'Software Engineer',
      department: 'Engineering',
      hireDate: '2023-01-15',
      salary: 75000,
      status: 'active',
      manager: 'Jane Doe',
      address: '123 Main St, City, State',
      emergencyContact: {
        name: 'Mary Smith',
        phone: '+1-555-0124',
        relationship: 'Spouse'
      }
    },
    {
      id: 'EMP002',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      phone: '+1-555-0125',
      position: 'Marketing Manager',
      department: 'Marketing',
      hireDate: '2022-08-20',
      salary: 65000,
      status: 'active',
      manager: 'Mike Wilson',
      address: '456 Oak Ave, City, State',
      emergencyContact: {
        name: 'Robert Johnson',
        phone: '+1-555-0126',
        relationship: 'Father'
      }
    }
  ]);

  const [attendance, setAttendance] = useState<Attendance[]>([
    {
      id: 'ATT001',
      employeeId: 'EMP001',
      employeeName: 'John Smith',
      date: '2024-01-15',
      checkIn: '09:00',
      checkOut: '17:30',
      hoursWorked: 8.5,
      status: 'present'
    },
    {
      id: 'ATT002',
      employeeId: 'EMP002',
      employeeName: 'Sarah Johnson',
      date: '2024-01-15',
      checkIn: '09:15',
      checkOut: '17:45',
      hoursWorked: 8.5,
      status: 'late',
      notes: '15 minutes late due to traffic'
    }
  ]);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: 'LR001',
      employeeId: 'EMP001',
      employeeName: 'John Smith',
      type: 'vacation',
      startDate: '2024-02-01',
      endDate: '2024-02-05',
      days: 5,
      reason: 'Family vacation',
      status: 'pending',
      appliedDate: '2024-01-15'
    },
    {
      id: 'LR002',
      employeeId: 'EMP002',
      employeeName: 'Sarah Johnson',
      type: 'sick',
      startDate: '2024-01-10',
      endDate: '2024-01-12',
      days: 3,
      reason: 'Flu symptoms',
      status: 'approved',
      approvedBy: 'Mike Wilson',
      appliedDate: '2024-01-09'
    }
  ]);

  const [payroll, setPayroll] = useState<Payroll[]>([
    {
      id: 'PAY001',
      employeeId: 'EMP001',
      employeeName: 'John Smith',
      period: 'January 2024',
      basicSalary: 6250,
      overtime: 500,
      bonuses: 1000,
      deductions: 750,
      netPay: 7000,
      status: 'processed'
    },
    {
      id: 'PAY002',
      employeeId: 'EMP002',
      employeeName: 'Sarah Johnson',
      period: 'January 2024',
      basicSalary: 5417,
      overtime: 200,
      bonuses: 500,
      deductions: 650,
      netPay: 5467,
      status: 'paid'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'present':
      case 'approved':
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending':
      case 'processed': return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
      case 'absent':
      case 'rejected':
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'terminated':
      case 'late': return 'bg-red-100 text-red-800';
      case 'half-day': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'vacation': return 'bg-blue-100 text-blue-800';
      case 'sick': return 'bg-red-100 text-red-800';
      case 'personal': return 'bg-purple-100 text-purple-800';
      case 'maternity': return 'bg-pink-100 text-pink-800';
      case 'emergency': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate HR metrics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(emp => emp.status === 'active').length;
  const pendingLeaves = leaveRequests.filter(lr => lr.status === 'pending').length;
  const totalPayroll = payroll.reduce((sum, p) => sum + p.netPay, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Human Resources</h1>
        <div className="flex space-x-3">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
            <Download size={20} />
            <span>Export</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
            <Plus size={20} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* HR Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Users className="text-blue-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
              <p className="text-xs text-green-600">{activeEmployees} active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Calendar className="text-yellow-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Pending Leaves</p>
              <p className="text-2xl font-bold text-gray-900">{pendingLeaves}</p>
              <p className="text-xs text-yellow-600">Awaiting approval</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <DollarSign className="text-green-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Monthly Payroll</p>
              <p className="text-2xl font-bold text-gray-900">${totalPayroll.toLocaleString()}</p>
              <p className="text-xs text-green-600">Current period</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Clock className="text-purple-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Avg. Hours/Week</p>
              <p className="text-2xl font-bold text-gray-900">42.5</p>
              <p className="text-xs text-purple-600">This week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'employees', name: 'Employees', count: employees.length, icon: Users },
            { id: 'attendance', name: 'Attendance', count: attendance.length, icon: Clock },
            { id: 'leaves', name: 'Leave Requests', count: leaveRequests.length, icon: Calendar },
            { id: 'payroll', name: 'Payroll', count: payroll.length, icon: DollarSign }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.name}</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hire Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.position}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.hireDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${employee.salary.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status)}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800" title="View">
                          <Eye size={16} />
                        </button>
                        <button className="text-blue-600 hover:text-blue-800" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button className="text-red-600 hover:text-red-800" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Attendance Management</h2>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>Mark Attendance</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours Worked</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendance.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.employeeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.checkIn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.checkOut}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.hoursWorked}h</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.notes || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">
                          <Edit size={16} />
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Requests Tab */}
      {activeTab === 'leaves' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Leave Requests</h2>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>New Leave Request</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaveRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.employeeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLeaveTypeColor(request.type)}`}>
                        {request.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.startDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.endDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.days}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{request.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        {request.status === 'pending' && (
                          <>
                            <button className="text-green-600 hover:text-green-800" title="Approve">
                              <Award size={16} />
                            </button>
                            <button className="text-red-600 hover:text-red-800" title="Reject">
                              <AlertTriangle size={16} />
                            </button>
                          </>
                        )}
                        <button className="text-blue-600 hover:text-blue-800" title="View">
                          <Eye size={16} />
                        </button>
                        <button className="text-blue-600 hover:text-blue-800" title="Edit">
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === 'payroll' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Payroll Management</h2>
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>Process Payroll</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bonuses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payroll.map((pay) => (
                  <tr key={pay.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pay.employeeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pay.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${pay.basicSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${pay.overtime.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${pay.bonuses.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${pay.deductions.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">${pay.netPay.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(pay.status)}`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800" title="View Payslip">
                          <Eye size={16} />
                        </button>
                        <button className="text-green-600 hover:text-green-800" title="Download">
                          <Download size={16} />
                        </button>
                        <button className="text-blue-600 hover:text-blue-800" title="Edit">
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}