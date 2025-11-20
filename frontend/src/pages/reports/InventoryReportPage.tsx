import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package, AlertTriangle, Download } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import api from '../../lib/api';

interface InventoryReport {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalInventoryValue: number;
  productStocks: Array<{
    productId: string;
    sku: string;
    productName: string;
    category: string;
    stockQuantity: number;
    reorderLevel: number;
    unitPrice: number;
    stockValue: number;
    status: string;
  }>;
  categoryStocks: Array<{
    category: string;
    productCount: number;
    totalStock: number;
    totalValue: number;
  }>;
}

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function InventoryReportPage() {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/inventory');
      setReport(response.data);
    } catch (error) {
      console.error('Failed to load inventory report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return <Badge variant="danger" size="sm">Out of Stock</Badge>;
      case 'LOW_STOCK':
        return <Badge variant="warning" size="sm">Low Stock</Badge>;
      default:
        return <Badge variant="success" size="sm">In Stock</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <p className="text-gray-500">Loading report...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Inventory Report
            </h1>
            <p className="text-gray-600 mt-2">Current stock levels and valuations</p>
          </div>
          <Button variant="secondary" icon={<Download size={16} />}>
            Export PDF
          </Button>
        </div>

        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Products</p>
                    <p className="text-3xl font-bold text-blue-600">{report.totalProducts}</p>
                  </div>
                  <Package className="text-blue-600" size={32} />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Inventory Value</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${report.totalInventoryValue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-orange-200 bg-orange-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-800 mb-1">Low Stock</p>
                    <p className="text-3xl font-bold text-orange-600">{report.lowStockProducts}</p>
                  </div>
                  <AlertTriangle className="text-orange-600" size={32} />
                </div>
              </Card>

              <Card className="p-6 border-red-200 bg-red-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-800 mb-1">Out of Stock</p>
                    <p className="text-3xl font-bold text-red-600">{report.outOfStockProducts}</p>
                  </div>
                  <AlertTriangle className="text-red-600" size={32} />
                </div>
              </Card>
            </div>

            {/* Category Analysis */}
            {report.categoryStocks.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Stock by Category</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.categoryStocks}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalStock" fill="#8b5cf6" name="Total Stock" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Value by Category</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={report.categoryStocks}
                        dataKey="totalValue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {report.categoryStocks.map((_, index) => (
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

            {/* Product Stock Details */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Product Stock Details</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">SKU</th>
                      <th className="text-left py-3 px-4">Product</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-right py-3 px-4">Stock</th>
                      <th className="text-right py-3 px-4">Reorder Level</th>
                      <th className="text-right py-3 px-4">Unit Price</th>
                      <th className="text-right py-3 px-4">Stock Value</th>
                      <th className="text-center py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.productStocks.map((product) => (
                      <tr key={product.productId} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm">{product.sku}</td>
                        <td className="py-3 px-4">{product.productName}</td>
                        <td className="py-3 px-4">{product.category || 'N/A'}</td>
                        <td className="text-right py-3 px-4">{product.stockQuantity}</td>
                        <td className="text-right py-3 px-4">{product.reorderLevel}</td>
                        <td className="text-right py-3 px-4">${product.unitPrice.toFixed(2)}</td>
                        <td className="text-right py-3 px-4">${product.stockValue.toFixed(2)}</td>
                        <td className="text-center py-3 px-4">{getStatusBadge(product.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
