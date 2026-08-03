import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Download, TrendingUp } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api, { downloadFile } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface SalesReport {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  salesByProduct: Array<{
    productName: string;
    quantitySold: number;
    revenue: number;
    percentage: number;
  }>;
  salesByCustomer: Array<{
    customerName: string;
    orderCount: number;
    totalSpent: number;
    percentage: number;
  }>;
  salesByPeriod: Array<{
    period: string;
    orderCount: number;
    revenue: number;
  }>;
}

const COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#94a3b8', '#16a34a', '#dc2626'];

export default function SalesReportPage() {
  const { error: showError } = useToast();
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const loadReport = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate).toISOString();
      const response = await api.get(`/reports/sales?startDate=${start}&endDate=${end}`);
      setReport(response.data);
    } catch (error) {
      console.error('Failed to load sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate).toISOString();
      await downloadFile(
        '/reports/sales/export',
        { startDate: start, endDate: end, format: 'pdf' },
        `sales-report-${startDate}_${endDate}.pdf`
      );
    } catch (error) {
      console.error('Failed to export sales report:', error);
      showError('Failed to export sales report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Sales Report
            </h1>
            <p className="text-slate-600 mt-2">Analyze your sales performance</p>
          </div>
          <Button variant="secondary" icon={<Download size={16} />} loading={exporting} onClick={handleExportPdf}>
            Export PDF
          </Button>
        </div>

        {/* Date Range Selector */}
        <Card className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="sales-report-start-date" className="block text-sm font-medium text-slate-700 mb-2">
                Start Date
              </label>
              <input
                id="sales-report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="sales-report-end-date" className="block text-sm font-medium text-slate-700 mb-2">
                End Date
              </label>
              <input
                id="sales-report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <Button onClick={loadReport} loading={loading} icon={<Calendar size={16} />}>
              Generate Report
            </Button>
          </div>
        </Card>

        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatMoney(report.totalRevenue)}
                    </p>
                  </div>
                  <TrendingUp className="text-green-600" size={32} />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Total Orders</p>
                    <p className="text-3xl font-bold text-blue-600">{report.totalOrders}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Average Order Value</p>
                    <p className="text-3xl font-bold text-slate-900 tabular-nums">
                      {formatMoney(report.averageOrderValue)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sales by Period Chart */}
            {report.salesByPeriod.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Sales Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report.salesByPeriod}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} name="Revenue (RM)" />
                    <Line type="monotone" dataKey="orderCount" stroke="#0d9488" strokeWidth={2} name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Sales by Product */}
            {report.salesByProduct.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Top Products by Revenue</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.salesByProduct.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="productName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Product Sales Distribution</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={report.salesByProduct.slice(0, 6)}
                        dataKey="revenue"
                        nameKey="productName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {report.salesByProduct.slice(0, 6).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* Top Customers */}
            {report.salesByCustomer.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Top Customers</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Customer</th>
                        <th className="text-right py-3 px-4">Orders</th>
                        <th className="text-right py-3 px-4">Total Spent</th>
                        <th className="text-right py-3 px-4">% of Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.salesByCustomer.slice(0, 10).map((customer, index) => (
                        <tr key={index} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">{customer.customerName}</td>
                          <td className="text-right py-3 px-4">{customer.orderCount}</td>
                          <td className="text-right py-3 px-4">{formatMoney(customer.totalSpent)}</td>
                          <td className="text-right py-3 px-4">{customer.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {!report && !loading && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">Select a date range and click Generate Report</p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
