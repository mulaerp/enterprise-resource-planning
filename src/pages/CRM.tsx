import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Phone, Mail, Calendar, DollarSign, TrendingUp, Users, Target, Star } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  value: number;
  assignedTo: string;
  createdDate: string;
  lastContact: string;
  notes: string;
}

interface Opportunity {
  id: string;
  name: string;
  customer: string;
  value: number;
  probability: number;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  expectedCloseDate: string;
  assignedTo: string;
  source: string;
  description: string;
}

interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task' | 'note';
  subject: string;
  description: string;
  relatedTo: string;
  relatedType: 'lead' | 'opportunity' | 'customer';
  assignedTo: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
}

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'social' | 'webinar' | 'event' | 'advertising';
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  leads: number;
  conversions: number;
  roi: number;
}

export default function CRM() {
  const [activeTab, setActiveTab] = useState<'leads' | 'opportunities' | 'activities' | 'campaigns'>('leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [leads, setLeads] = useState<Lead[]>([
    {
      id: 'L001',
      name: 'Alice Cooper',
      email: 'alice@techcorp.com',
      phone: '+1-555-0123',
      company: 'TechCorp Inc',
      source: 'Website',
      status: 'qualified',
      value: 15000,
      assignedTo: 'John Smith',
      createdDate: '2024-01-10',
      lastContact: '2024-01-15',
      notes: 'Interested in enterprise solution'
    },
    {
      id: 'L002',
      name: 'Bob Wilson',
      email: 'bob@startup.io',
      phone: '+1-555-0124',
      company: 'Startup.io',
      source: 'Referral',
      status: 'proposal',
      value: 8500,
      assignedTo: 'Sarah Johnson',
      createdDate: '2024-01-12',
      lastContact: '2024-01-16',
      notes: 'Budget approved, waiting for proposal review'
    }
  ]);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([
    {
      id: 'O001',
      name: 'Enterprise Software License',
      customer: 'TechCorp Inc',
      value: 50000,
      probability: 75,
      stage: 'negotiation',
      expectedCloseDate: '2024-02-15',
      assignedTo: 'John Smith',
      source: 'Website',
      description: 'Multi-year enterprise license deal'
    },
    {
      id: 'O002',
      name: 'Consulting Services',
      customer: 'Global Industries',
      value: 25000,
      probability: 60,
      stage: 'proposal',
      expectedCloseDate: '2024-02-28',
      assignedTo: 'Sarah Johnson',
      source: 'Cold Call',
      description: 'Implementation and training services'
    }
  ]);

  const [activities, setActivities] = useState<Activity[]>([
    {
      id: 'A001',
      type: 'call',
      subject: 'Follow-up call with Alice Cooper',
      description: 'Discuss proposal details and timeline',
      relatedTo: 'L001',
      relatedType: 'lead',
      assignedTo: 'John Smith',
      dueDate: '2024-01-20',
      status: 'pending',
      priority: 'high'
    },
    {
      id: 'A002',
      type: 'email',
      subject: 'Send proposal to Bob Wilson',
      description: 'Send detailed proposal with pricing',
      relatedTo: 'L002',
      relatedType: 'lead',
      assignedTo: 'Sarah Johnson',
      dueDate: '2024-01-18',
      status: 'completed',
      priority: 'medium'
    }
  ]);

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: 'C001',
      name: 'Q1 Product Launch',
      type: 'email',
      status: 'active',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
      budget: 10000,
      spent: 3500,
      leads: 125,
      conversions: 15,
      roi: 285
    },
    {
      id: 'C002',
      name: 'Industry Conference',
      type: 'event',
      status: 'completed',
      startDate: '2024-01-15',
      endDate: '2024-01-17',
      budget: 15000,
      spent: 14500,
      leads: 85,
      conversions: 12,
      roi: 180
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'contacted':
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'qualified':
      case 'prospecting': return 'bg-yellow-100 text-yellow-800';
      case 'proposal':
      case 'qualification': return 'bg-purple-100 text-purple-800';
      case 'negotiation': return 'bg-orange-100 text-orange-800';
      case 'won':
      case 'closed-won':
      case 'completed': return 'bg-green-100 text-green-800';
      case 'lost':
      case 'closed-lost': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone size={16} className="text-blue-600" />;
      case 'email': return <Mail size={16} className="text-green-600" />;
      case 'meeting': return <Calendar size={16} className="text-purple-600" />;
      case 'task': return <Target size={16} className="text-orange-600" />;
      case 'note': return <Edit size={16} className="text-gray-600" />;
      default: return <Target size={16} className="text-gray-600" />;
    }
  };

  // Calculate CRM metrics
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified' || l.status === 'proposal' || l.status === 'negotiation').length;
  const totalOpportunityValue = opportunities.reduce((sum, o) => sum + o.value, 0);
  const avgDealSize = totalOpportunityValue / opportunities.length || 0;
  const conversionRate = (qualifiedLeads / totalLeads * 100) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Customer Relationship Management</h1>
        <div className="flex space-x-3">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
            <Plus size={20} />
            <span>New Lead</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
            <Plus size={20} />
            <span>New Opportunity</span>
          </button>
        </div>
      </div>

      {/* CRM Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Users className="text-blue-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
              <p className="text-xs text-blue-600">{qualifiedLeads} qualified</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Target className="text-green-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{opportunities.length}</p>
              <p className="text-xs text-green-600">${totalOpportunityValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <DollarSign className="text-purple-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Avg Deal Size</p>
              <p className="text-2xl font-bold text-gray-900">${avgDealSize.toFixed(0)}</p>
              <p className="text-xs text-purple-600">Per opportunity</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <TrendingUp className="text-orange-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-orange-600">Lead to qualified</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Star className="text-yellow-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Win Rate</p>
              <p className="text-2xl font-bold text-gray-900">68%</p>
              <p className="text-xs text-yellow-600">This quarter</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'leads', name: 'Leads', count: leads.length, icon: Users },
            { id: 'opportunities', name: 'Opportunities', count: opportunities.length, icon: Target },
            { id: 'activities', name: 'Activities', count: activities.length, icon: Calendar },
            { id: 'campaigns', name: 'Campaigns', count: campaigns.length, icon: TrendingUp }
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

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search leads..."
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
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                        <div className="text-sm text-gray-500">{lead.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.company}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.source}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${lead.value.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.assignedTo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.lastContact}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800" title="Call">
                          <Phone size={16} />
                        </button>
                        <button className="text-green-600 hover:text-green-800" title="Email">
                          <Mail size={16} />
                        </button>
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

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Sales Opportunities</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Probability</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Close</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opportunities.map((opportunity) => (
                  <tr key={opportunity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{opportunity.name}</div>
                      <div className="text-sm text-gray-500">{opportunity.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{opportunity.customer}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${opportunity.value.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${opportunity.probability}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{opportunity.probability}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(opportunity.stage)}`}>
                        {opportunity.stage.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{opportunity.expectedCloseDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{opportunity.assignedTo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">
                          <Eye size={16} />
                        </button>
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

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Activities & Tasks</h2>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>New Activity</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Related To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getActivityIcon(activity.type)}
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{activity.subject}</div>
                          <div className="text-sm text-gray-500">{activity.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{activity.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{activity.relatedTo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{activity.assignedTo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{activity.dueDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(activity.priority)}`}>
                        {activity.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </td>
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

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Marketing Campaigns</h2>
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>New Campaign</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                      <div className="text-sm text-gray-500">{campaign.startDate} - {campaign.endDate}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{campaign.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${campaign.budget.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${campaign.spent.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.leads}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.conversions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{campaign.roi}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">
                          <Eye size={16} />
                        </button>
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
    </div>
  );
}