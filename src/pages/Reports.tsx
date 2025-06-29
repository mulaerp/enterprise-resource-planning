import React, { useState, useMemo } from 'react';
import { BarChart, PieChart, TrendingUp, Download, Calendar, Filter, FileText, DollarSign, Users, Package } from 'lucide-react';

interface ReportData {
  period: string;
  sales?: number;
  revenue?: number;
  category?: string;
  items?: number;
  value?: number;
  segment?: string;
  count?: number;
  metric?: string;
  change?: number;
}

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReport, setSelectedReport] = useState('sales');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const reportTypes = [
    { id: 'sales', name: 'Sales Report', icon: TrendingUp, color: 'bg-blue-500' },
    { id: 'inventory', name: 'Inventory Report', icon: Package, color: 'bg-green-500' },
    { id: 'customers', name: 'Customer Report', icon: Users, color: 'bg-purple-500' },
    { id: 'financial', name: 'Financial Report', icon: DollarSign, color: 'bg-yellow-500' }
  ];

  // Calculate date ranges based on selected period
  const getDateRange = (period: string): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return {
          start: startOfWeek,
          end: endOfWeek,
          label: `Week of ${startOfWeek.toLocaleDateString()}`
        };
      }
      case 'month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          start: startOfMonth,
          end: endOfMonth,
          label: startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      }
      case 'quarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        const endOfQuarter = new Date(today.getFullYear(), quarter * 3 + 3, 0);
        return {
          start: startOfQuarter,
          end: endOfQuarter,
          label: `Q${quarter + 1} ${today.getFullYear()}`
        };
      }
      case 'year': {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        return {
          start: startOfYear,
          end: endOfYear,
          label: today.getFullYear().toString()
        };
      }
      case 'custom': {
        const start = customStartDate ? new Date(customStartDate) : new Date(today.getFullYear(), today.getMonth(), 1);
        const end = customEndDate ? new Date(customEndDate) : today;
        return {
          start,
          end,
          label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
        };
      }
      default:
        return {
          start: new Date(today.getFullYear(), today.getMonth(), 1),
          end: today,
          label: 'Current Month'
        };
    }
  };

  const currentDateRange = getDateRange(selectedPeriod);

  // Generate mock data based on date range and report type
  const generateReportData = useMemo(() => {
    const { start, end } = currentDateRange;
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Base multiplier for data generation
    const baseMultiplier = Math.max(1, daysDiff / 30);
    
    const reportData = {
      sales: {
        title: 'Sales Report',
        data: (() => {
          if (selectedPeriod === 'week') {
            // Daily data for week view
            const data = [];
            for (let i = 0; i < 7; i++) {
              const date = new Date(start);
              date.setDate(start.getDate() + i);
              data.push({
                period: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                sales: Math.floor(Math.random() * 20 + 5),
                revenue: Math.floor((Math.random() * 15000 + 5000) * baseMultiplier)
              });
            }
            return data;
          } else if (selectedPeriod === 'month') {
            // Weekly data for month view
            const data = [];
            const weeksInMonth = Math.ceil(daysDiff / 7);
            for (let i = 0; i < weeksInMonth; i++) {
              const weekStart = new Date(start);
              weekStart.setDate(start.getDate() + (i * 7));
              data.push({
                period: `Week ${i + 1}`,
                sales: Math.floor(Math.random() * 80 + 20),
                revenue: Math.floor((Math.random() * 50000 + 20000) * baseMultiplier)
              });
            }
            return data;
          } else if (selectedPeriod === 'quarter') {
            // Monthly data for quarter view
            const data = [];
            for (let i = 0; i < 3; i++) {
              const month = new Date(start);
              month.setMonth(start.getMonth() + i);
              data.push({
                period: month.toLocaleDateString('en-US', { month: 'long' }),
                sales: Math.floor(Math.random() * 200 + 100),
                revenue: Math.floor((Math.random() * 150000 + 80000) * baseMultiplier)
              });
            }
            return data;
          } else {
            // Monthly data for year or custom view
            const monthsToShow = selectedPeriod === 'year' ? 12 : Math.min(12, Math.ceil(daysDiff / 30));
            const data = [];
            for (let i = 0; i < monthsToShow; i++) {
              const month = new Date(start);
              month.setMonth(start.getMonth() + i);
              data.push({
                period: month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                sales: Math.floor(Math.random() * 300 + 150),
                revenue: Math.floor((Math.random() * 200000 + 100000) * baseMultiplier)
              });
            }
            return data;
          }
        })()
      },
      inventory: {
        title: 'Inventory Report',
        data: [
          { category: 'Electronics', items: Math.floor(125 * baseMultiplier), value: Math.floor(89000 * baseMultiplier) },
          { category: 'Furniture', items: Math.floor(67 * baseMultiplier), value: Math.floor(45000 * baseMultiplier) },
          { category: 'Office Supplies', items: Math.floor(234 * baseMultiplier), value: Math.floor(12000 * baseMultiplier) },
          { category: 'Software', items: Math.floor(45 * baseMultiplier), value: Math.floor(23000 * baseMultiplier) },
          { category: 'Hardware', items: Math.floor(89 * baseMultiplier), value: Math.floor(34000 * baseMultiplier) }
        ]
      },
      customers: {
        title: 'Customer Report',
        data: [
          { segment: 'New Customers', count: Math.floor(45 * baseMultiplier), revenue: Math.floor(67000 * baseMultiplier) },
          { segment: 'Returning Customers', count: Math.floor(123 * baseMultiplier), revenue: Math.floor(234000 * baseMultiplier) },
          { segment: 'VIP Customers', count: Math.floor(23 * baseMultiplier), revenue: Math.floor(145000 * baseMultiplier) },
          { segment: 'Inactive Customers', count: Math.floor(67 * baseMultiplier), revenue: 0 }
        ]
      },
      financial: {
        title: 'Financial Report',
        data: [
          { metric: 'Total Revenue', value: Math.floor(567000 * baseMultiplier), change: +(Math.random() * 20 - 5).toFixed(1) },
          { metric: 'Total Expenses', value: Math.floor(234000 * baseMultiplier), change: +(Math.random() * 10 - 8).toFixed(1) },
          { metric: 'Net Profit', value: Math.floor(333000 * baseMultiplier), change: +(Math.random() * 25 - 2).toFixed(1) },
          { metric: 'Gross Margin', value: +(58.7 + Math.random() * 10 - 5).toFixed(1), change: +(Math.random() * 8 - 2).toFixed(1) },
          { metric: 'Operating Margin', value: +(32.4 + Math.random() * 8 - 4).toFixed(1), change: +(Math.random() * 6 - 1).toFixed(1) }
        ]
      }
    };

    return reportData[selectedReport as keyof typeof reportData];
  }, [selectedReport, selectedPeriod, customStartDate, customEndDate, currentDateRange]);

  const exportReport = (format: string) => {
    const report = generateReportData;
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'csv') {
      let csvContent = `${report.title} - ${currentDateRange.label}\n\n`;
      
      if (selectedReport === 'sales') {
        csvContent += 'Period,Sales Count,Revenue\n';
        report.data.forEach((row: any) => {
          csvContent += `${row.period},${row.sales},${row.revenue}\n`;
        });
      } else if (selectedReport === 'inventory') {
        csvContent += 'Category,Items,Value\n';
        report.data.forEach((row: any) => {
          csvContent += `${row.category},${row.items},${row.value}\n`;
        });
      } else if (selectedReport === 'customers') {
        csvContent += 'Segment,Count,Revenue\n';
        report.data.forEach((row: any) => {
          csvContent += `${row.segment},${row.count},${row.revenue}\n`;
        });
      } else if (selectedReport === 'financial') {
        csvContent += 'Metric,Value,Change %\n';
        report.data.forEach((row: any) => {
          csvContent += `${row.metric},${row.value},${row.change}\n`;
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report-${selectedPeriod}-${timestamp}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      alert(`Generating PDF report for ${report.title} (${currentDateRange.label})...`);
    }
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const salesData = generateReportData.data;
    
    if (selectedReport === 'sales') {
      const totalSales = salesData.reduce((sum: number, item: any) => sum + (item.sales || 0), 0);
      const totalRevenue = salesData.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
      const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      return {
        totalSales,
        totalRevenue,
        avgSaleValue,
        periodCount: salesData.length
      };
    } else if (selectedReport === 'inventory') {
      const totalItems = salesData.reduce((sum: number, item: any) => sum + (item.items || 0), 0);
      const totalValue = salesData.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
      
      return {
        totalItems,
        totalValue,
        avgItemValue: totalItems > 0 ? totalValue / totalItems : 0,
        categoryCount: salesData.length
      };
    } else if (selectedReport === 'customers') {
      const totalCustomers = salesData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      const totalRevenue = salesData.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
      
      return {
        totalCustomers,
        totalRevenue,
        avgCustomerValue: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
        segmentCount: salesData.length
      };
    }
    
    return {};
  }, [generateReportData, selectedReport]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <div className="flex items-center space-x-4">
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          
          {selectedPeriod === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          
          <div className="flex space-x-2">
            <button 
              onClick={() => exportReport('csv')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors"
            >
              <Download size={20} />
              <span>CSV</span>
            </button>
            <button 
              onClick={() => exportReport('pdf')}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors"
            >
              <FileText size={20} />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="text-blue-600" size={20} />
            <span className="text-blue-900 font-medium">Report Period:</span>
            <span className="text-blue-800">{currentDateRange.label}</span>
          </div>
          <div className="text-sm text-blue-700">
            {Math.ceil((currentDateRange.end.getTime() - currentDateRange.start.getTime()) / (1000 * 60 * 60 * 24))} days
          </div>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {reportTypes.map((report) => (
          <div 
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={`bg-white rounded-lg shadow-sm p-6 cursor-pointer transition-all hover:shadow-md ${
              selectedReport === report.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center`}>
                <report.icon className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                <p className="text-sm text-gray-600">View detailed analytics</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Statistics */}
      {selectedReport === 'sales' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <TrendingUp className="text-blue-600 mr-3" size={24} />
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.totalSales}</p>
                <p className="text-sm text-blue-600">{summaryStats.periodCount} periods</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <DollarSign className="text-green-600 mr-3" size={24} />
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${summaryStats.totalRevenue?.toLocaleString()}</p>
                <p className="text-sm text-green-600">Period total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <BarChart className="text-purple-600 mr-3" size={24} />
              <div>
                <p className="text-sm text-gray-600">Avg Sale Value</p>
                <p className="text-2xl font-bold text-gray-900">${summaryStats.avgSaleValue?.toFixed(2)}</p>
                <p className="text-sm text-purple-600">Per transaction</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <Calendar className="text-orange-600 mr-3" size={24} />
              <div>
                <p className="text-sm text-gray-600">Daily Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(summaryStats.totalRevenue! / Math.ceil((currentDateRange.end.getTime() - currentDateRange.start.getTime()) / (1000 * 60 * 60 * 24))).toFixed(0)}
                </p>
                <p className="text-sm text-orange-600">Revenue/day</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Report Display */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{generateReportData.title}</h2>
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600 capitalize">{selectedPeriod} view</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {selectedReport === 'sales' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Sale</th>
                  </>
                )}
                {selectedReport === 'inventory' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value</th>
                  </>
                )}
                {selectedReport === 'customers' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value</th>
                  </>
                )}
                {selectedReport === 'financial' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {generateReportData.data.map((row: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  {selectedReport === 'sales' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.period}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.sales}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(row.revenue / row.sales).toFixed(2)}</td>
                    </>
                  )}
                  {selectedReport === 'inventory' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.items}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.value.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(row.value / row.items).toFixed(2)}</td>
                    </>
                  )}
                  {selectedReport === 'customers' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.segment}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.count > 0 ? `$${(row.revenue / row.count).toFixed(2)}` : '$0.00'}
                      </td>
                    </>
                  )}
                  {selectedReport === 'financial' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.metric}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.metric.includes('Margin') ? `${row.value}%` : 
                         row.metric.includes('Revenue') || row.metric.includes('Expenses') || row.metric.includes('Profit') ? 
                         `$${row.value.toLocaleString()}` : row.value}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`${row.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.change >= 0 ? '+' : ''}{row.change}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          row.change >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {row.change >= 0 ? '↗ Growing' : '↘ Declining'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}